
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
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { purchasesData } from '@/lib/data';
import { Checkbox } from '@/components/ui/checkbox';

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
    const [selectedRows, setSelectedRows] = useState<string[]>([]);

    const fetchBinnedPurchases = useCallback(async () => {
        setIsLoading(true);
        if (!user) {
            setBinnedPurchases(purchasesData.filter(p => p.deletedAt));
            setIsLoading(false);
            return;
        }

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

    const handleRestorePurchases = async (purchaseIds: string[]) => {
        if (!user) return;
        try {
            const batch = writeBatch(db);
            purchaseIds.forEach(id => {
                const purchaseRef = doc(db, "purchases", id);
                batch.update(purchaseRef, { deletedAt: null });
            });
            await batch.commit();

            setBinnedPurchases(currentPurchases => currentPurchases.filter(p => !purchaseIds.includes(p.id)));
            setSelectedRows([]);
            toast({
              title: "Purchases Restored",
              description: `${purchaseIds.length} purchase order(s) have been successfully restored.`,
            });
        } catch (error) {
            console.error("Error restoring purchases:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to restore purchases."});
        }
    };

    const handlePermanentDeletePurchases = async (purchaseIds: string[]) => {
        if (!user) return;
        try {
            const batch = writeBatch(db);
            purchaseIds.forEach(id => {
                 batch.delete(doc(db, "purchases", id));
            });
            await batch.commit();

            setBinnedPurchases(currentPurchases => currentPurchases.filter(p => !purchaseIds.includes(p.id)));
            setSelectedRows([]);
            toast({
                title: "Purchases Permanently Deleted",
                description: `${purchaseIds.length} purchase order(s) have been permanently deleted.`,
                variant: "destructive"
            });
        } catch (error) {
            console.error("Error permanently deleting purchases:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to permanently delete purchases."});
        }
    }

    const filteredPurchases = useMemo(() => {
        return binnedPurchases.filter(purchase =>
            purchase.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            purchase.vendor.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [binnedPurchases, searchTerm]);
    
    const handleSelectAll = (checked: boolean | 'indeterminate') => {
        if (checked === true) {
          setSelectedRows(filteredPurchases.map(item => item.id));
        } else {
          setSelectedRows([]);
        }
    };

    const handleRowSelect = (itemId: string, checked: boolean) => {
        if (checked) {
          setSelectedRows(prev => [...prev, itemId]);
        } else {
          setSelectedRows(prev => prev.filter(id => id !== itemId));
        }
    };

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
           {selectedRows.length > 0 && (
            <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-md mb-4 border">
                <p className="text-sm font-medium">{selectedRows.length} item(s) selected.</p>
                <Button variant="outline" size="sm" onClick={() => handleRestorePurchases(selectedRows)} disabled={!user}>
                    <Undo className="mr-2 h-4 w-4" />
                    Restore Selected
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={!user}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Selected
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the selected {selectedRows.length} items.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handlePermanentDeletePurchases(selectedRows)}>
                        Delete Permanently
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </div>
           )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px] px-4">
                   <Checkbox
                        checked={selectedRows.length > 0 && selectedRows.length === filteredPurchases.length}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                        disabled={!user || filteredPurchases.length === 0}
                      />
                </TableHead>
                <TableHead className="h-12 px-4">PO #</TableHead>
                <TableHead className="h-12 px-4">Vendor</TableHead>
                <TableHead className="h-12 px-4">Time in Bin</TableHead>
                <TableHead className="h-12 px-4">Status</TableHead>
                <TableHead className="text-right h-12 px-4">Amount</TableHead>
                <TableHead className="text-right h-12 px-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                </TableRow>
              ) : filteredPurchases.length > 0 ? filteredPurchases.map((purchase) => (
                <TableRow key={purchase.id} data-state={selectedRows.includes(purchase.id) && "selected"}>
                  <TableCell className="px-4">
                     <Checkbox
                        checked={selectedRows.includes(purchase.id)}
                        onCheckedChange={(checked) => handleRowSelect(purchase.id, !!checked)}
                        aria-label={`Select purchase ${purchase.id}`}
                      />
                  </TableCell>
                  <TableCell className="font-medium">{purchase.id}</TableCell>
                  <TableCell>{purchase.vendor}</TableCell>
                  <TableCell>{purchase.deletedAt ? formatDistanceToNow(new Date(purchase.deletedAt), { addSuffix: true }) : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariant(purchase.status)}>{purchase.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(purchase.amount)}</TableCell>
                  <TableCell className="text-right space-x-2">
                     <Button variant="ghost" size="icon" onClick={() => handleRestorePurchases([purchase.id])} disabled={!user}>
                        <Undo className="h-4 w-4 text-green-600" />
                     </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={!user}>
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
                          <AlertDialogAction onClick={() => handlePermanentDeletePurchases([purchase.id])}>
                            Delete Permanently
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              )) : (
                 <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">
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
