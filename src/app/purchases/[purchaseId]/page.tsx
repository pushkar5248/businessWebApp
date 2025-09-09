
"use client";

import { useParams, useRouter } from 'next/navigation';
import React, { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { type Purchase, type PurchaseStatus, InventoryItem } from '@/lib/types';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrency } from '@/context/currency-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronDown, Loader2 } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/auth-context';
import { updateStockOnPurchase } from '@/services/inventory-service';


const getBadgeVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case 'received':
      return 'default';
    case 'pending':
      return 'secondary';
    default:
      return 'outline';
  }
};

const purchaseStatuses: PurchaseStatus[] = ['Received', 'Pending'];

export default function PurchaseDetailsPage() {
    const params = useParams();
    const { user } = useAuth();
    const { purchaseId } = params;
    const { formatCurrency, formatCurrencyValue } = useCurrency();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [purchase, setPurchase] = useState<Purchase | null>(null);
    
    const fetchPurchase = useCallback(async () => {
      if (!purchaseId) return;
      setIsLoading(true);
      try {
        const docRef = doc(db, "purchases", purchaseId as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            setPurchase({ id: docSnap.id, ...docSnap.data() } as Purchase);
        } else {
            setPurchase(null);
        }
      } catch (error) {
        console.error("Error fetching purchase:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to fetch purchase details." });
      } finally {
        setIsLoading(false);
      }
    }, [purchaseId, toast]);

    useEffect(() => {
        fetchPurchase();
    }, [fetchPurchase]);

    const handleStatusChange = async (newStatus: PurchaseStatus) => {
        if (!purchase || !user || newStatus === purchase.status) return;

        const oldStatus = purchase.status;
        const purchaseRef = doc(db, "purchases", purchase.id);

        try {
            // Optimistically update UI
            setPurchase(prev => prev ? { ...prev, status: newStatus } : null);
            await updateDoc(purchaseRef, { status: newStatus });
            
            toast({
                title: "Status Updated",
                description: `Purchase order status changed to ${newStatus}.`
            });

            // If status changes from Pending to Received, update inventory
            if (oldStatus === 'Pending' && newStatus === 'Received') {
                const updatedPurchaseDoc = await getDoc(purchaseRef);
                const updatedPurchaseData = updatedPurchaseDoc.data() as Purchase;
                
                if (updatedPurchaseData?.items) {
                    await updateStockOnPurchase(updatedPurchaseData.items, user.uid);
                    toast({
                        title: "Inventory Updated",
                        description: "Stock levels have been successfully updated.",
                    });
                }
            }
        } catch (error) {
             console.error("Error updating status or inventory:", error);
            // Revert optimistic update on error
            setPurchase(prev => prev ? { ...prev, status: oldStatus } : null);
            toast({ variant: "destructive", title: "Error", description: "Failed to update status." });
        }
    };

    if (isLoading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </MainLayout>
        );
    }
    
    if (!purchase) {
        notFound();
    }
    
    const subtotal = purchase.items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    const igstAmount = subtotal * ((purchase.igstRate || 0) / 100);
    const cgstAmount = subtotal * ((purchase.cgstRate || 0) / 100);
    const sgstAmount = subtotal * ((purchase.sgstRate || 0) / 100);
    const insuranceAndOthersAmount = subtotal * ((purchase.insuranceAndOthersRate || 0) / 100);


    return (
        <MainLayout>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Link href="/purchases">
                  <Button variant="outline" size="icon">
                    <ArrowLeft />
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold font-headline">Purchase Order {purchase.id}</h1>
                  <p className="text-muted-foreground">Details for PO sent to {purchase.vendor}.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="flex items-center gap-2" disabled={!user}>
                             <Badge variant={getBadgeVariant(purchase.status)}>{purchase.status}</Badge>
                             <ChevronDown className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                    {purchaseStatuses.map(status => (
                        <DropdownMenuItem key={status} onSelect={() => handleStatusChange(status)} disabled={purchase.status === status || !user}>
                            {status}
                        </DropdownMenuItem>
                    ))}
                    </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>PO Details</CardTitle>
                    <CardDescription>
                        Date: {new Date(purchase.date).toLocaleDateString()}
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="font-semibold mb-2">Vendor</h3>
                        <p>{purchase.vendor}</p>
                        <p>{purchase.vendorAddress}</p>
                        {purchase.vendorGstin && <p>GSTIN: {purchase.vendorGstin}</p>}
                    </div>
                     {purchase.shippingAddress && (
                         <div>
                            <h3 className="font-semibold mb-2">Shipping Address</h3>
                            <p>{purchase.shippingAddress}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Items</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item</TableHead>
                                <TableHead className="text-center">Quantity</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {purchase.items.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell className="text-center">{item.quantity}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.quantity * item.price)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
                 <CardFooter className="flex justify-end">
                    <div className="w-full max-w-sm space-y-2">
                         <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>{formatCurrencyValue(subtotal)}</span>
                        </div>
                         {purchase.cgstRate && (
                            <div className="flex justify-between">
                                <span>CGST ({purchase.cgstRate}%)</span>
                                <span>{formatCurrencyValue(cgstAmount)}</span>
                            </div>
                        )}
                        {purchase.sgstRate && (
                            <div className="flex justify-between">
                                <span>SGST ({purchase.sgstRate}%)</span>
                                <span>{formatCurrencyValue(sgstAmount)}</span>
                            </div>
                        )}
                        {purchase.igstRate && (
                            <div className="flex justify-between">
                                <span>IGST ({purchase.igstRate}%)</span>
                                <span>{formatCurrencyValue(igstAmount)}</span>
                            </div>
                        )}
                        {purchase.insuranceAndOthersRate && (
                            <div className="flex justify-between">
                                <span>Insurance & Others ({purchase.insuranceAndOthersRate}%)</span>
                                <span>{formatCurrencyValue(insuranceAndOthersAmount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total</span>
                            <span>{formatCurrencyValue(purchase.amount)}</span>
                        </div>
                    </div>
                </CardFooter>
            </Card>

        </MainLayout>
    );
}
