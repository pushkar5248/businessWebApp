
"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/main-layout";
import { type Purchase } from "@/lib/types";
import { ArrowLeft, Search, Trash2, Undo, Loader2 } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/context/currency-context";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';

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

export default function PurchasesBinPage() {
    const { user } = useAuth();
    const { formatCurrency } = useCurrency();
    const { toast } = useToast();
    const [binnedPurchases, setBinnedPurchases] = useState<Purchase[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchBinnedPurchases = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const q = query(collection(db, "purchases"), where("userId", "==", user.uid), where("deletedAt", "!=", null));
            const querySnapshot = await getDocs(q);
            const purchasesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase));
            setBinnedPurchases(purchasesList);
        } catch (error) {
            console.error("Error fetching binned purchases:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch binned items." });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        fetchBinnedPurchases();
    }, [fetchBinnedPurchases]);

    const handleRestorePurchase = async (purchaseId: string) => {
        try {
            const purchaseRef = doc(db, "purchases", purchaseId);
            await updateDoc(purchaseRef, { deletedAt: null });
            setBinnedPurchases(currentPurchases => currentPurchases.filter(p => p.id !== purchaseId));
            toast({
              title: "Purchase Restored",
              description: "The purchase order has been successfully restored.",
            });
        } catch (error) {
            console.error("Error restoring purchase:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to restore purchase."});
        }
    };

    const handlePermanentDelete = async (purchaseId: string) => {
        try {
            await deleteDoc(doc(db, "purchases", purchaseId));
            setBinnedPurchases(currentPurchases => currentPurchases.filter(p => p.id !== purchaseId));
            toast({
                title: "Purchase Permanently Deleted",
                description: "The purchase order has been permanently deleted.",
                variant: "destructive"
            });
        } catch (error) {
            console.error("Error permanently deleting purchase:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to permanently delete purchase."});
        }
    }

    const filteredPurchases = useMemo(() => {
        return binnedPurchases.filter(purchase =>
            purchase.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            purchase.vendor.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [binnedPurchases, searchTerm]);

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
            <Link href="/purchases">
                <Button variant="outline" size="icon"><ArrowLeft /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold font-headline">Binned Purchases</h1>
              <p className="text-muted-foreground">Purchase orders in the bin can be restored or permanently deleted.</p>
            </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Deleted Purchase Orders</CardTitle>
              <CardDescription>Items in the bin can be restored or permanently deleted.</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search bin..." 
                className="pl-8 w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Time in Bin</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                </TableRow>
              ) : filteredPurchases.length > 0 ? filteredPurchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell className="font-medium">{purchase.id}</TableCell>
                  <TableCell>{purchase.vendor}</TableCell>
                  <TableCell>{purchase.deletedAt ? formatDistanceToNow(new Date(purchase.deletedAt), { addSuffix: true }) : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariant(purchase.status)}>{purchase.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(purchase.amount)}</TableCell>
                  <TableCell className="text-right space-x-2">
                     <Button variant="ghost" size="icon" onClick={() => handleRestorePurchase(purchase.id)}>
                        <Undo className="h-4 w-4 text-green-600" />
                     </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this purchase order.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handlePermanentDelete(purchase.id)}>
                            Delete Permanently
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              )) : (
                 <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                        The bin is empty.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
