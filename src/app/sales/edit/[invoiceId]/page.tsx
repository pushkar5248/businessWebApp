
"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { InvoiceForm } from '@/components/invoice-form';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Sale, SaleStatus } from '@/lib/types';
import type { InvoiceFormValues } from '@/components/invoice-form';

export default function EditSalePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const { invoiceId } = params;

  const [invoice, setInvoice] = useState<Sale | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !invoiceId) {
        if (!user) router.push('/login');
        return;
    };
    
    const fetchInvoice = async () => {
        try {
            const docRef = doc(db, "sales", invoiceId as string);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists() && docSnap.data().userId === user.uid) {
                setInvoice({ id: docSnap.id, ...docSnap.data() } as Sale);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: 'Invoice not found or you do not have permission to edit it.' });
                router.push('/sales');
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch invoice details.' });
            console.error("Error fetching invoice:", error);
        } finally {
            setIsLoading(false);
        }
    };

    fetchInvoice();
  }, [user, invoiceId, router, toast]);

  const handleUpdateSale = async (data: InvoiceFormValues, status: SaleStatus) => {
    if (!user || !invoiceId) return;

    const subtotal = data.items.reduce((acc, item) => acc + (item.quantity * item.price * (1 - (item.discount || 0)/100)), 0);
    const cgstAmount = subtotal * ((data.cgstRate || 0) / 100);
    const sgstAmount = subtotal * ((data.sgstRate || 0) / 100);
    const igstAmount = subtotal * ((data.igstRate || 0) / 100);
    let total = subtotal + cgstAmount + sgstAmount + igstAmount;
    
    const finalAmount = data.manualTotal !== undefined ? data.manualTotal : isNaN(total) ? 0 : Math.round(total);

    const updatedSaleData: { [key: string]: any } = {
        customer: data.customerName,
        date: data.invoiceDate,
        status: status,
        deletedAt: null,
        amount: finalAmount,
    };
    
    const optionalFields = [
        'customerAddress', 'customerPhone', 'customerState', 'customerGstin',
        'deliveryPlaceName', 'deliveryAddress', 'deliveryState', 'deliveryGstin',
        'transporterName', 'transporterVehicleNumber', 'placeOfSupply',
        'transportDate', 'eWayBillNumber'
    ];
    optionalFields.forEach(field => {
        const value = data[field as keyof InvoiceFormValues];
        if (value) {
            updatedSaleData[field] = value;
        }
    });
    
    if (data.cgstRate !== undefined) updatedSaleData.cgstRate = data.cgstRate;
    if (data.sgstRate !== undefined) updatedSaleData.sgstRate = data.sgstRate;
    if (data.igstRate !== undefined) updatedSaleData.igstRate = data.igstRate;
    if (data.manualTotal !== undefined) {
        updatedSaleData.manualTotal = data.manualTotal;
    }

    const finalItems = data.items.map(item => {
        const cleanedItem: { [key: string]: any } = {};
        cleanedItem.name = item.name;
        cleanedItem.quantity = item.quantity;
        cleanedItem.price = item.price;
        if (item.discount) cleanedItem.discount = item.discount;
        if (item.total) cleanedItem.total = item.total;
        if (item.inventoryId) cleanedItem.inventoryId = item.inventoryId;
        if (item.hsnCode) cleanedItem.hsnCode = item.hsnCode;
        if (item.unit) cleanedItem.unit = item.unit;
        return cleanedItem;
    });

    updatedSaleData.items = finalItems;

    try {
        const docRef = doc(db, "sales", invoiceId as string);
        await updateDoc(docRef, updatedSaleData);
        toast({
            title: `Invoice ${status === 'Draft' ? 'Draft Updated' : 'Updated'}`,
            description: `Invoice #${data.invoiceNumber} has been successfully updated.`,
        });
        router.push('/sales');
    } catch (error) {
        console.error("Error updating sale:", error);
        toast({ variant: "destructive", title: "Update Failed", description: "Could not update the invoice." });
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
        <h1 className="text-2xl font-bold font-headline">Edit Invoice #{invoiceId}</h1>
        <p className="text-muted-foreground">
          Modify the details of your sales invoice.
        </p>
      </div>
      {invoice && (
          <InvoiceForm
            onSubmit={handleUpdateSale}
            initialData={invoice}
          />
      )}
    </MainLayout>
  );
}
