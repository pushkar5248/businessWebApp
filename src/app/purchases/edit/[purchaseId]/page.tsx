
"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { PurchaseOrderForm } from '@/components/purchase-order-form';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Purchase, PurchaseStatus } from '@/lib/types';
import type { PurchaseOrderFormValues } from '@/components/purchase-order-form';

export default function EditPurchasePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const { purchaseId } = params;

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !purchaseId) {
        if (!user) router.push('/login');
        return;
    };
    
    const fetchPurchase = async () => {
        try {
            const docRef = doc(db, "purchases", purchaseId as string);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists() && docSnap.data().userId === user.uid) {
                setPurchase({ id: docSnap.id, ...docSnap.data() } as Purchase);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: 'Purchase order not found or you do not have permission to edit it.' });
                router.push('/purchases');
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch purchase order details.' });
            console.error("Error fetching purchase:", error);
        } finally {
            setIsLoading(false);
        }
    };

    fetchPurchase();
  }, [user, purchaseId, router, toast]);

  const handleUpdatePurchase = async (data: PurchaseOrderFormValues, status: PurchaseStatus) => {
    if (!user || !purchaseId) return;

    const subtotal = data.items.reduce((acc, item) => acc + item.quantity * item.price, 0);
    const igstAmount = subtotal * ((data.igstRate || 0) / 100);
    const cgstAmount = subtotal * ((data.cgstRate || 0) / 100);
    const sgstAmount = subtotal * ((data.sgstRate || 0) / 100);
    const insuranceAndOthersAmount = subtotal * ((data.insuranceAndOthersRate || 0) / 100);
    const total = subtotal + igstAmount + cgstAmount + sgstAmount + insuranceAndOthersAmount;

    const sanitizedItems = data.items.map(item => ({
        ...item,
        hsnCode: item.hsnCode ?? '',
        unit: item.unit ?? ''
    }));

    const updatedPurchase = {
        id: data.poNumber,
        vendor: data.vendorName,
        vendorGstin: data.vendorGstin,
        vendorAddress: data.vendorAddress,
        shippingAddress: data.shippingAddress,
        date: data.poDate,
        amount: total,
        status: status,
        items: sanitizedItems,
        transporterVehicleNumber: data.transporterVehicleNumber || '',
        cgstRate: data.cgstRate || 0,
        sgstRate: data.sgstRate || 0,
        igstRate: data.igstRate || 0,
        insuranceAndOthersRate: data.insuranceAndOthersRate || 0,
        userId: user.uid,
        deletedAt: null,
        eWayBillNumber: data.eWayBillNumber || '',
    };

    try {
        const docRef = doc(db, "purchases", purchaseId as string);
        await updateDoc(docRef, updatedPurchase);
        toast({
            title: `Purchase Order ${status === 'Draft' ? 'Draft Updated' : 'Updated'}`,
            description: `PO #${data.poNumber} has been successfully updated.`,
        });
        router.push('/purchases');
    } catch (error) {
        console.error("Error updating purchase:", error);
        toast({ variant: "destructive", title: "Update Failed", description: "Could not update the purchase order." });
    }
  };
  
  if (isLoading) {
    return (
        <MainLayout>
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="mb-4">
        <h1 className="text-2xl font-bold font-headline">Edit Purchase Order #{purchaseId}</h1>
        <p className="text-muted-foreground">
          Modify the details of your purchase order.
        </p>
      </div>
      {purchase && (
          <PurchaseOrderForm
            onSubmit={handleUpdatePurchase}
            initialData={purchase}
          />
      )}
    </MainLayout>
  );
}
