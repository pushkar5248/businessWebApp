
"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/main-layout";
import { type Purchase } from "@/lib/types";
import { purchasesData } from "@/lib/data";
import { PlusCircle, Search, Trash2, Archive, Loader2, Columns, ArrowUpDown } from "lucide-react";
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

type ColumnKeys = Omit<Purchase, 'userId' | 'items' | 'vendorAddress' | 'shippingAddress' | 'deletedAt'>;

const COLUMN_NAMES: Record<keyof ColumnKeys, string> = {
    id: "PO #",
    vendor: "Vendor",
    date: "Date",
    status: "Status",
    amount: "Amount",
}

export default function PurchasesPage() {
    const { user } = useAuth();
    const { formatCurrency } = useCurrency();
    const router = useRouter();
    const { toast } = useToast();
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [columnOrder, setColumnOrder] = useState<string[]>(Object.keys(COLUMN_NAMES));
    const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
        id: true,
        vendor: true,
        date: true,
        status: true,
        amount: true,
    });
    const [sortConfig, setSortConfig] = useState<{ key: keyof ColumnKeys, direction: 'ascending' | 'descending' } | null>(null);
    const dragItem = useRef<string | null>(null);
    const dragOverItem = useRef<string | null>(null);

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
            const purchasesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase));
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

    useEffect(() => {
        const savedOrder = localStorage.getItem("purchasesColumnOrder");
        if (savedOrder) setColumnOrder(JSON.parse(savedOrder));

        const savedVisibility = localStorage.getItem("purchasesColumnVisibility");
        if (savedVisibility) setColumnVisibility(JSON.parse(savedVisibility));

        const savedSortConfig = localStorage.getItem("purchasesSortConfig");
        if (savedSortConfig) setSortConfig(JSON.parse(savedSortConfig));
    }, []);

    useEffect(() => {
        localStorage.setItem("purchasesColumnOrder", JSON.stringify(columnOrder));
    }, [columnOrder]);

    useEffect(() => {
        localStorage.setItem("purchasesColumnVisibility", JSON.stringify(columnVisibility));
    }, [columnVisibility]);

    useEffect(() => {
        localStorage.setItem('purchasesSortConfig', JSON.stringify(sortConfig));
    }, [sortConfig]);

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
    
    const visibleColumns = columnOrder.filter(key => columnVisibility[key]);

    const handleDragStart = (e: React.DragEvent<HTMLTableCellElement>, key: string) => {
        dragItem.current = key;
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnter = (e: React.DragEvent<HTMLTableCellElement>, key: string) => {
        dragOverItem.current = key;
        const dragItemIndex = columnOrder.findIndex(item => item === dragItem.current);
        const dragOverItemIndex = columnOrder.findIndex(item => item === dragOverItem.current);

        if (dragItem.current && dragOverItem.current && dragItem.current !== dragOverItem.current) {
            setColumnOrder(currentOrder => {
                const newOrder = [...currentOrder];
                const [reorderedItem] = newOrder.splice(dragItemIndex, 1);
                newOrder.splice(dragOverItemIndex, 0, reorderedItem);
                return newOrder;
            });
        }
    };

    const handleDragEnd = () => {
        dragItem.current = null;
        dragOverItem.current = null;
    };

    const requestSort = (key: keyof ColumnKeys) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
          direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedPurchases = useMemo(() => {
        let sortableItems = [...purchases];
        if (searchTerm) {
          sortableItems = sortableItems.filter(item =>
            item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.vendor.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }

        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;
                
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    if (sortConfig.key === 'date') {
                         return sortConfig.direction === 'ascending' ? new Date(aValue).getTime() - new Date(bValue).getTime() : new Date(bValue).getTime() - new Date(aValue).getTime();
                    }
                    return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
                }
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [purchases, sortConfig, searchTerm]);

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
             <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search purchases..." 
                  className="pl-8 w-64"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="ml-auto">
                        <Columns className="mr-2" /> Columns
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {columnOrder.map((key) => (
                        <DropdownMenuCheckboxItem
                        key={key}
                        className="capitalize"
                        checked={columnVisibility[key]}
                        onCheckedChange={(checked) =>
                            setColumnVisibility(prev => ({...prev, [key]: !!checked}))
                        }
                        >
                        {COLUMN_NAMES[key as keyof ColumnKeys]}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.map((key) => (
                  <TableHead 
                    key={key}
                    draggable
                    onDragStart={(e) => handleDragStart(e, key)}
                    onDragEnter={(e) => handleDragEnter(e, key)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className="cursor-move p-0"
                  >
                    <div className="flex items-center justify-between p-4">
                        <span>{COLUMN_NAMES[key as keyof ColumnKeys]}</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                                e.stopPropagation();
                                requestSort(key as keyof ColumnKeys);
                            }}
                            className="h-6 w-6 ml-2"
                        >
                            <ArrowUpDown className="h-4 w-4" />
                        </Button>
                    </div>
                  </TableHead>
                ))}
                <TableHead className="text-right border-l">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                    <TableCell colSpan={visibleColumns.length + 1} className="h-24 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                </TableRow>
              ) : sortedPurchases.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={visibleColumns.length + 1} className="h-24 text-center">
                        No purchases found.
                    </TableCell>
                </TableRow>
              ) : (sortedPurchases.map((purchase) => (
                <TableRow key={purchase.id} onClick={() => handleRowClick(purchase.id)} className="cursor-pointer">
                  {visibleColumns.map(key => (
                      <TableCell key={key} className="border-l">
                          {key === 'status' ? (
                            <Badge variant={getBadgeVariant(purchase.status)}>{purchase.status}</Badge>
                          ) : key === 'amount' ? (
                            formatCurrency(purchase.amount)
                          ) : key === 'date' ? (
                            new Date(purchase.date).toLocaleDateString()
                          ) : (
                            purchase[key as keyof Purchase] as React.ReactNode
                          )}
                      </TableCell>
                  ))}
                  <TableCell className="text-right border-l">
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
