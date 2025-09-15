
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useForm, useFieldArray, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";

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
import { useCurrency } from "@/context/currency-context";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { InventoryItem, Purchase, PurchaseStatus } from "@/lib/types";
import { Combobox } from "@/components/ui/combobox";
import { fetchGstinDetails } from "@/ai/flows/fetch-gstin-details";
import { useSettings } from "@/context/settings-context";


const lineItemSchema = z.object({
  inventoryId: z.string().optional(),
  name: z.string().min(1, "Item name is required."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  price: z.coerce.number().min(0, "Price cannot be negative."),
  discount: z.coerce.number().min(0).max(100).optional().default(0),
  total: z.coerce.number().min(0),
  hsnCode: z.string().optional(),
  unit: z.string().optional(),
});

const formSchema = z.object({
  vendorName: z.string().min(1, "Vendor name is required."),
  vendorGstin: z.string().optional(),
  vendorAddress: z.string().min(1, "Vendor address is required."),
  shippingAddress: z.string().optional(),
  poNumber: z.string().min(1, "PO number is required."),
  poDate: z.string().min(1, "PO date is required."),
  eWayBillNumber: z.string().optional(),
  transporterVehicleNumber: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "At least one item is required."),
  cgstRate: z.coerce.number().min(0).optional(),
  sgstRate: z.coerce.number().min(0).optional(),
  igstRate: z.coerce.number().min(0).optional(),
  insuranceAndOthersRate: z.coerce.number().min(0).optional(),
});

export type PurchaseOrderFormValues = z.infer<typeof formSchema>;

interface PurchaseOrderFormProps {
    onSubmit: (data: PurchaseOrderFormValues, status: PurchaseStatus) => void;
    initialData?: Purchase;
}

export function PurchaseOrderForm({ onSubmit, initialData }: PurchaseOrderFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDraftLoading, setIsDraftLoading] = useState(false);
  const [isFetchingGstin, setIsFetchingGstin] = useState(false);
  const { user } = useAuth();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [subtotal, setSubtotal] = useState(0);
  const [total, setTotal] = useState(0);
  const { currency, formatCurrencyValue } = useCurrency();
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryOptions, setInventoryOptions] = useState<{value: string, label: string}[]>([]);
  const [totalTaxes, setTotalTaxes] = useState(0);
  const [roundOff, setRoundOff] = useState(0);
  const [roundedTotal, setRoundedTotal] = useState(0);
  const router = useRouter();


  const methods = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
        ...initialData,
        poNumber: initialData.id,
        vendorName: initialData.vendor,
        poDate: initialData.date,
    } : {
      poDate: new Date().toISOString().split("T")[0],
      poNumber: `PO-${Date.now().toString().slice(-6)}`,
      items: [{ name: "", quantity: 1, price: 0, discount: 0, total: 0, hsnCode: "", unit: "" }],
      cgstRate: settings?.billing.defaultCgstRate ?? 0,
      sgstRate: settings?.billing.defaultSgstRate ?? 0,
      igstRate: 0,
      insuranceAndOthersRate: 0,
    },
  });
  
  const fetchInventory = useCallback(async () => {
    if (!user) return;
    const q = query(collection(db, "inventory"), where("userId", "==", user.uid));
    const querySnapshot = await getDocs(q);
    const items = querySnapshot.docs.map(doc => ({...doc.data(), id: doc.id} as InventoryItem)).filter(item => item && item.name);
    setInventoryItems(items);
  }, [user]);

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


  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = methods;

  useEffect(() => {
    if (settings && !initialData) {
        reset({
            ...getValues(),
            poDate: new Date().toISOString().split("T")[0],
            poNumber: `PO-${Date.now().toString().slice(-6)}`,
            items: [{ name: "", quantity: 1, price: 0, discount: 0, total: 0, hsnCode: "", unit: "" }],
            cgstRate: settings.billing.defaultCgstRate,
            sgstRate: settings.billing.defaultSgstRate,
            igstRate: 0,
            insuranceAndOthersRate: 0,
        });
    }
     if (initialData) {
        reset({
            ...initialData,
            poNumber: initialData.id,
            poDate: initialData.date,
            vendorName: initialData.vendor,
        });
    }
  }, [settings, reset, getValues, initialData]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

<<<<<<< HEAD
  const calculateTotal = useCallback(() => {
    const { items, igstRate, cgstRate, sgstRate, insuranceAndOthersRate } = getValues();
    const newSubtotal = items.reduce((acc, item) => acc + (item.quantity || 0) * (item.price || 0), 0);
=======
  const watchedFormValues = watch();

  useEffect(() => {
    const { items, igstRate, cgstRate, sgstRate, insuranceAndOthersRate } = watchedFormValues;
    const newSubtotal = (items || []).reduce(
      (acc, item) => acc + (item.total || 0),
      0
    );
>>>>>>> 93d529b545a8cf18b0132867918f807122526dd2
    const igst = newSubtotal * ((igstRate || 0) / 100);
    const cgst = newSubtotal * ((cgstRate || 0) / 100);
    const sgst = newSubtotal * ((sgstRate || 0) / 100);
    const insuranceAndOthers = newSubtotal * ((insuranceAndOthersRate || 0) / 100);
    const newTotalTaxes = igst + cgst + sgst + insuranceAndOthers;
    const newTotal = newSubtotal + newTotalTaxes;
    const newRoundedTotal = Math.round(newTotal);
    const newRoundOff = newRoundedTotal - newTotal;
    setSubtotal(newSubtotal);
    setTotalTaxes(newTotalTaxes);
    setTotal(newTotal);
    setRoundOff(newRoundOff);
    setRoundedTotal(newRoundedTotal);
  }, [getValues]);
  
  useEffect(() => {
    const subscription = watch((value, { name, type }) => {
      if (name && (name.startsWith('items') || name.endsWith('Rate'))) {
        calculateTotal();
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, calculateTotal]);

  useEffect(() => {
    calculateTotal();
  }, []);

  const handleFormSubmit = async (data: PurchaseOrderFormValues, status: PurchaseStatus = 'Pending') => {
    setIsLoading(true);
    try {
      await onSubmit(data, status);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGstinFetch = async () => {
    const gstin = getValues("vendorGstin");
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
        setValue("vendorName", result.businessName, { shouldValidate: true });
        setValue("vendorAddress", result.businessAddress, { shouldValidate: true });
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

  const handleLineItemChange = (index: number) => {
    const item = getValues(`items.${index}`);
    const quantity = item.quantity || 0;
    const price = item.price || 0;
    const discount = item.discount || 0;
    const newTotal = (quantity * price) * (1 - discount / 100);
    setValue(`items.${index}.total`, newTotal, { shouldValidate: true });
  }

  return (
    <FormProvider {...methods}>
      <form className="space-y-8">
        <Card>
            <CardHeader>
                <CardTitle>PO Details</CardTitle>
                <CardDescription>
                Enter the main details for your purchase order.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="poNumber">PO Number</Label>
                    <Input id="poNumber" {...methods.register("poNumber")} readOnly={!!initialData} />
                    {errors.poNumber && <p className="text-sm text-destructive">{errors.poNumber.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="poDate">PO Date</Label>
                    <Input id="poDate" type="date" {...methods.register("poDate")} />
                    {errors.poDate && <p className="text-sm text-destructive">{errors.poDate.message}</p>}
                </div>
            </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vendor Details</CardTitle>
            <CardDescription>
              Enter the vendor's information for the purchase order.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendorGstin">Vendor GSTIN</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="vendorGstin"
                  {...methods.register("vendorGstin")}
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
              <Label htmlFor="vendorName">Vendor Name</Label>
              <Input
                id="vendorName"
                {...methods.register("vendorName")}
                placeholder="Stone Solutions"
              />
              {errors.vendorName && (
                <p className="text-sm text-destructive">{errors.vendorName.message}</p>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="vendorAddress">Vendor Address</Label>
              <Textarea
                id="vendorAddress"
                {...methods.register("vendorAddress")}
                placeholder="456 Quarry Lane, Bedrock City"
              />
               {errors.vendorAddress && (
                <p className="text-sm text-destructive">{errors.vendorAddress.message}</p>
              )}
            </div>
             <div className="space-y-2 md:col-span-2">
              <Label htmlFor="shippingAddress">Shipping Address (optional)</Label>
              <Textarea
                id="shippingAddress"
                {...methods.register("shippingAddress")}
                placeholder="Leave blank if same as business address"
              />
            </div>
             <div className="space-y-2">
                <Label htmlFor="eWayBillNumber">E-Way Bill Number (optional)</Label>
                <Input
                    id="eWayBillNumber"
                    {...methods.register("eWayBillNumber")}
                    placeholder="e.g. 123456789012"
                    type="text"
                    onInput={(e) => {
                      const input = e.target as HTMLInputElement;
                      input.value = input.value.replace(/[^0-9]/g, '');
                    }}
                />
             </div>
             <div className="space-y-2">
                <Label htmlFor="transporterVehicleNumber">Transporter Vehicle No. (optional)</Label>
                <Input
                    id="transporterVehicleNumber"
                    {...methods.register("transporterVehicleNumber")}
                    placeholder="e.g. UP80EJ1234"
                    type="text"
                     onInput={(e) => {
                      const input = e.target as HTMLInputElement;
                      input.value = input.value.toUpperCase();
                    }}
                />
             </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Purchase Items</CardTitle>
            <CardDescription>Add the items for this purchase order.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%] h-12 px-4">Item</TableHead>
                  <TableHead className="h-12 px-4">HSN</TableHead>
                  <TableHead className="h-12 px-4">Unit</TableHead>
                  <TableHead className="h-12 px-4">Quantity</TableHead>
                  <TableHead className="h-12 px-4">Price</TableHead>
                  <TableHead className="h-12 px-4 w-24">Discount %</TableHead>
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
                          name={`items.${index}.name`}
                          render={({ field: controllerField }) => (
                            <Combobox
                                options={inventoryOptions}
                                value={controllerField.value}
                                onValueChange={(newValue) => {
                                    const selectedItem = inventoryItems.find(item => item.id === newValue || item.name.toLowerCase() === newValue.toLowerCase());
                                    if(selectedItem) {
                                        setValue(`items.${index}.inventoryId`, selectedItem.id);
                                        setValue(`items.${index}.name`, selectedItem.name);
                                        setValue(`items.${index}.price`, selectedItem.price);
                                        setValue(`items.${index}.hsnCode`, selectedItem.hsnCode ?? '');
                                        setValue(`items.${index}.unit`, selectedItem.unit ?? '');
                                    } else {
                                      setValue(`items.${index}.inventoryId`, undefined);
                                      setValue(`items.${index}.name`, newValue);
                                    }
                                    handleLineItemChange(index);
                                }}
                                placeholder="Select or type new item..."
                                emptyText="No items found. Type to add."
                            />
                          )}
                        />
                      {errors.items?.[index]?.name && (
                        <p className="text-sm text-destructive">{errors.items[index].name.message}</p>
                      )}
                    </TableCell>
                    <TableCell>
<<<<<<< HEAD
                      <Input
                        {...methods.register(`items.${index}.hsnCode`)}
                        placeholder="HSN Code"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        {...methods.register(`items.${index}.unit`)}
                        placeholder="Unit"
=======
                      <Controller
                        control={control}
                        name={`items.${index}.hsnCode`}
                        render={({ field: controllerField }) => (
                            <Input
                                {...controllerField}
                                value={controllerField.value ?? ''}
                                placeholder="HSN Code"
                            />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        control={control}
                        name={`items.${index}.unit`}
                        render={({ field: controllerField }) => (
                            <Input
                                {...controllerField}
                                value={controllerField.value ?? ''}
                                placeholder="Unit"
                            />
                        )}
>>>>>>> 93d529b545a8cf18b0132867918f807122526dd2
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="any"
                        {...methods.register(`items.${index}.quantity`)}
                        onChange={() => {
                            handleLineItemChange(index);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="any"
                        {...methods.register(`items.${index}.price`)}
                         onChange={() => {
                            handleLineItemChange(index);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                       <Input
                        type="number"
                        step="any"
                        {...methods.register(`items.${index}.discount`)}
                        onChange={() => {
                            handleLineItemChange(index);
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
<<<<<<< HEAD
                      {currency}
                      {(
                        (watch(`items.${index}.quantity`) || 0) *
                        (watch(`items.${index}.price`) || 0)
                      ).toFixed(2)}
=======
                       <Input
                        type="number"
                        step="any"
                        {...methods.register(`items.${index}.total`)}
                      />
>>>>>>> 93d529b545a8cf18b0132867918f807122526dd2
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
              onClick={() => append({ name: "", quantity: 1, price: 0, discount: 0, total: 0, hsnCode: "", unit: "" })}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Item
            </Button>
             {errors.items && typeof errors.items === 'object' && !Array.isArray(errors.items) && (
                <p className="text-sm text-destructive mt-2">{errors.items.message}</p>
              )}
          </CardContent>
          <CardFooter className="flex flex-col items-end space-y-4">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl ml-auto">
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
                <div className="space-y-2">
                    <Label htmlFor="insuranceAndOthersRate">Insurance & Others (%)</Label>
                    <Input id="insuranceAndOthersRate" type="number" step="any" {...methods.register("insuranceAndOthersRate")} />
                </div>
            </div>
            <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{currency}{formatCurrencyValue(subtotal).replace(currency, '')}</span>
                </div>
                 <div className="flex justify-between">
                    <span>Taxes &amp; Fees</span>
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
            {initialData && initialData.status === 'Draft' ? (
                <>
                    <Button type="button" size="lg" variant="outline" disabled={isLoading} onClick={handleSubmit(data => handleFormSubmit(data, 'Draft'))}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Update Draft
                    </Button>
                    <Button type="button" size="lg" disabled={isLoading} onClick={handleSubmit(data => handleFormSubmit(data, 'Pending'))}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Create Purchase Order
                    </Button>
                </>
            ) : initialData ? (
                 <Button type="button" size="lg" disabled={isLoading} onClick={handleSubmit(data => handleFormSubmit(data, initialData.status))}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Update Purchase Order
                </Button>
            ) : (
                 <>
                    <Button type="button" variant="outline" size="lg" disabled={isDraftLoading || isLoading} onClick={handleSubmit(data => handleFormSubmit(data, 'Draft'))}>
                        {isDraftLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save as Draft
                    </Button>
                    <Button type="button" size="lg" disabled={isLoading || isDraftLoading} onClick={handleSubmit(data => handleFormSubmit(data, 'Pending'))}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Create Purchase Order
                    </Button>
                </>
            )}

             <Button type="button" variant="ghost" size="lg" onClick={() => router.back()} disabled={isLoading || isDraftLoading}>
                Cancel
            </Button>
        </div>
      </form>
    </FormProvider>
  );
}
