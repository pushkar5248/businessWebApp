
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
import { type Sale } from "@/lib/types";
import { ArrowLeft, Search, Trash2, Undo, Loader2 } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/context/currency-context";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/context/auth-context';
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { salesData } from '@/lib/data';
import { Checkbox } from '@/components/ui/checkbox';

const getBadgeVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case 'paid':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'overdue':
      return 'destructive';
    default:
      return 'outline';
  }
};

export default function SalesBinPage() {
    const { user } = useAuth();
    const { formatCurrency } = useCurrency();
    const { toast } = useToast();
    const [binnedSales, setBinnedSales] = useState<Sale[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRows, setSelectedRows] = useState<string[]>([]);

    const fetchBinnedSales = useCallback(async () => {
        setIsLoading(true);
        if (!user) {
            setBinnedSales(salesData.filter(s => s.deletedAt));
            setIsLoading(false);
            return;
        }
        try {
            const q = query(collection(db, "sales"), where("userId", "==", user.uid), where("deletedAt", "!=", null));
            const querySnapshot = await getDocs(q);
            const salesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
            setBinnedSales(salesList);
        } catch (error) {
            console.error("Error fetching binned sales:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch binned items." });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        fetchBinnedSales();
    }, [fetchBinnedSales]);

    const handleRestoreSales = async (saleIds: string[]) => {
        if (!user) return;
        try {
            const batch = writeBatch(db);
            saleIds.forEach(id => {
                const saleRef = doc(db, "sales", id);
                batch.update(saleRef, { deletedAt: null });
            });
            await batch.commit();

            setBinnedSales(currentSales => currentSales.filter(sale => !saleIds.includes(sale.id)));
            setSelectedRows([]);
            toast({
              title: "Sale(s) Restored",
              description: `${saleIds.length} sale(s) have been successfully restored.`,
            });
        } catch (error) {
            console.error("Error restoring sales:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to restore sales."});
        }
    };

    const handlePermanentDeleteSales = async (saleIds: string[]) => {
        if (!user) return;
        try {
            const batch = writeBatch(db);
            saleIds.forEach(id => {
                 batch.delete(doc(db, "sales", id));
            });
            await batch.commit();

            setBinnedSales(currentSales => currentSales.filter(sale => !saleIds.includes(sale.id)));
            setSelectedRows([]);
            toast({
                title: "Sale(s) Permanently Deleted",
                description: `${saleIds.length} sale(s) have been permanently deleted.`,
                variant: "destructive"
            });
        } catch (error) {
            console.error("Error permanently deleting sales:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to permanently delete sales."});
        }
    }

    const filteredSales = useMemo(() => {
        return binnedSales.filter(sale =>
            sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sale.customer.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [binnedSales, searchTerm]);
    
    const handleSelectAll = (checked: boolean | 'indeterminate') => {
        if (checked === true) {
          setSelectedRows(filteredSales.map(item => item.id));
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
            <Link href="/sales">
                <Button variant="outline" size="icon"><ArrowLeft /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold font-headline">Binned Sales</h1>
              <p className="text-muted-foreground">Sales moved to the bin can be restored or permanently deleted.</p>
            </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Deleted Sales</CardTitle>
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
                <Button variant="outline" size="sm" onClick={() => handleRestoreSales(selectedRows)} disabled={!user}>
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
                        This action cannot be undone. This will permanently delete the selected {selectedRows.length} items from the system.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handlePermanentDeleteSales(selectedRows)}>
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
                        checked={selectedRows.length > 0 && selectedRows.length === filteredSales.length}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                        disabled={!user || filteredSales.length === 0}
                      />
                </TableHead>
                <TableHead className="h-12 px-4">Invoice #</TableHead>
                <TableHead className="h-12 px-4">Customer</TableHead>
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
              ) : filteredSales.length > 0 ? filteredSales.map((sale) => (
                <TableRow key={sale.id} data-state={selectedRows.includes(sale.id) && "selected"}>
                  <TableCell className="px-4">
                      <Checkbox
                        checked={selectedRows.includes(sale.id)}
                        onCheckedChange={(checked) => handleRowSelect(sale.id, !!checked)}
                        aria-label={`Select sale ${sale.id}`}
                      />
                  </TableCell>
                  <TableCell className="font-medium">{sale.id}</TableCell>
                  <TableCell>{sale.customer}</TableCell>
                  <TableCell>{sale.deletedAt ? formatDistanceToNow(new Date(sale.deletedAt), { addSuffix: true }) : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariant(sale.status)}>{sale.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(sale.amount)}</TableCell>
                  <TableCell className="text-right space-x-2">
                     <Button variant="ghost" size="icon" onClick={() => handleRestoreSales([sale.id])} disabled={!user}>
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
                            This action cannot be undone. This will permanently delete this sale from the system.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handlePermanentDeleteSales([sale.id])}>
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
