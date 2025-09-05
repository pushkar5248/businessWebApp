
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
import { type Sale, type SaleStatus } from "@/lib/types";
import { salesData } from "@/lib/data";
import { PlusCircle, Search, Trash2, Archive, Loader2, Columns, ArrowUpDown, Edit, Save } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/context/currency-context";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";


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
    const [originalSales, setOriginalSales] = useState<Sale[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [columnOrder, setColumnOrder] = useState<string[]>(Object.keys(COLUMN_NAMES));
    const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
        id: true,
        customer: true,
        date: true,
        status: true,
        amount: true,
    });
    const [sortConfig, setSortConfig] = useState<{ key: keyof ColumnKeys, direction: 'ascending' | 'descending' } | null>(null);

    const fetchSales = useCallback(async () => {
      setIsLoading(true);
      if (!user) {
          const guestData = salesData.filter(s => !s.deletedAt);
          setSales(guestData);
          setOriginalSales(JSON.parse(JSON.stringify(guestData)));
          setIsLoading(false);
          return;
      }
      try {
        const q = query(collection(db, "sales"), where("userId", "==", user.uid), where("deletedAt", "==", null));
        const querySnapshot = await getDocs(q);
        const salesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
        setSales(salesList);
        setOriginalSales(JSON.parse(JSON.stringify(salesList)));
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

    const handleSaleUpdate = async (saleId: string, field: keyof Sale, value: any) => {
        if (!user) return;

        const tempSales = sales.map(s => s.id === saleId ? { ...s, [field]: value } : s);
        setSales(tempSales);

        try {
            const saleRef = doc(db, "sales", saleId);
            await updateDoc(saleRef, { [field]: value });
            
            setOriginalSales(prev => prev.map(s => s.id === saleId ? { ...s, [field]: value } : s));
            if(field === 'status') {
                 toast({ title: "Status Updated", description: "Sale status has been updated." });
            }
        } catch (error) {
            console.error(`Error updating sale ${field}:`, error);
            toast({ variant: "destructive", title: "Error", description: `Failed to update ${field}.` });
            
            setSales(originalSales);
        }
    };

    const handleSaveChanges = async () => {
        if (!user) return;
        
        const batch = writeBatch(db);
        let changesCount = 0;
        
        sales.forEach(currentSale => {
            const originalSale = originalSales.find(s => s.id === currentSale.id);
            if (originalSale && JSON.stringify(currentSale) !== JSON.stringify(originalSale)) {
                const { id, userId, ...saleData } = currentSale;
                const saleRef = doc(db, "sales", id);
                batch.update(saleRef, saleData as { [x: string]: any; });
                changesCount++;
            }
        });

        if (changesCount === 0) {
            toast({ title: "No Changes", description: "No sales were modified." });
            setIsEditMode(false);
            return;
        }

        try {
            await batch.commit();
            setOriginalSales(JSON.parse(JSON.stringify(sales)));
            toast({ title: "Success", description: `${changesCount} sale(s) updated successfully.` });
        } catch (error) {
            console.error("Error updating sales:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to save changes." });
            fetchSales(); // Re-fetch to revert changes
        } finally {
            setIsEditMode(false);
        }
    };

    const handleDeleteSales = async (saleIds: string[]) => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to perform this action.'})
            return;
        }
        try {
            const batch = writeBatch(db);
            saleIds.forEach(id => {
                const saleRef = doc(db, "sales", id);
                batch.update(saleRef, { deletedAt: new Date().toISOString() });
            });
            await batch.commit();

            setSales(currentSales => currentSales.filter(sale => !saleIds.includes(sale.id)));
            setOriginalSales(currentSales => currentSales.filter(sale => !saleIds.includes(sale.id)));
            setSelectedRows([]);
            toast({
                title: "Sale(s) Moved to Bin",
                description: `${saleIds.length} sale(s) have been successfully moved to the bin.`,
            });
        } catch (error) {
          console.error("Error moving sales to bin:", error);
          toast({ variant: "destructive", title: "Error", description: "Could not move sales to bin." });
        }
    };
    
    const visibleColumns = columnOrder.filter(key => columnVisibility[key]);

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

    const handleSelectAll = (checked: boolean | 'indeterminate') => {
        if (checked === true) {
          setSelectedRows(sortedSales.map(item => item.id));
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
    
    const handleEditToggle = () => {
        if (isEditMode) {
            handleSaveChanges();
        } else {
            setIsEditMode(true);
        }
    };

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
               <Button onClick={handleEditToggle} disabled={!user}>
                    {isEditMode ? <Save className="mr-2" /> : <Edit className="mr-2" />}
                    {isEditMode ? 'Save Changes' : 'Edit Sales'}
                </Button>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search sales..." 
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
                    {Object.keys(COLUMN_NAMES).map((key) => (
                        <DropdownMenuCheckboxItem
                        key={key}
                        className="capitalize"
                        checked={columnVisibility[key as keyof ColumnKeys]}
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
          {selectedRows.length > 0 && (
            <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-md mb-4 border">
                <p className="text-sm font-medium">{selectedRows.length} item(s) selected.</p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={!user}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Move Selected to Bin
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will move the selected {selectedRows.length} sale(s) to the bin. You can restore them later.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteSales(selectedRows)}>
                        Move to Bin
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                 <TableHead className="p-0 h-12">
                  <div className="flex items-center justify-center h-full px-4">
                     <Checkbox
                        checked={selectedRows.length > 0 && sortedSales.length > 0 && selectedRows.length === sortedSales.length ? true : selectedRows.length > 0 ? 'indeterminate' : false}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                        disabled={!user}
                      />
                  </div>
                </TableHead>
                {visibleColumns.map((key) => (
                    <TableHead 
                        key={key}
                        className="cursor-pointer h-12 px-4"
                        onClick={() => requestSort(key as keyof ColumnKeys)}
                      >
                        <div
                          className="flex items-center justify-between"
                          suppressHydrationWarning
                        >
                            <span className="font-medium">{COLUMN_NAMES[key as keyof ColumnKeys]}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-2"
                            >
                                <ArrowUpDown className="h-4 w-4" />
                            </Button>
                        </div>
                  </TableHead>
                ))}
                <TableHead className="text-right px-4 h-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 2} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : sortedSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 2} className="h-24 text-center">
                    No sales found.
                  </TableCell>
                </TableRow>
              ) : (sortedSales.map((sale) => (
                <TableRow key={sale.id} data-state={selectedRows.includes(sale.id) && "selected"}>
                   <TableCell onClick={(e) => e.stopPropagation()}>
                       <Checkbox
                          checked={selectedRows.includes(sale.id)}
                          onCheckedChange={(checked) => handleRowSelect(sale.id, !!checked)}
                          aria-label={`Select sale ${sale.id}`}
                          disabled={!user}
                        />
                    </TableCell>
                   {visibleColumns.map(key => (
                      <TableCell key={key} onClick={(e) => { e.stopPropagation(); if (!isEditMode) handleRowClick(sale.id); }}>
                           {key === 'status' ? (
                               <div onClick={(e) => e.stopPropagation()}>
                                <Select
                                    value={sale.status}
                                    onValueChange={(newStatus) => handleSaleUpdate(sale.id, 'status', newStatus as SaleStatus)}
                                    disabled={!user}
                                >
                                    <SelectTrigger className="w-[120px] focus:ring-0 shadow-none bg-transparent border-0">
                                        <SelectValue>
                                            <Badge variant={getBadgeVariant(sale.status)}>{sale.status}</Badge>
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Pending">Pending</SelectItem>
                                        <SelectItem value="Paid">Paid</SelectItem>
                                        <SelectItem value="Overdue">Overdue</SelectItem>
                                    </SelectContent>
                                </Select>
                               </div>
                          ) : key === 'amount' ? (
                            formatCurrency(sale.amount)
                           ) : key === 'date' ? (
                             <Input 
                                type="date"
                                value={sale.date}
                                onChange={(e) => handleSaleUpdate(sale.id, 'date', e.target.value)}
                                disabled={!isEditMode || !user}
                                className={cn(!isEditMode && "border-none disabled:cursor-text disabled:opacity-100")}
                             />
                          ) : key === 'customer' ? (
                            <Input 
                                value={sale.customer}
                                onChange={(e) => handleSaleUpdate(sale.id, 'customer', e.target.value)}
                                disabled={!isEditMode || !user}
                                className={cn(!isEditMode && "border-none disabled:cursor-text disabled:opacity-100")}
                             />
                          ) : (
                             <span className={cn(!isEditMode && "cursor-pointer hover:underline")} onClick={() => !isEditMode && handleRowClick(sale.id)}>
                                {sale[key as keyof Sale] as React.ReactNode}
                            </span>
                          )}
                      </TableCell>
                  ))}
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={!user}>
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
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteSales([sale.id])}>
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

    