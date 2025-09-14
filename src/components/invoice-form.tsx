
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useForm, useFieldArray, FormProvider, Controller } from "react-hook-form";
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
import { PlusCircle, Trash2, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type Sale, type SaleStatus, type InventoryItem } from "@/lib/types";
import { useCurrency } from "@/context/currency-context";
import { useAuth } from "@/context/auth-context";
import { useSettings } from "@/context/settings-context";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs, query, where, updateDoc } from "firebase/firestore";
import { Combobox } from "@/components/ui/combobox";
import { updateStockOnSale } from "@/services/inventory-service";
import { fetchGstinDetails } from "@/ai/flows/fetch-gstin-details";
import { stateCodeMap } from "@/lib/state-codes";


const lineItemSchema = z.object({
  inventoryId: z.string().optional(),
  name: z.string().min(1, "Item name is required."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  price: z.coerce.number().min(0, "Price cannot be negative."),
  hsnCode: z.string().optional(),
  unit: z.string().optional(),
});

const formSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required."),
  invoiceDate: z.string().min(1, "Invoice date is required."),
  customerName: z.string().min(1, "Customer name is required."),
  customerAddress: z.string().min(1, "Customer address is required."),
  customerPhone: z.string().optional(),
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
  eWayBillNumber: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "At least one item is required."),
  cgstRate: z.coerce.number().min(0).optional(),
  sgstRate: z.coerce.number().min(0).optional(),
  igstRate: z.coerce.number().min(0).optional(),
});

export type InvoiceFormValues = z.infer<typeof formSchema>;

type ActionType = "create" | "generate" | "create_and_generate" | "draft" | "update";

interface InvoiceFormProps {
    onSubmit?: (data: InvoiceFormValues, status: SaleStatus) => Promise<void>;
    initialData?: Sale;
}

export function InvoiceForm({ onSubmit, initialData }: InvoiceFormProps) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isFetchingGstin, setIsFetchingGstin] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [subtotal, setSubtotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalTaxes, setTotalTaxes] = useState(0);
  const [roundOff, setRoundOff] = useState(0);
  const [roundedTotal, setRoundedTotal] = useState(0);
  const { currency, formatCurrencyValue } = useCurrency();
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryOptions, setInventoryOptions] = useState<{value: string, label: string}[]>([]);


  const methods = useForm<InvoiceFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
        ...initialData,
        invoiceNumber: initialData.id,
        customerName: initialData.customer,
    } : {
      invoiceDate: new Date().toISOString().split("T")[0],
      transportDate: new Date().toISOString().split("T")[0],
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      items: [{ name: "", quantity: 1, price: 0, hsnCode: "", unit: "" }],
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
    setValue,
    getValues,
    formState: { errors },
  } = methods;
  
  const fetchInventory = useCallback(async () => {
    if (!user) return;
    try {
        const inventoryQuery = query(collection(db, "inventory"), where("userId", "==", user.uid));
        const inventorySnapshot = await getDocs(inventoryQuery);
        // Defensive check: only include items that have a valid name.
        const items = inventorySnapshot.docs.map(doc => ({...doc.data(), id: doc.id} as InventoryItem)).filter(item => item && item.name);
        setInventoryItems(items);

    } catch (error) {
        console.error("Error fetching inventory", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load inventory items.'})
    }
  }, [user, toast]);
  
  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);
  
  const sortedInventoryItems = useMemo(() => {
    const sortConfig = settings?.preferences?.inventorySort;
    if (!sortConfig) {
      return [...inventoryItems];
    }
    
    const sorted = [...inventoryItems].sort((a, b) => {
        let aValue, bValue;
        if (sortConfig.key === 'value') {
            aValue = a.price * a.stock;
            bValue = b.price * b.stock;
        } else {
            aValue = a[sortConfig.key as keyof InventoryItem];
            bValue = b[sortConfig.key as keyof InventoryItem];
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
        }
        return 0;
    });
    return sorted;
  }, [inventoryItems, settings?.preferences?.inventorySort]);

  useEffect(() => {
    setInventoryOptions(sortedInventoryItems.map(item => ({ value: item.id, label: item.name })));
  }, [sortedInventoryItems]);

  useEffect(() => {
      if (settings && !initialData) {
          reset({
              invoiceDate: new Date().toISOString().split("T")[0],
              transportDate: new Date().toISOString().split("T")[0],
              invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
              items: [{ name: "", quantity: 1, price: 0, hsnCode: "", unit: "" }],
              cgstRate: settings.billing.defaultCgstRate,
              sgstRate: settings.billing.defaultSgstRate,
              igstRate: 0,
          });
      }
      if(initialData){
          reset({
            ...initialData,
            invoiceNumber: initialData.id,
            customerName: initialData.customer,
            invoiceDate: initialData.date,
          });
      }
  }, [settings, reset, initialData]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchedFormValues = watch();

  useEffect(() => {
    const { items, cgstRate, sgstRate, igstRate } = watchedFormValues;
    const newSubtotal = (items || []).reduce(
      (acc, item) => acc + (item.quantity || 0) * (item.price || 0),
      0
    );
    const cgst = newSubtotal * ((cgstRate || 0) / 100);
    const sgst = newSubtotal * ((sgstRate || 0) / 100);
    const igst = newSubtotal * ((igstRate || 0) / 100);

    const newTotalTaxes = cgst + sgst + igst;
    const newTotal = newSubtotal + newTotalTaxes;
    const newRoundedTotal = Math.round(newTotal);
    const newRoundOff = newRoundedTotal - newTotal;
    
    setSubtotal(newSubtotal);
    setTotalTaxes(newTotalTaxes);
    setTotal(newTotal);
    setRoundOff(newRoundOff);
    setRoundedTotal(newRoundedTotal);
  }, [watchedFormValues]);

  const handleCreateSale = async (data: InvoiceFormValues, status: SaleStatus = 'Pending') => {
    if (!user) {
        toast({ variant: "destructive", title: "Error", description: "You must be logged in to create a sale." });
        throw new Error("User not authenticated");
    }
    const newSale: Omit<Sale, 'id'> & { id: string } = {
      id: data.invoiceNumber,
      customer: data.customerName,
      date: data.invoiceDate,
      amount: roundedTotal,
      status: status,
      items: data.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, inventoryId: i.inventoryId, hsnCode: i.hsnCode, unit: i.unit })),
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
      eWayBillNumber: data.eWayBillNumber,
      cgstRate: data.cgstRate,
      sgstRate: data.sgstRate,
      igstRate: data.igstRate,
      userId: user.uid,
      deletedAt: null
    };

    try {
        const saleDocRef = doc(db, "sales", newSale.id);
        await setDoc(saleDocRef, newSale);

        toast({
          title: `Sale ${status === 'Draft' ? 'Draft Saved' : 'Created'}`,
          description: `Invoice #${data.invoiceNumber} has been successfully saved.`,
        });
    } catch (error) {
        console.error("Error creating sale:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to create sale." });
        throw error;
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
        total: roundedTotal,
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
      throw error;
    }
  };

  const handleFormSubmit = async (data: InvoiceFormValues, action: ActionType) => {
    setIsActionLoading(true);
    try {
       // This indicates we are in edit mode.
      if (onSubmit) {
        if (action === 'draft') await onSubmit(data, 'Draft');
        else await onSubmit(data, 'Pending');
        return;
      }
      
      // This is for creating a new invoice.
       if (action === 'draft') {
        await handleCreateSale(data, 'Draft');
        router.push('/sales');
      } else if (action === 'create') {
        await handleCreateSale(data, 'Pending');
        router.push('/sales');
      } else if (action === 'generate') {
        await handleGeneratePdf(data);
      } else if (action === 'create_and_generate') {
        await handleCreateSale(data, 'Pending');
        await handleGeneratePdf(data);
        router.push('/sales');
      }
    } catch (error) {
      // Error is already toasted in the respective handlers
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleGstinFetch = async () => {
    const gstin = getValues("customerGstin");
    if (!gstin || gstin.length !== 15) {
      toast({
        variant: "destructive",
        title: "Invalid GSTIN",
        description: "Please enter a valid 15-character GSTIN.",
      });
      return;
    }

    setIsFetchingGstin(true);
    try {
      const result = await fetchGstinDetails({ gstin });
      if (result) {
        setValue("customerName", result.businessName, { shouldValidate: true });
        setValue("customerAddress", result.businessAddress, { shouldValidate: true });

        const normalizedAddress = result.businessAddress.toLowerCase();
        let foundState = '';

        // Sort state keys by length descending to match longer names first
        const sortedStateKeys = Object.keys(stateCodeMap).sort((a, b) => b.length - a.length);

        for (const stateKey of sortedStateKeys) {
            if (normalizedAddress.includes(stateKey)) {
                // Find the canonical state name from the code
                const stateCode = stateCodeMap[stateKey];
                const canonicalState = Object.keys(stateCodeMap).find(key => stateCodeMap[key] === stateCode && !/^[a-z]{2}$/.test(key)); // Find full name, not abbreviation
                if (canonicalState) {
                    foundState = canonicalState.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    break;
                }
            }
        }
        
        if (foundState) {
            setValue("customerState", foundState, { shouldValidate: true });
        } else {
             setValue("customerState", "", { shouldValidate: true });
        }


        toast({
          title: "Details Fetched",
          description: `Successfully fetched details for ${result.businessName}.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Not Found",
          description: "No details found for the provided GSTIN.",
        });
      }
    } catch (error) {
      console.error("Error fetching GSTIN details:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not fetch GSTIN details. Please try again.",
      });
    } finally {
      setIsFetchingGstin(false);
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
            <CardTitle>Invoice Details</CardTitle>
            <CardDescription>
              Enter the main details for your invoice.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label htmlFor="invoiceNumber">Invoice Number</Label>
                <Input id="invoiceNumber" {...methods.register("invoiceNumber")} readOnly={!!initialData} />
                {errors.invoiceNumber && <p className="text-sm text-destructive">{errors.invoiceNumber.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="invoiceDate">Invoice Date</Label>
                <Input id="invoiceDate" type="date" {...methods.register("invoiceDate")} />
                {errors.invoiceDate && <p className="text-sm text-destructive">{errors.invoiceDate.message}</p>}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Recipient Details</CardTitle>
            <CardDescription>
              Enter the recipient's information for the invoice.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label htmlFor="customerGstin">GSTIN/UIN</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="customerGstin"
                  {...methods.register("customerGstin")}
                  placeholder="e.g. 27ABCDE1234F1Z5"
                  onInput={(e) => {
                    const input = e.target as HTMLInputElement;
                    input.value = input.value.toUpperCase();
                  }}
                />
                <Button type="button" variant="outline" size="icon" onClick={handleGstinFetch} disabled={isFetchingGstin}>
                  {isFetchingGstin ? <Loader2 className="animate-spin" /> : <Search />}
                </Button>
              </div>
            </div>
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
              <Label htmlFor="customerPhone">Phone (optional)</Label>
              <Input
                id="customerPhone"
                {...methods.register("customerPhone")}
                placeholder="e.g. 9999999999"
                type="text"
                onInput={(e) => {
                  const input = e.target as HTMLInputElement;
                  input.value = input.value.replace(/[^0-9]/g, '');
                }}
              />
              {errors.customerPhone && (
                <p className="text-sm text-destructive">{errors.customerPhone.message}</p>
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
          <CardContent className="grid grid-cols-2 gap-4">
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
                onInput={(e) => {
                  const input = e.target as HTMLInputElement;
                  input.value = input.value.toUpperCase();
                }}
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
            <div className="space-y-2">
                <Label htmlFor="eWayBillNumber">E-Way Bill Number</Label>
                <Input
                    id="eWayBillNumber"
                    {...methods.register("eWayBillNumber")}
                    type="text"
                    onInput={(e) => {
                      const input = e.target as HTMLInputElement;
                      input.value = input.value.replace(/[^0-9]/g, '');
                    }}
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
                  <TableHead className="w-[35%] h-12 px-4">Item</TableHead>
                  <TableHead className="h-12 px-4">HSN</TableHead>
                  <TableHead className="h-12 px-4">Unit</TableHead>
                  <TableHead className="h-12 px-4">Quantity</TableHead>
                  <TableHead className="h-12 px-4">Price</TableHead>
                  <TableHead className="text-right h-12 px-4">Total</TableHead>
                  <TableHead className="h-12 px-4"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <Controller
                          control={control}
                          name={`items.${index}.inventoryId`}
                          render={({ field }) => (
                            <Combobox
                                options={inventoryOptions}
                                value={field.value}
                                onChange={(value) => {
                                    const selectedItem = inventoryItems.find(item => item.id === value);
                                    if (selectedItem) {
                                        setValue(`items.${index}.inventoryId`, selectedItem.id);
                                        setValue(`items.${index}.name`, selectedItem.name);
                                        setValue(`items.${index}.price`, selectedItem.price);
                                        setValue(`items.${index}.hsnCode`, selectedItem.hsnCode);
                                        setValue(`items.${index}.unit`, selectedItem.unit);
                                    } else {
                                        // Handle manual entry or clearing the selection
                                        setValue(`items.${index}.inventoryId`, undefined);
                                        setValue(`items.${index}.name`, '');
                                    }
                                }}
                                placeholder="Select item..."
                                emptyText="No items found in inventory."
                            />
                          )}
                        />
                      {errors.items?.[index]?.name && (
                        <p className="text-sm text-destructive">{errors.items[index].name.message}</p>
                      )}
                    </TableCell>
                     <TableCell>
                      <Controller
                        control={control}
                        name={`items.${index}.hsnCode`}
                        render={({ field }) => (
                            <Input
                                {...field}
                                placeholder="HSN Code"
                            />
                        )}
                      />
                    </TableCell>
                     <TableCell>
                      <Controller
                        control={control}
                        name={`items.${index}.unit`}
                        render={({ field }) => (
                            <Input
                                {...field}
                                placeholder="Unit"
                            />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="any"
                        {...methods.register(`items.${index}.quantity`)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="any"
                        {...methods.register(`items.${index}.price`)}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {currency}{formatCurrencyValue(
                        (watchedFormValues.items?.[index]?.quantity || 0) *
                        (watchedFormValues.items?.[index]?.price || 0)
                      ).replace(currency, '')}
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
              onClick={() => append({ name: "", quantity: 1, price: 0, hsnCode: "", unit: "" })}
              disabled={fields.length >= 6}
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
                    <Input id="cgstRate" type="number" step="any" {...methods.register("cgstRate")} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="sgstRate">SGST (%)</Label>
                    <Input id="sgstRate" type="number" step="any" {...methods.register("sgstRate")} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="igstRate">IGST (%)</Label>
                    <Input id="igstRate" type="number" step="any" {...methods.register("igstRate")} />
                </div>
            </div>
            <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{currency}{formatCurrencyValue(subtotal).replace(currency, '')}</span>
                </div>
                 <div className="flex justify-between">
                    <span>Taxes</span>
                    <span>{currency}{formatCurrencyValue(totalTaxes).replace(currency, '')}</span>
                </div>
                <div className="flex justify-between">
                    <span>Round Off</span>
                    <span>{currency}{formatCurrencyValue(roundOff).replace(currency, '')}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                    <span>Grand Total</span>
                    <span>{currency}{formatCurrencyValue(roundedTotal).replace(currency, '')}</span>
                </div>
            </div>
          </CardFooter>
        </Card>
        
        <div className="flex justify-end items-center gap-4 flex-wrap">
             {initialData ? (
               initialData.status === 'Draft' ? (
                 <>
                    <Button type="button" size="lg" variant="outline" disabled={isActionLoading} onClick={handleSubmit(data => handleFormSubmit(data, 'draft'))}>
                        {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save as Draft
                    </Button>
                     <Button type="button" size="lg" variant="outline" disabled={isActionLoading} onClick={handleSubmit(data => handleFormSubmit(data, 'create'))}>
                        {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Create Sale
                    </Button>
                    <Button type="button" size="lg" variant="outline" disabled={isActionLoading} onClick={handleSubmit(data => handleFormSubmit(data, 'generate'))}>
                        {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Generate Invoice PDF
                    </Button>
                    <Button type="button" size="lg" disabled={isActionLoading} onClick={handleSubmit(data => handleFormSubmit(data, 'create_and_generate'))}>
                        {isActionLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : "Create Sale and Generate PDF"}
                    </Button>
                 </>
               ) : (
                <Button type="button" size="lg" disabled={isActionLoading} onClick={handleSubmit(data => handleFormSubmit(data, 'update'))}>
                    {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Update Invoice
                </Button>
               )
             ) : (
                <>
                <Button type="button" size="lg" variant="outline" disabled={isActionLoading} onClick={handleSubmit(data => handleFormSubmit(data, 'draft'))}>
                    {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save as Draft
                </Button>
                <Button type="button" size="lg" variant="outline" disabled={isActionLoading} onClick={handleSubmit(data => handleFormSubmit(data, 'create'))}>
                    {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create Sale
                </Button>
                <Button type="button" size="lg" variant="outline" disabled={isActionLoading} onClick={handleSubmit(data => handleFormSubmit(data, 'generate'))}>
                    {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Generate Invoice PDF
                </Button>
                <Button type="button" size="lg" disabled={isActionLoading} onClick={handleSubmit(data => handleFormSubmit(data, 'create_and_generate'))}>
                    {isActionLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                        </>
                    ) : "Create Sale and Generate PDF"}
                </Button>
                </>
             )}
              <Button type="button" variant="ghost" size="lg" onClick={() => router.back()} disabled={isActionLoading}>
                Cancel
            </Button>
        </div>
      </form>
    </FormProvider>
  );
}
