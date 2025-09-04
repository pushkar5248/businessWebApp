"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useForm, useFieldArray, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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
import { useCurrency } from "@/context/currency-context";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { InventoryItem } from "@/lib/types";


const lineItemSchema = z.object({
  name: z.string().min(1, "Item name is required."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  price: z.coerce.number().min(0, "Price cannot be negative."),
});

const formSchema = z.object({
  vendorName: z.string().min(1, "Vendor name is required."),
  vendorAddress: z.string().min(1, "Vendor address is required."),
  vendorPhone: z.string().min(1, "Vendor phone is required."),
  poNumber: z.string().min(1, "PO number is required."),
  poDate: z.string().min(1, "PO date is required."),
  shippingAddress: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "At least one item is required."),
});

export type PurchaseOrderFormValues = z.infer<typeof formSchema>;

export function PurchaseOrderForm({ onSubmit }: { onSubmit: (data: PurchaseOrderFormValues) => void; }) {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const [subtotal, setSubtotal] = useState(0);
  const [total, setTotal] = useState(0);
  const { currency, formatCurrencyValue } = useCurrency();
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const methods = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      poDate: new Date().toISOString().split("T")[0],
      poNumber: `PO-${Date.now().toString().slice(-6)}`,
      items: [{ name: "", quantity: 1, price: 0 }],
    },
  });
  
  const fetchInventory = useCallback(async () => {
    if (!user) return;
    const q = query(collection(db, "inventory"), where("userId", "==", user.uid));
    const querySnapshot = await getDocs(q);
    const items = querySnapshot.docs.map(doc => doc.data() as InventoryItem);
    setInventoryItems(items);
  }, [user]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = methods;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchedItems = watch("items");

  useEffect(() => {
    const newSubtotal = watchedItems.reduce(
      (acc, item) => acc + (item.quantity || 0) * (item.price || 0),
      0
    );
    setSubtotal(newSubtotal);
    setTotal(newSubtotal); // Assuming no taxes for purchases for now
  }, [watchedItems]);

  const handleFormSubmit = async (data: PurchaseOrderFormValues) => {
    setIsLoading(true);
    try {
      onSubmit(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Vendor Details</CardTitle>
            <CardDescription>
              Enter the vendor's information for the purchase order.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="vendorPhone">Vendor Phone</Label>
              <Input
                id="vendorPhone"
                {...methods.register("vendorPhone")}
                placeholder="+1 234 567 890"
              />
               {errors.vendorPhone && (
                <p className="text-sm text-destructive">{errors.vendorPhone.message}</p>
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
                        placeholder="e.g. Black Granite Countertop"
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
          <CardFooter className="flex justify-end">
            <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrencyValue(subtotal)}</span>
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
                    <Label htmlFor="poNumber">PO Number</Label>
                    <Input id="poNumber" {...methods.register("poNumber")} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="poDate">PO Date</Label>
                    <Input id="poDate" type="date" {...methods.register("poDate")} />
                </div>
            </div>
             <Button type="submit" size="lg" disabled={isLoading}>
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                    </>
                ) : "Create Purchase Order"}
             </Button>
        </div>
      </form>
    </FormProvider>
  );
}
