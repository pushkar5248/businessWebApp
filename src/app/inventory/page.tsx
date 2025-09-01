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
import { inventoryData as initialInventoryData, type InventoryItem } from "@/lib/data";
import { PlusCircle, FileDown, FileUp, Columns, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrency } from "@/context/currency-context";
import { useToast } from "@/hooks/use-toast";


type ColumnKeys = keyof InventoryItem;

const COLUMN_NAMES: Record<ColumnKeys, string> = {
  id: 'Item ID',
  name: 'Name',
  category: 'Category',
  subcategory: 'Subcategory',
  stock: 'Stock',
  price: 'Price',
  supplier: 'Supplier'
};

const AddItemForm = ({ onAddItem, onCancel }: { onAddItem: (item: InventoryItem) => void; onCancel: () => void }) => {
  const [newItem, setNewItem] = useState<Omit<InventoryItem, 'id'>>({
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
    const fullItem = { ...newItem, id: `ITM${Date.now().toString().slice(-6)}` };
    onAddItem(fullItem);
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
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>(initialInventoryData);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [columns, setColumns] = useState<Record<string, string>>(COLUMN_NAMES);

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    id: true,
    name: true,
    category: true,
    subcategory: true,
    stock: true,
    price: true,
    supplier: true,
  });

  useEffect(() => {
    const savedVisibility = localStorage.getItem("inventoryColumnVisibility");
    if (savedVisibility) {
      setColumnVisibility(JSON.parse(savedVisibility));
    }
  }, []);
  
  useEffect(() => {
    if (items.length > 0) {
      const firstItemKeys = Object.keys(items[0]);
      const newColumns = firstItemKeys.reduce((acc, key) => {
        acc[key] = COLUMN_NAMES[key as ColumnKeys] || key.charAt(0).toUpperCase() + key.slice(1);
        return acc;
      }, {} as Record<string,string>);
      setColumns(newColumns);
      
      const newVisibility = { ...columnVisibility };
      let visibilityChanged = false;
      Object.keys(newColumns).forEach(key => {
        if (newVisibility[key] === undefined) {
          newVisibility[key] = true;
          visibilityChanged = true;
        }
      });
      if(visibilityChanged) {
        setColumnVisibility(newVisibility);
        localStorage.setItem("inventoryColumnVisibility", JSON.stringify(newVisibility));
      }
    }
  }, [items, columnVisibility]);

  const handleColumnVisibilityChange = (key: string, checked: boolean) => {
    const newVisibility = { ...columnVisibility, [key]: checked };
    setColumnVisibility(newVisibility);
    localStorage.setItem("inventoryColumnVisibility", JSON.stringify(newVisibility));
  };
  
  const visibleColumns = Object.keys(columns).filter(key => columnVisibility[key]);


  const handleAddItem = (item: InventoryItem) => {
    setItems(prev => [item, ...prev]);
    setAddModalOpen(false);
    toast({ title: "Success", description: "New item added to inventory." });
  };
  
  const handleDeleteItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
    toast({ title: "Success", description: "Item removed from inventory." });
  }, []);

  const handleItemChange = (itemId: string, field: keyof Omit<InventoryItem, 'id'>, value: string | number) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const handleExport = () => {
    const headers = visibleColumns;
    const csvContent = [
      headers.map(h => columns[h]).join(','),
      ...items.map(item => headers.map(headerKey => {
        const value = item[headerKey as keyof InventoryItem];
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
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = text.split('\n').filter(row => row.trim() !== '');
        const headerRow = rows.shift()?.trim().split(',') as string[];
        
        if (!headerRow) {
             toast({ variant: "destructive", title: "Error", description: "Invalid CSV file: Missing headers." });
            return;
        }
        
        const headerKeys = headerRow.map(h => {
          const foundKey = (Object.keys(COLUMN_NAMES) as ColumnKeys[]).find(key => COLUMN_NAMES[key].toLowerCase() === h.trim().toLowerCase());
          return foundKey || h.trim().toLowerCase().replace(/\s+/g, '_');
        });

        const newItems = rows.map((row, rowIndex) => {
            const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
            const item = headerKeys.reduce((obj, header, index) => {
              const value = values[index];
              const numericHeaders = ['stock', 'price'];
              if(numericHeaders.includes(header)) {
                  (obj as any)[header] = Number(value) || 0;
              } else {
                  (obj as any)[header] = value;
              }
            return obj;
          }, {} as any);
          if(!item.id) {
            item.id = `ITM${Date.now().toString().slice(-6)}${rowIndex}`;
          }
          return item;
        });

        setItems(prev => [...newItems, ...prev]);
        setImportModalOpen(false);
        toast({ title: "Success", description: "Inventory imported successfully." });
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message || "Failed to parse CSV file." });
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
                Make sure your CSV has headers: {Object.values(COLUMN_NAMES).join(', ')}
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
                            checked={columnVisibility[key]}
                            onCheckedChange={(checked) =>
                              handleColumnVisibilityChange(key, !!checked)
                            }
                          >
                            {columns[key]}
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
              {items.map((item) => (
                <TableRow key={item.id}>
                  {visibleColumns.map((key) => (
                    <TableCell key={key} className={key === 'name' ? 'font-medium' : ''}>
                      {key === 'id' ? (
                        item.id
                      ) : (
                        <Input
                          type={typeof (item as any)[key] === 'number' ? 'number' : 'text'}
                          value={(item as any)[key]}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              key as keyof Omit<InventoryItem, 'id'>,
                              e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                            )
                          }
                          className="border-none bg-transparent focus:ring-0"
                        />
                      )}
                    </TableCell>
                  ))}
                    <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </MainLayout>
  );
}