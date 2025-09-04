
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
import { salesData } from "@/lib/data";
import { PlusCircle, Search, Trash2, Archive, Loader2 } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/context/currency-context";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';


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

export default function SalesPage() {
    const { user } = useAuth();
    const { formatCurrency } = useCurrency();
    const router = useRouter();
    const { toast } = useToast();
    const [sales, setSales] = useState<Sale[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchSales = useCallback(async () => {
      setIsLoading(true);
      if (!user) {
          setSales(salesData.filter(s => !s.deletedAt));
          setIsLoading(false);
          return;
      }
      try {
        const q = query(collection(db, "sales"), where("userId", "==", user.uid), where("deletedAt", "==", null));
        const querySnapshot = await getDocs(q);
        const salesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale))
          .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setSales(salesList);
      } catch (error) {
        console.error("Error fetching sales:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch sales." });
      } finally {
        setIsLoading(false);
      }
    }, [user, toast]);

    useEffect(() => {
      fetchSales();
    }, [fetchSales]);

    const handleRowClick = (invoiceId: string) => {
        router.push(`/sales/${invoiceId}`);
    };

    const handleDeleteSale = async (e: React.MouseEvent, saleId: string) => {
        e.stopPropagation(); // Prevent row click event from firing
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to perform this action.'})
            return;
        }
        try {
          const saleRef = doc(db, "sales", saleId);
          await updateDoc(saleRef, {
            deletedAt: new Date().toISOString()
          });
          setSales(currentSales => currentSales.filter(sale => sale.id !== saleId));
          toast({
            title: "Sale Moved to Bin",
            description: "The sale has been successfully moved to the bin.",
          });
        } catch (error) {
          console.error("Error moving sale to bin:", error);
          toast({ variant: "destructive", title: "Error", description: "Could not move sale to bin." });
        }
    };

    const filteredSales = useMemo(() => {
        return sales.filter(sale =>
            sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sale.customer.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [sales, searchTerm]);

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold font-headline">Sales</h1>
          <p className="text-muted-foreground">Track and manage your sales invoices.</p>
        </div>
        <div className="flex items-center gap-2">
            <Link href="/sales/bin">
                <Button variant="outline"><Archive className="mr-2"/> View Bin</Button>
            </Link>
            <Link href="/sales/new">
              <Button><PlusCircle className="mr-2" /> New Sale</Button>
            </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sales History</CardTitle>
              <CardDescription>A list of all recorded sales.</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search sales..." 
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
              ) : filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No sales found.
                  </TableCell>
                </TableRow>
              ) : (filteredSales.map((sale) => (
                <TableRow key={sale.id} onClick={() => handleRowClick(sale.id)} className="cursor-pointer">
                  <TableCell className="font-medium">{sale.id}</TableCell>
                  <TableCell>{sale.customer}</TableCell>
                  <TableCell>{new Date(sale.date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariant(sale.status)}>{sale.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(sale.amount)}</TableCell>
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
                            This will move the sale to the bin. You can restore it later.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={(e) => handleDeleteSale(e, sale.id)}>
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

    