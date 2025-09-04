
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/main-layout";
import { type InventoryItem } from "@/lib/types";
import { inventoryData } from "@/lib/data";
import { PlusCircle, FileDown, FileUp, Columns, Search, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrency } from "@/context/currency-context";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, where, writeBatch } from "firebase/firestore";
import { useAuth } from "@/context/auth-context";


type ColumnKeys = Omit<InventoryItem, 'userId'>;

const COLUMN_NAMES: Record<keyof ColumnKeys, string> = {
  id: 'Item ID',
  name: 'Name',
  category: 'Category',
  subcategory: 'Subcategory',
  stock: 'Stock',
  price: 'Price',
  supplier: 'Supplier'
};

const AddItemForm = ({ onAddItem, onCancel }: { onAddItem: (item: Omit<InventoryItem, 'id' | 'userId'>) => void; onCancel: () => void }) => {
  const [newItem, setNewItem] = useState<Omit<InventoryItem, 'id' | 'userId'>>({
    name: "",
    category: "",
    subcategory: "",
    stock: 0,
    price: 0,
    supplier: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setNewItem((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddItem(newItem);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="name" className="text-right">Name</Label>
          <Input id="name" name="name" value={newItem.name} onChange={handleChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="category" className="text-right">Category</Label>
          <Input id="category" name="category" value={newItem.category} onChange={handleChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="subcategory" className="text-right">Subcategory</Label>
          <Input id="subcategory" name="subcategory" value={newItem.subcategory} onChange={handleChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="stock" className="text-right">Stock</Label>
          <Input id="stock" name="stock" type="number" value={newItem.stock} onChange={handleChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="price" className="text-right">Price</Label>
          <Input id="price" name="price" type="number" value={newItem.price} onChange={handleChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="supplier" className="text-right">Supplier</Label>
          <Input id="supplier" name="supplier" value={newItem.supplier} onChange={handleChange} className="col-span-3" />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Add Item</Button>
      </DialogFooter>
    </form>
  );
};


export default function InventoryPage() {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [columns, setColumns] = useState<Record<string, string>>(COLUMN_NAMES);

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    id: false,
    name: true,
    category: true,
    subcategory: true,
    stock: true,
    price: true,
    supplier: true,
  });
  
  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    if (!user) {
        setItems(inventoryData);
        setIsLoading(false);
        return;
    }
    try {
      const q = query(collection(db, "inventory"), where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const inventoryList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setItems(inventoryList);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch inventory items." });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);
  
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);
  

  useEffect(() => {
    const savedVisibility = localStorage.getItem("inventoryColumnVisibility");
    if (savedVisibility) {
      setColumnVisibility(JSON.parse(savedVisibility));
    }
  }, []);
  
  useEffect(() => {
    localStorage.setItem("inventoryColumnVisibility", JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  const handleColumnVisibilityChange = (key: string, checked: boolean) => {
    setColumnVisibility(prev => ({ ...prev, [key]: checked }));
  };
  
  const visibleColumns = Object.keys(columns).filter(key => columnVisibility[key as keyof ColumnKeys]);


  const handleAddItem = async (item: Omit<InventoryItem, 'id' | 'userId'>) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to add an item.'})
        return;
    }
    try {
      const docRef = await addDoc(collection(db, "inventory"), { ...item, userId: user.uid });
      setItems(prev => [{ ...item, userId: user.uid, id: docRef.id }, ...prev]);
      setAddModalOpen(false);
      toast({ title: "Success", description: "New item added to inventory." });
    } catch (error) {
      console.error("Error adding item:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not add item." });
    }
  };
  
  const handleDeleteItem = useCallback(async (itemId: string) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to delete an item.'})
        return;
    }
    try {
      await deleteDoc(doc(db, "inventory", itemId));
      setItems(prev => prev.filter(item => item.id !== itemId));
      toast({ title: "Success", description: "Item removed from inventory." });
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not delete item." });
    }
  }, [user, toast]);

  const handleItemChange = async (itemId: string, field: keyof Omit<InventoryItem, 'id' | 'userId'>, value: string | number) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
    
    if (!user) return; // Don't save changes for guest users

    try {
        const itemRef = doc(db, "inventory", itemId);
        await updateDoc(itemRef, { [field]: value });
    } catch (error) {
        console.error("Error updating item:", error);
        toast({ variant: "destructive", title: "Error", description: `Failed to update ${field}.`});
        // Optionally revert UI change
        fetchItems();
    }
  };

  const handleExport = () => {
    const headers = visibleColumns;
    const csvContent = [
      headers.map(h => columns[h]).join(','),
      ...items.map(item => headers.map(headerKey => {
        const value = item[headerKey as keyof ColumnKeys];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.href) {
      URL.revokeObjectURL(link.href);
    }
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'inventory.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Success", description: "Inventory exported successfully." });
  };
  
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to import items.'})
        return;
    };
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const rows = text.split('\n').filter(row => row.trim() !== '').slice(1); // Skip header
        
        if (rows.length === 0) {
          toast({ variant: "destructive", title: "Error", description: "CSV file is empty or has no data rows." });
          return;
        }

        const batch = writeBatch(db);
        const newItems: InventoryItem[] = [];

        rows.forEach(row => {
          const [name, category, subcategory, stock, price, supplier] = row.split(',');
          const newItemData: Omit<InventoryItem, 'id'> = {
            name: name?.trim() || '',
            category: category?.trim() || '',
            subcategory: subcategory?.trim() || '',
            stock: Number(stock) || 0,
            price: Number(price) || 0,
            supplier: supplier?.trim() || '',
            userId: user.uid,
          };
          const docRef = doc(collection(db, "inventory"));
          batch.set(docRef, newItemData);
          newItems.push({ ...newItemData, id: docRef.id });
        });

        await batch.commit();

        setItems(prev => [...newItems, ...prev]);
        setImportModalOpen(false);
        toast({ title: "Success", description: "Inventory imported successfully." });
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message || "Failed to parse and import CSV file." });
      }
    };
    reader.readAsText(file);
  };
  
  const openImportDialog = () => {
      setImportModalOpen(true);
  }

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold font-headline">Inventory</h1>
          <p className="text-muted-foreground">Manage your stock items.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openImportDialog}><FileUp className="mr-2" /> Import</Button>
          <Button variant="outline" onClick={handleExport}><FileDown className="mr-2" /> Export</Button>
          <Button onClick={() => setAddModalOpen(true)}><PlusCircle className="mr-2" /> Add Item</Button>
        </div>
      </div>
       <Dialog open={isAddModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
            <DialogDescription>Enter the details of the new inventory item.</DialogDescription>
          </DialogHeader>
          <AddItemForm onAddItem={handleAddItem} onCancel={() => setAddModalOpen(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={isImportModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Inventory</DialogTitle>
            <DialogDescription>Upload a CSV file to add items to your inventory.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input type="file" accept=".csv" ref={fileInputRef} onChange={handleImport} />
            <p className="text-sm text-muted-foreground mt-2">
                CSV headers must be: name, category, subcategory, stock, price, supplier
            </p>
          </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setImportModalOpen(false)}>Cancel</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Stock Items</CardTitle>
                    <CardDescription>Here is a list of all your items.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search items..." className="pl-8 w-64" />
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
                        {Object.keys(columns).map((key) => (
                          <DropdownMenuCheckboxItem
                            key={key}
                            className="capitalize"
                            checked={columnVisibility[key as keyof ColumnKeys]}
                            onCheckedChange={(checked) =>
                              handleColumnVisibilityChange(key, !!checked)
                            }
                          >
                            {columns[key as keyof ColumnKeys]}
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
                  <TableHead key={key}>{columns[key]}</TableHead>
                ))}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="h-24 text-center">
                    No items found. Get started by adding a new item.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    {visibleColumns.map((key) => (
                      <TableCell key={key} className={key === 'name' ? 'font-medium' : ''}>
                         {key === 'price' ? formatCurrency((item as any)[key]) : (item as any)[key]}
                      </TableCell>
                    ))}
                      <TableCell>
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
                                  This action cannot be undone. This will permanently delete the item from your inventory.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteItem(item.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                      </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </MainLayout>
  );
}

    