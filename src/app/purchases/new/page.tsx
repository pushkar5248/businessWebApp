
"use client";

import { PurchaseOrderForm } from "@/components/purchase-order-form";
import { MainLayout } from "@/components/layout/main-layout";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseOrderFormValues } from "@/components/purchase-order-form";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { doc, setDoc, collection, writeBatch, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PurchaseStatus } from "@/lib/types";


export default function NewPurchasePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  
  const handleCreatePurchase = async (data: PurchaseOrderFormValues, status: PurchaseStatus) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in to create a purchase order.",
      });
      return;
    }

    const subtotal = data.items.reduce((acc, item) => acc + item.quantity * item.price, 0);
    const igstAmount = subtotal * ((data.igstRate || 0) / 100);
    const cgstAmount = subtotal * ((data.cgstRate || 0) / 100);
    const sgstAmount = subtotal * ((data.sgstRate || 0) / 100);
    const insuranceAndOthersAmount = subtotal * ((data.insuranceAndOthersRate || 0) / 100);
    const total = subtotal + igstAmount + cgstAmount + sgstAmount + insuranceAndOthersAmount;


    const newPurchase = {
        id: data.poNumber,
        vendor: data.vendorName,
        vendorGstin: data.vendorGstin,
        vendorAddress: data.vendorAddress,
        shippingAddress: data.shippingAddress,
        date: data.poDate,
        amount: total,
        status: status,
        items: data.items,
        cgstRate: data.cgstRate,
        sgstRate: data.sgstRate,
        igstRate: data.igstRate,
        insuranceAndOthersRate: data.insuranceAndOthersRate,
        userId: user.uid,
        deletedAt: null,
    };
    
    try {
        const batch = writeBatch(db);
        const purchaseDocRef = doc(db, "purchases", newPurchase.id);
        batch.set(purchaseDocRef, newPurchase);
        
        const newItemsToCreate = data.items.filter(item => !item.inventoryId);

        if (newItemsToCreate.length > 0) {
            const inventoryColRef = collection(db, "inventory");
            const existingNames = new Set(
                (await getDocs(query(inventoryColRef, where("userId", "==", user.uid))))
                    .docs.map(d => d.data().name.toLowerCase())
            );

            for (const item of newItemsToCreate) {
                if (!existingNames.has(item.name.toLowerCase())) {
                    const newItemRef = doc(inventoryColRef);
                    batch.set(newItemRef, {
                        name: item.name,
                        price: item.price,
                        stock: 0, // Stock will be updated when PO is marked as 'Received'
                        hsnCode: item.hsnCode || '',
                        unit: item.unit || '',
                        userId: user.uid,
                    });
                    existingNames.add(item.name.toLowerCase());
                }
            }
        }
        
        await batch.commit();
        
        toast({
            title: `Purchase Order ${status === 'Draft' ? 'Draft Saved' : 'Created'}`,
            description: `PO #${data.poNumber} has been saved.`,
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

  if (!user) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-full text-center">
            <h1 className="text-2xl font-bold mb-4">Guest Mode</h1>
            <p className="text-muted-foreground mb-6">Creating new purchases is disabled in guest mode.</p>
            <Button onClick={() => router.push('/login')}>Login to Create a Purchase</Button>
        </div>
      </MainLayout>
    )
  }

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
