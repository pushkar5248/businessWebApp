
"use client";

import { PurchaseOrderForm } from "@/components/purchase-order-form";
import { MainLayout } from "@/components/layout/main-layout";
import { purchasesData, type Purchase } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseOrderFormValues } from "@/components/purchase-order-form";


export default function NewPurchasePage() {
  const { toast } = useToast();
  
  const handleCreatePurchase = (data: PurchaseOrderFormValues) => {
    console.log("New Purchase Order:", data);
    const newPurchase: Purchase = {
        id: data.poNumber,
        vendor: data.vendorName,
        vendorAddress: data.vendorAddress,
        shippingAddress: data.shippingAddress,
        date: data.poDate,
        amount: data.items.reduce((acc, item) => acc + item.quantity * item.price, 0),
        status: 'Pending',
        items: data.items,
    };
    // In a real app, you would send this to a server.
    // For now, we just prepend it to the mock data array.
    purchasesData.unshift(newPurchase);
    
    toast({
        title: "Purchase Order Created",
        description: `PO #${data.poNumber} has been successfully created.`,
    });
  };

  return (
    <MainLayout>
      <div className="mb-4">
        <h1 className="text-2xl font-bold font-headline">New Purchase Order</h1>
        <p className="text-muted-foreground">
          Create a new purchase order to send to your vendor.
        </p>
      </div>
      <PurchaseOrderForm onSubmit={handleCreatePurchase} />
    </MainLayout>
  );
}
