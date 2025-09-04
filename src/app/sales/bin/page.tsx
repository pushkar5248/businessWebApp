
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
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { salesData } from '@/lib/data';

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

    const handleRestoreSale = async (saleId: string) => {
        if (!user) return;
        try {
            const saleRef = doc(db, "sales", saleId);
            await updateDoc(saleRef, { deletedAt: null });
            setBinnedSales(currentSales => currentSales.filter(sale => sale.id !== saleId));
            toast({
              title: "Sale Restored",
              description: "The sale has been successfully restored.",
            });
        } catch (error) {
            console.error("Error restoring sale:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to restore sale."});
        }
    };

    const handlePermanentDelete = async (saleId: string) => {
        if (!user) return;
        try {
            await deleteDoc(doc(db, "sales", saleId));
            setBinnedSales(currentSales => currentSales.filter(sale => sale.id !== saleId));
            toast({
                title: "Sale Permanently Deleted",
                description: "The sale has been permanently deleted.",
                variant: "destructive"
            });
        } catch (error) {
            console.error("Error permanently deleting sale:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to permanently delete sale."});
        }
    }

    const filteredSales = useMemo(() => {
        return binnedSales.filter(sale =>
            sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sale.customer.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [binnedSales, searchTerm]);

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
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
              ) : filteredSales.length > 0 ? filteredSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">{sale.id}</TableCell>
                  <TableCell>{sale.customer}</TableCell>
                  <TableCell>{sale.deletedAt ? formatDistanceToNow(new Date(sale.deletedAt), { addSuffix: true }) : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariant(sale.status)}>{sale.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(sale.amount)}</TableCell>
                  <TableCell className="text-right space-x-2">
                     <Button variant="ghost" size="icon" onClick={() => handleRestoreSale(sale.id)} disabled={!user}>
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
                          <AlertDialogAction onClick={() => handlePermanentDelete(sale.id)}>
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

    