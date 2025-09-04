
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
import { purchasesData } from "@/lib/data";
import { PlusCircle, Search, Trash2, Archive, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/context/currency-context";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';


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
    const { user } = useAuth();
    const { formatCurrency } = useCurrency();
    const router = useRouter();
    const { toast } = useToast();
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchPurchases = useCallback(async () => {
        setIsLoading(true);
        if (!user) {
            setPurchases(purchasesData.filter(p => !p.deletedAt));
            setIsLoading(false);
            return;
        }

        try {
            const q = query(collection(db, "purchases"), where("userId", "==", user.uid), where("deletedAt", "==", null));
            const querySnapshot = await getDocs(q);
            const purchasesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase))
              .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setPurchases(purchasesList);
        } catch (error) {
            console.error("Error fetching purchases:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch purchases." });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        fetchPurchases();
    }, [fetchPurchases]);


    const handleRowClick = (purchaseId: string) => {
        router.push(`/purchases/${purchaseId}`);
    };

    const handleDeletePurchase = async (e: React.MouseEvent, purchaseId: string) => {
        e.stopPropagation(); // Prevent row click event
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to perform this action.'})
            return;
        }
        try {
            const purchaseRef = doc(db, "purchases", purchaseId);
            await updateDoc(purchaseRef, {
                deletedAt: new Date().toISOString()
            });
            setPurchases(currentPurchases => currentPurchases.filter(p => p.id !== purchaseId));
            toast({
              title: "Purchase Moved to Bin",
              description: "The purchase order has been successfully moved to the bin.",
            });
        } catch (error) {
            console.error("Error moving purchase to bin:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not move purchase to bin." });
        }
    };

    const filteredPurchases = useMemo(() => {
        return purchases.filter(purchase =>
            purchase.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            purchase.vendor.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [purchases, searchTerm]);

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold font-headline">Purchases</h1>
          <p className="text-muted-foreground">Keep track of your stock purchases.</p>
        </div>
        <div className="flex items-center gap-2">
            <Link href="/purchases/bin">
                <Button variant="outline"><Archive className="mr-2"/> View Bin</Button>
            </Link>
            <Link href="/purchases/new">
                <Button><PlusCircle className="mr-2" /> New Purchase</Button>
            </Link>
        </div>
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
              <Input 
                placeholder="Search purchases..." 
                className="pl-8 w-64"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
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
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                </TableRow>
              ) : filteredPurchases.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                        No purchases found.
                    </TableCell>
                </TableRow>
              ) : (filteredPurchases.map((purchase) => (
                <TableRow key={purchase.id} onClick={() => handleRowClick(purchase.id)} className="cursor-pointer">
                  <TableCell className="font-medium">{purchase.id}</TableCell>
                  <TableCell>{purchase.vendor}</TableCell>
                  <TableCell>{new Date(purchase.date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariant(purchase.status)}>{purchase.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(purchase.amount)}</TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!user} onClick={(e) => e.stopPropagation()}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will move the purchase order to the bin. You can restore it later.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={(e) => handleDeletePurchase(e, purchase.id)}>
                                    Move to Bin
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </MainLayout>
  );
}

    