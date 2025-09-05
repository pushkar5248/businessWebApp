
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
import { type Purchase, type PurchaseStatus } from "@/lib/types";
import { purchasesData } from "@/lib/data";
import { PlusCircle, Search, Trash2, Archive, Loader2, Columns, ArrowUpDown, Edit, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/context/currency-context";
import Link from "next/link";
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
    case 'received':
      return 'default';
    case 'pending':
      return 'secondary';
    default:
      return 'outline';
  }
};

type ColumnKeys = Omit<Purchase, 'userId' | 'items' | 'vendorAddress' | 'shippingAddress' | 'deletedAt' | 'igstRate'>;

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
    const [originalPurchases, setOriginalPurchases] = useState<Purchase[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [columnOrder, setColumnOrder] = useState<string[]>(Object.keys(COLUMN_NAMES));
    const [isEditMode, setIsEditMode] = useState(false);
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
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const fetchPurchases = useCallback(async () => {
        setIsLoading(true);
        if (!user) {
            const guestData = purchasesData.filter(p => !p.deletedAt);
            setPurchases(guestData);
            setOriginalPurchases(JSON.parse(JSON.stringify(guestData)));
            setIsLoading(false);
            return;
        }

        try {
            const q = query(collection(db, "purchases"), where("userId", "==", user.uid), where("deletedAt", "==", null));
            const querySnapshot = await getDocs(q);
            const purchasesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase));
            setPurchases(purchasesList);
            setOriginalPurchases(JSON.parse(JSON.stringify(purchasesList)));
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

    const handlePurchaseUpdate = async (purchaseId: string, field: keyof Purchase, value: any) => {
         if (!user) return;
        
        // Optimistic UI update
        const tempPurchases = purchases.map(p => p.id === purchaseId ? { ...p, [field]: value } : p);
        setPurchases(tempPurchases);
        
        try {
            const purchaseRef = doc(db, "purchases", purchaseId);
            await updateDoc(purchaseRef, { [field]: value });
            
            // On successful save, update the original state
            setOriginalPurchases(prev => prev.map(p => p.id === purchaseId ? { ...p, [field]: value } : p));
            if(field === 'status') {
                 toast({ title: "Status Updated", description: "Purchase status has been updated." });
            }
        } catch (error) {
             console.error(`Error updating purchase ${field}:`, error);
            toast({ variant: "destructive", title: "Error", description: `Failed to update ${field}.` });
            // Revert on failure
            setPurchases(originalPurchases);
        }
    };

    const handleSaveChanges = async () => {
        if (!user) return;
        
        const batch = writeBatch(db);
        let changesCount = 0;
        
        purchases.forEach(currentPurchase => {
            const originalPurchase = originalPurchases.find(p => p.id === currentPurchase.id);
            if (originalPurchase && JSON.stringify(currentPurchase) !== JSON.stringify(originalPurchase)) {
                const { id, userId, ...purchaseData } = currentPurchase;
                const purchaseRef = doc(db, "purchases", id);
                batch.update(purchaseRef, purchaseData as { [x: string]: any; });
                changesCount++;
            }
        });

        if (changesCount === 0) {
            toast({ title: "No Changes", description: "No purchases were modified." });
            setIsEditMode(false);
            return;
        }

        try {
            await batch.commit();
            setOriginalPurchases(JSON.parse(JSON.stringify(purchases)));
            toast({ title: "Success", description: `${changesCount} purchase(s) updated successfully.` });
        } catch (error) {
            console.error("Error updating purchases:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to save changes." });
            fetchPurchases(); // Re-fetch to revert changes
        } finally {
            setIsEditMode(false);
        }
    };

    const handleDeletePurchases = async (purchaseIds: string[]) => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to perform this action.'})
            return;
        }
        try {
            const batch = writeBatch(db);
            purchaseIds.forEach(id => {
                const purchaseRef = doc(db, "purchases", id);
                batch.update(purchaseRef, { deletedAt: new Date().toISOString() });
            });
            await batch.commit();
            
            setPurchases(currentPurchases => currentPurchases.filter(p => !purchaseIds.includes(p.id)));
            setOriginalPurchases(currentPurchases => currentPurchases.filter(p => !purchaseIds.includes(p.id)));
            setSelectedRows([]);
            toast({
              title: `Purchase(s) Moved to Bin`,
              description: `${purchaseIds.length} purchase order(s) have been moved to the bin.`,
            });
        } catch (error) {
            console.error("Error moving purchases to bin:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not move purchases to bin." });
        }
    };
    
    const visibleColumns = columnOrder.filter(key => columnVisibility[key]);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, key: string) => {
        dragItem.current = key;
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, key: string) => {
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

    const handleSelectAll = (checked: boolean | 'indeterminate') => {
        if (checked === true) {
          setSelectedRows(sortedPurchases.map(item => item.id));
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
                <Button onClick={handleEditToggle} disabled={!user}>
                    {isEditMode ? <Save className="mr-2" /> : <Edit className="mr-2" />}
                    {isEditMode ? 'Save Changes' : 'Edit Purchases'}
                </Button>
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
                        This will move the selected {selectedRows.length} purchase(s) to the bin. You can restore them later.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeletePurchases(selectedRows)}>
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
                 <TableHead style={{ width: '40px' }}>
                  <div className="flex items-center justify-center px-4 h-12">
                     <Checkbox
                        checked={selectedRows.length > 0 && selectedRows.length === sortedPurchases.length ? true : selectedRows.length > 0 ? 'indeterminate' : false}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                        disabled={!user}
                      />
                  </div>
                </TableHead>
                {visibleColumns.map((key) => (
                  <TableHead 
                    key={key}
                  >
                    <div
                      className={cn("flex items-center justify-between px-4 h-12 transition-all duration-300 ease-in-out", isClient && "cursor-move")}
                      onClick={() => requestSort(key as keyof ColumnKeys)}
                       {...(isClient ? {
                        draggable: true,
                        onDragStart: (e: React.DragEvent<HTMLDivElement>) => handleDragStart(e, key),
                        onDragEnter: (e: React.DragEvent<HTMLDivElement>) => handleDragEnter(e, key),
                        onDragEnd: handleDragEnd,
                        onDragOver: (e: React.DragEvent<HTMLDivElement>) => e.preventDefault(),
                      } : {})}
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
              ) : sortedPurchases.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={visibleColumns.length + 2} className="h-24 text-center">
                        No purchases found.
                    </TableCell>
                </TableRow>
              ) : (sortedPurchases.map((purchase) => (
                <TableRow key={purchase.id} data-state={selectedRows.includes(purchase.id) && "selected"}>
                   <TableCell onClick={(e) => e.stopPropagation()}>
                       <Checkbox
                          checked={selectedRows.includes(purchase.id)}
                          onCheckedChange={(checked) => handleRowSelect(purchase.id, !!checked)}
                          aria-label={`Select purchase ${purchase.id}`}
                          disabled={!user}
                        />
                    </TableCell>
                  {visibleColumns.map(key => (
                      <TableCell key={key} onClick={(e) => { e.stopPropagation(); if (!isEditMode) handleRowClick(purchase.id); }}>
                           {key === 'status' ? (
                                <div onClick={(e) => e.stopPropagation()}>
                                    <Select
                                        value={purchase.status}
                                        onValueChange={(newStatus) => handlePurchaseUpdate(purchase.id, 'status', newStatus as PurchaseStatus)}
                                        disabled={!user}
                                    >
                                        <SelectTrigger className="w-[120px] focus:ring-0 shadow-none bg-transparent border-0">
                                            <SelectValue>
                                                <Badge variant={getBadgeVariant(purchase.status)}>{purchase.status}</Badge>
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Pending">Pending</SelectItem>
                                            <SelectItem value="Received">Received</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                          ) : key === 'amount' ? (
                            formatCurrency(purchase.amount)
                          ) : key === 'date' ? (
                             <Input 
                                type="date"
                                value={purchase.date}
                                onChange={(e) => handlePurchaseUpdate(purchase.id, 'date', e.target.value)}
                                disabled={!isEditMode || !user}
                                className={cn(!isEditMode && "border-none disabled:cursor-text disabled:opacity-100")}
                             />
                          ) : key === 'vendor' ? (
                             <Input 
                                value={purchase.vendor}
                                onChange={(e) => handlePurchaseUpdate(purchase.id, 'vendor', e.target.value)}
                                disabled={!isEditMode || !user}
                                className={cn(!isEditMode && "border-none disabled:cursor-text disabled:opacity-100")}
                             />
                          ) : (
                             <span className={cn(!isEditMode && "cursor-pointer hover:underline")} onClick={() => !isEditMode && handleRowClick(purchase.id)}>
                                {purchase[key as keyof Purchase] as React.ReactNode}
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
                                    This will move the purchase order to the bin. You can restore it later.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeletePurchases([purchase.id])}>
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

    