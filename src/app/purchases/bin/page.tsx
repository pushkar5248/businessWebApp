
"use client";

import React, { useState, useMemo } from 'react';
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
import { purchasesData as initialPurchasesData } from "@/lib/data";
import { ArrowLeft, Search, Trash2, Undo } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/context/currency-context";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from 'date-fns';

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
    const { formatCurrency } = useCurrency();
    const { toast } = useToast();
    const [purchases, setPurchases] = useState(initialPurchasesData);
    const [searchTerm, setSearchTerm] = useState('');

    const handleRestorePurchase = (purchaseId: string) => {
        setPurchases(currentPurchases => currentPurchases.map(p => 
            p.id === purchaseId ? { ...p, deletedAt: undefined } : p
        ));
        toast({
          title: "Purchase Restored",
          description: "The purchase order has been successfully restored.",
        });
    };

    const handlePermanentDelete = (purchaseId: string) => {
         setPurchases(currentPurchases => currentPurchases.filter(p => p.id !== purchaseId));
         toast({
            title: "Purchase Permanently Deleted",
            description: "The purchase order has been permanently deleted.",
            variant: "destructive"
        });
    }

    const binnedPurchases = useMemo(() => {
        return purchases.filter(purchase => purchase.deletedAt && (
            purchase.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            purchase.vendor.toLowerCase().includes(searchTerm.toLowerCase())
        ));
    }, [purchases, searchTerm]);

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
              <CardDescription>Items in the bin are automatically deleted after 30 days.</CardDescription>
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
              {binnedPurchases.length > 0 ? binnedPurchases.map((purchase) => (
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
