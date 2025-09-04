
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
import { type Sale } from "@/lib/types";
import { salesData } from "@/lib/data";
import { PlusCircle, Search, Trash2, Archive, Loader2, Columns, ArrowUpDown } from "lucide-react";
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

type ColumnKeys = Omit<Sale, 'userId' | 'items' | 'deletedAt' | 'customerAddress' | 'customerPhone' | 'customerState' | 'customerGstin' | 'deliveryPlaceName' | 'deliveryAddress' | 'deliveryState' | 'deliveryGstin' | 'transporterName' | 'transporterVehicleNumber' | 'placeOfSupply' | 'transportDate' | 'cgstRate' | 'sgstRate' | 'igstRate' >;

const COLUMN_NAMES: Record<keyof ColumnKeys, string> = {
    id: "Invoice #",
    customer: "Customer",
    date: "Date",
    status: "Status",
    amount: "Amount",
}

export default function SalesPage() {
    const { user } = useAuth();
    const { formatCurrency } = useCurrency();
    const router = useRouter();
    const { toast } = useToast();
    const [sales, setSales] = useState<Sale[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [columnOrder, setColumnOrder] = useState<string[]>(Object.keys(COLUMN_NAMES));
    const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
        id: true,
        customer: true,
        date: true,
        status: true,
        amount: true,
    });
    const [sortConfig, setSortConfig] = useState<{ key: keyof ColumnKeys, direction: 'ascending' | 'descending' } | null>(null);
    const dragItem = useRef<string | null>(null);
    const dragOverItem = useRef<string | null>(null);

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
        const salesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
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

    useEffect(() => {
        const savedOrder = localStorage.getItem("salesColumnOrder");
        if (savedOrder) setColumnOrder(JSON.parse(savedOrder));

        const savedVisibility = localStorage.getItem("salesColumnVisibility");
        if (savedVisibility) setColumnVisibility(JSON.parse(savedVisibility));

        const savedSortConfig = localStorage.getItem("salesSortConfig");
        if (savedSortConfig) setSortConfig(JSON.parse(savedSortConfig));
    }, []);

    useEffect(() => {
        localStorage.setItem("salesColumnOrder", JSON.stringify(columnOrder));
    }, [columnOrder]);

    useEffect(() => {
        localStorage.setItem("salesColumnVisibility", JSON.stringify(columnVisibility));
    }, [columnVisibility]);
    
    useEffect(() => {
        localStorage.setItem('salesSortConfig', JSON.stringify(sortConfig));
    }, [sortConfig]);

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

    const sortedSales = useMemo(() => {
        let sortableItems = [...sales];
        if (searchTerm) {
          sortableItems = sortableItems.filter(item =>
            item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.customer.toLowerCase().includes(searchTerm.toLowerCase())
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
    }, [sales, sortConfig, searchTerm]);

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
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search sales..." 
                  className="pl-8 w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
              <TableRow className="bg-muted/50">
                {visibleColumns.map((key) => (
                    <TableHead 
                        key={key}
                        draggable
                        onDragStart={(e) => handleDragStart(e, key)}
                        onDragEnter={(e) => handleDragEnter(e, key)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                        className="cursor-move p-0 transition-all duration-300 ease-in-out"
                      >
                    <div className="flex items-center justify-between p-4">
                        <span className="font-medium">{COLUMN_NAMES[key as keyof ColumnKeys]}</span>
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
              ) : sortedSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="h-24 text-center">
                    No sales found.
                  </TableCell>
                </TableRow>
              ) : (sortedSales.map((sale) => (
                <TableRow key={sale.id} onClick={() => handleRowClick(sale.id)} className="cursor-pointer">
                   {visibleColumns.map(key => (
                      <TableCell key={key} className="border-l">
                          {key === 'status' ? (
                            <Badge variant={getBadgeVariant(sale.status)}>{sale.status}</Badge>
                          ) : key === 'amount' ? (
                            formatCurrency(sale.amount)
                          ) : key === 'date' ? (
                            new Date(sale.date).toLocaleDateString()
                          ) : (
                            sale[key as keyof Sale] as React.ReactNode
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
