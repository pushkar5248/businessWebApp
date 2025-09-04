
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useForm, useFieldArray, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import {
  generateInvoicePdf,
  type GenerateInvoicePdfInput,
} from "@/ai/flows/generate-invoice-pdf";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type Sale, type InventoryItem } from "@/lib/types";
import { useCurrency } from "@/context/currency-context";
import { useAuth } from "@/context/auth-context";
import { useSettings } from "@/context/settings-context";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs, query, where, writeBatch } from "firebase/firestore";

const lineItemSchema = z.object({
  name: z.string().min(1, "Item name is required."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  price: z.coerce.number().min(0, "Price cannot be negative."),
});

const formSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required."),
  invoiceDate: z.string().min(1, "Invoice date is required."),
  customerName: z.string().min(1, "Customer name is required."),
  customerAddress: z.string().min(1, "Customer address is required."),
  customerPhone: z.string().min(1, "Customer phone is required."),
  customerState: z.string().optional(),
  customerGstin: z.string().optional(),
  deliveryPlaceName: z.string().optional(),
  deliveryAddress: z.string().optional(),
  deliveryState: z.string().optional(),
  deliveryGstin: z.string().optional(),
  transporterName: z.string().optional(),
  transporterVehicleNumber: z.string().optional(),
  placeOfSupply: z.string().optional(),
  transportDate: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "At least one item is required."),
  cgstRate: z.coerce.number().min(0).optional(),
  sgstRate: z.coerce.number().min(0).optional(),
  igstRate: z.coerce.number().min(0).optional(),
});

type InvoiceFormValues = z.infer<typeof formSchema>;

type ActionType = "create" | "generate" | "create_and_generate";

export function InvoiceForm() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [isActionLoading, setIsActionLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [subtotal, setSubtotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalTaxes, setTotalTaxes] = useState(0);
  const { currency, formatCurrencyValue } = useCurrency();
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const methods = useForm<InvoiceFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      invoiceDate: new Date().toISOString().split("T")[0],
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      items: [{ name: "", quantity: 1, price: 0 }],
      cgstRate: settings?.billing.defaultCgstRate ?? 9,
      sgstRate: settings?.billing.defaultSgstRate ?? 9,
      igstRate: 0,
    },
  });

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = methods;
  
  const fetchInventory = useCallback(async () => {
    if (!user) return;
    try {
        const inventoryQuery = query(collection(db, "inventory"), where("userId", "==", user.uid));
        const inventorySnapshot = await getDocs(inventoryQuery);
        const items = inventorySnapshot.docs.map(doc => ({...doc.data(), id: doc.id} as InventoryItem));
        setInventoryItems(items);

    } catch (error) {
        console.error("Error fetching inventory", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load inventory items.'})
    }
  }, [user, toast]);
  
  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
      if (settings) {
          reset({
              invoiceDate: new Date().toISOString().split("T")[0],
              invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
              items: [{ name: "", quantity: 1, price: 0 }],
              cgstRate: settings.billing.defaultCgstRate,
              sgstRate: settings.billing.defaultSgstRate,
              igstRate: 0,
          });
      }
  }, [settings, reset]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchedItems = watch("items");
  const cgstRate = watch("cgstRate");
  const sgstRate = watch("sgstRate");
  const igstRate = watch("igstRate");

  useEffect(() => {
    const newSubtotal = watchedItems.reduce(
      (acc, item) => acc + (item.quantity || 0) * (item.price || 0),
      0
    );
    const cgst = newSubtotal * ((cgstRate || 0) / 100);
    const sgst = newSubtotal * ((sgstRate || 0) / 100);
    const igst = newSubtotal * ((igstRate || 0) / 100);

    const newTotalTaxes = cgst + sgst + igst;

    setSubtotal(newSubtotal);
    setTotalTaxes(newTotalTaxes);
    setTotal(newSubtotal + newTotalTaxes);
  }, [watchedItems, cgstRate, sgstRate, igstRate]);

  const handleCreateSale = async (data: InvoiceFormValues) => {
    if (!user) {
        toast({ variant: "destructive", title: "Error", description: "You must be logged in to create a sale." });
        throw new Error("User not authenticated");
    }
    const newSale: Omit<Sale, 'id'> & { id: string } = {
      id: data.invoiceNumber,
      customer: data.customerName,
      date: data.invoiceDate,
      amount: total,
      status: "Pending", // Default status
      items: data.items,
      customerAddress: data.customerAddress,
      customerPhone: data.customerPhone,
      customerState: data.customerState,
      customerGstin: data.customerGstin,
      deliveryPlaceName: data.deliveryPlaceName,
      deliveryAddress: data.deliveryAddress,
      deliveryState: data.deliveryState,
      deliveryGstin: data.deliveryGstin,
      transporterName: data.transporterName,
      transporterVehicleNumber: data.transporterVehicleNumber,
      placeOfSupply: data.placeOfSupply,
      transportDate: data.transportDate,
      cgstRate: data.cgstRate,
      sgstRate: data.sgstRate,
      igstRate: data.igstRate,
      userId: user.uid,
      deletedAt: null
    };

    try {
        const batch = writeBatch(db);

        // 1. Add the new sale to the batch
        const saleDocRef = doc(db, "sales", newSale.id);
        batch.set(saleDocRef, newSale);

        // 2. Update inventory stock
        const itemNames = data.items.map(item => item.name);
        if (itemNames.length > 0) {
            const inventoryQuery = query(collection(db, "inventory"), where("userId", "==", user.uid), where("name", "in", itemNames));
            const inventorySnapshot = await getDocs(inventoryQuery);

            const inventoryUpdates = new Map<string, number>();
            inventorySnapshot.forEach(doc => {
                const item = doc.data() as InventoryItem;
                inventoryUpdates.set(item.name, item.stock);
            });
            
            for (const saleItem of data.items) {
                const currentStock = inventoryUpdates.get(saleItem.name);
                if (currentStock !== undefined) {
                    const inventoryDoc = inventorySnapshot.docs.find(d => d.data().name === saleItem.name);
                    if (inventoryDoc) {
                        const newStock = currentStock - saleItem.quantity;
                        batch.update(inventoryDoc.ref, { stock: newStock });
                    }
                }
            }
        }

        // 3. Commit the batch
        await batch.commit();

        toast({
          title: "Sale Created",
          description: `Invoice #${data.invoiceNumber} has been successfully created and inventory updated.`,
        });
    } catch (error) {
        console.error("Error creating sale and updating inventory:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to create sale or update inventory." });
        throw error; // re-throw to stop processing in combined action
    }
  };

  const handleGeneratePdf = async (data: InvoiceFormValues) => {
    if (!settings) {
        toast({ variant: "destructive", title: "Error", description: "Settings not loaded." });
        throw new Error("Settings not loaded");
    }
    try {
      const input: GenerateInvoicePdfInput = {
        businessName: settings.general.businessName,
        businessAddress: settings.general.businessAddress,
        businessPhone: settings.general.businessPhone,
        businessEmail: settings.general.businessEmail,
        businessGstin: settings.general.businessGstin,
        ...data,
        items: data.items.map((item) => ({ ...item })),
        total: total,
        currency: currency,
      };

      const result = await generateInvoicePdf(input);
      
      if (result && result.html) {
          const invoiceElement = document.createElement('div');
          invoiceElement.innerHTML = result.html;
          document.body.appendChild(invoiceElement);
          
          const canvas = await html2canvas(invoiceElement.querySelector('.invoice-container')!, { scale: 2 });
          const imgData = canvas.toDataURL('image/png');
          
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          
          document.body.removeChild(invoiceElement);
          
          pdf.save(`invoice-${data.invoiceNumber}.pdf`);

        toast({
          title: "Success",
          description: "Invoice PDF has been generated successfully.",
        });
      } else {
        throw new Error("PDF generation failed, no HTML returned.");
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate invoice. Please try again.",
      });
      throw error; // re-throw to stop processing in combined action
    }
  };

  const onSubmit = async (data: InvoiceFormValues, action: ActionType) => {
    setIsActionLoading(true);
    try {
      if (action === 'create' || action === 'create_and_generate') {
        await handleCreateSale(data);
      }
      if (action === 'generate' || action === 'create_and_generate') {
        await handleGeneratePdf(data);
      }
      if (action !== 'generate') {
        router.push('/sales');
      }
    } catch (error) {
      // Error is already toasted in handleCreateSale or handleGeneratePdf
    } finally {
      setIsActionLoading(false);
    }
  };
  
   if (!settings) {
    return (
        <div className="flex h-[80vh] items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
   }


  return (
    <FormProvider {...methods}>
      <form className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Recipient Details</CardTitle>
            <CardDescription>
              Enter the recipient's information for the invoice.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Name</Label>
              <Input
                id="customerName"
                {...methods.register("customerName")}
                placeholder="John Doe"
              />
              {errors.customerName && (
                <p className="text-sm text-destructive">{errors.customerName.message}</p>
              )}
            </div>
             <div className="space-y-2">
              <Label htmlFor="customerPhone">Phone</Label>
              <Input
                id="customerPhone"
                {...methods.register("customerPhone")}
                placeholder="e.g. 999-999-9999"
              />
              {errors.customerPhone && (
                <p className="text-sm text-destructive">{errors.customerPhone.message}</p>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="customerAddress">Address</Label>
              <Textarea
                id="customerAddress"
                {...methods.register("customerAddress")}
                placeholder="123 Main St, Anytown, USA"
              />
               {errors.customerAddress && (
                <p className="text-sm text-destructive">{errors.customerAddress.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerState">State</Label>
              <Input
                id="customerState"
                {...methods.register("customerState")}
                placeholder="e.g. California"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerGstin">GSTIN/UIN</Label>
              <Input
                id="customerGstin"
                {...methods.register("customerGstin")}
                placeholder="e.g. 27ABCDE1234F1Z5"
              />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Delivery Place of Supply</CardTitle>
            <CardDescription>
              Enter the delivery information. Leave blank if same as recipient.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
             <div className="space-y-2 md:col-span-2">
              <Label htmlFor="deliveryPlaceName">Name (optional)</Label>
              <Input
                id="deliveryPlaceName"
                {...methods.register("deliveryPlaceName")}
                placeholder="e.g. Warehouse, Site Office"
              />
            </div>
             <div className="space-y-2 md:col-span-2">
              <Label htmlFor="deliveryAddress">Address (optional)</Label>
              <Textarea
                id="deliveryAddress"
                {...methods.register("deliveryAddress")}
                placeholder="Leave blank if same as recipient address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryState">State (optional)</Label>
              <Input
                id="deliveryState"
                {...methods.register("deliveryState")}
                placeholder="e.g. California"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryGstin">GSTIN/UIN (optional)</Label>
              <Input
                id="deliveryGstin"
                {...methods.register("deliveryGstin")}
                placeholder="e.g. 27ABCDE1234F1Z5"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transporter Details</CardTitle>
            <CardDescription>
              Enter the transporter information (optional).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label htmlFor="transporterName">Transporter Name</Label>
              <Input
                id="transporterName"
                {...methods.register("transporterName")}
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="transporterVehicleNumber">Vehicle No.</Label>
              <Input
                id="transporterVehicleNumber"
                {...methods.register("transporterVehicleNumber")}
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="placeOfSupply">Place of Supply</Label>
              <Input
                id="placeOfSupply"
                {...methods.register("placeOfSupply")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transportDate">Date</Label>
              <Input
                id="transportDate"
                type="date"
                {...methods.register("transportDate")}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Items</CardTitle>
            <CardDescription>Add the items for this invoice.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">Item</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <Input
                        {...methods.register(`items.${index}.name`)}
                        placeholder="e.g. Italian Marble Slab"
                        list="inventory-items"
                      />
                       <datalist id="inventory-items">
                        {inventoryItems.map(item => <option key={item.id} value={item.name} />)}
                       </datalist>
                      {errors.items?.[index]?.name && (
                        <p className="text-sm text-destructive">{errors.items[index].name.message}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        {...methods.register(`items.${index}.quantity`)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        {...methods.register(`items.${index}.price`)}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrencyValue(
                        (watchedItems[index]?.quantity || 0) *
                        (watchedItems[index]?.price || 0)
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => append({ name: "", quantity: 1, price: 0 })}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Item
            </Button>
             {errors.items && typeof errors.items === 'object' && !Array.isArray(errors.items) && (
                <p className="text-sm text-destructive mt-2">{errors.items.message}</p>
              )}
          </CardContent>
          <CardFooter className="flex flex-col items-end space-y-4">
             <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-sm ml-auto">
                <div className="space-y-2">
                    <Label htmlFor="cgstRate">CGST (%)</Label>
                    <Input id="cgstRate" type="number" {...methods.register("cgstRate")} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="sgstRate">SGST (%)</Label>
                    <Input id="sgstRate" type="number" {...methods.register("sgstRate")} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="igstRate">IGST (%)</Label>
                    <Input id="igstRate" type="number" {...methods.register("igstRate")} />
                </div>
            </div>
            <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrencyValue(subtotal)}</span>
                </div>
                 <div className="flex justify-between">
                    <span>Taxes</span>
                    <span>{formatCurrencyValue(totalTaxes)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{formatCurrencyValue(total)}</span>
                </div>
            </div>
          </CardFooter>
        </Card>
        
        <div className="flex justify-between items-center">
            <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="invoiceNumber">Invoice Number</Label>
                    <Input id="invoiceNumber" {...methods.register("invoiceNumber")} />
                    {errors.invoiceNumber && <p className="text-sm text-destructive">{errors.invoiceNumber.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="invoiceDate">Invoice Date</Label>
                    <Input id="invoiceDate" type="date" {...methods.register("invoiceDate")} />
                    {errors.invoiceDate && <p className="text-sm text-destructive">{errors.invoiceDate.message}</p>}
                </div>
            </div>

            <div className="flex justify-end gap-4">
                 <Button type="button" size="lg" variant="outline" disabled={isActionLoading} onClick={handleSubmit(data => onSubmit(data, 'create'))}>
                    {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create Sale
                 </Button>
                 <Button type="button" size="lg" variant="outline" disabled={isActionLoading} onClick={handleSubmit(data => onSubmit(data, 'generate'))}>
                    {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Generate Invoice PDF
                 </Button>
                 <Button type="button" size="lg" disabled={isActionLoading} onClick={handleSubmit(data => onSubmit(data, 'create_and_generate'))}>
                    {isActionLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                        </>
                    ) : "Create Sale and Generate PDF"}
                 </Button>
            </div>
        </div>
      </form>
    </FormProvider>
  );
}
