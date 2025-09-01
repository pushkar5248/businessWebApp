"use client";

import React, { useState } from 'react';
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
import { PlusCircle, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/context/currency-context";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";


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

export default function PurchasesPage() {
    const { formatCurrency } = useCurrency();
    const router = useRouter();
    const { toast } = useToast();
    const [purchases, setPurchases] = useState(initialPurchasesData);

    const handleRowClick = (purchaseId: string) => {
        router.push(`/purchases/${purchaseId}`);
    };

    const handleDeletePurchase = (e: React.MouseEvent, purchaseId: string) => {
        e.stopPropagation(); // Prevent row click event
        setPurchases(currentPurchases => currentPurchases.filter(p => p.id !== purchaseId));
        toast({
          title: "Purchase Deleted",
          description: "The purchase order has been successfully deleted.",
        });
    };

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold font-headline">Purchases</h1>
          <p className="text-muted-foreground">Keep track of your stock purchases.</p>
        </div>
        <Link href="/purchases/new">
            <Button><PlusCircle className="mr-2" /> New Purchase</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
                <CardTitle>Purchase History</CardTitle>
                <CardDescription>A list of all recorded purchases.</CardDescription>
            </div>
             <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search purchases..." className="pl-8 w-64" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((purchase) => (
                <TableRow key={purchase.id} onClick={() => handleRowClick(purchase.id)} className="cursor-pointer">
                  <TableCell className="font-medium">{purchase.id}</TableCell>
                  <TableCell>{purchase.vendor}</TableCell>
                  <TableCell>{purchase.date}</TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariant(purchase.status)}>{purchase.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(purchase.amount)}</TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
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
                                <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={(e) => handleDeletePurchase(e, purchase.id)}>
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
