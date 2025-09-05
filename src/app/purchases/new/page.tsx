
"use client";

import { PurchaseOrderForm } from "@/components/purchase-order-form";
import { MainLayout } from "@/components/layout/main-layout";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseOrderFormValues } from "@/components/purchase-order-form";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";


export default function NewPurchasePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  
  const handleCreatePurchase = async (data: PurchaseOrderFormValues) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in to create a purchase order.",
      });
      return;
    }

    const subtotal = data.items.reduce((acc, item) => acc + item.quantity * item.price, 0);
    const total = subtotal + (subtotal * (data.igstRate || 0) / 100);

    const newPurchase = {
        id: data.poNumber,
        vendor: data.vendorName,
        vendorAddress: data.vendorAddress,
        shippingAddress: data.shippingAddress,
        date: data.poDate,
        amount: total,
        status: 'Pending',
        items: data.items,
        igstRate: data.igstRate,
        userId: user.uid,
        deletedAt: null,
    };
    
    try {
        const docRef = doc(db, "purchases", newPurchase.id);
        await setDoc(docRef, newPurchase);
        
        toast({
            title: "Purchase Order Created",
            description: `PO #${data.poNumber} has been successfully created.`,
        });
        router.push('/purchases');

    } catch (error) {
        console.error("Error creating purchase order:", error);
        toast({
            variant: "destructive",
            title: "Creation Failed",
            description: "Could not create the purchase order. Please try again.",
        });
    }
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
