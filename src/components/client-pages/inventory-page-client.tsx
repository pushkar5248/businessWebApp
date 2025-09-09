
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
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
import { type InventoryItem } from "@/lib/types";
import { inventoryData } from "@/lib/data";
import { PlusCircle, FileDown, FileUp, Columns, Search, Trash2, Loader2, ArrowUpDown, Edit, Save, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrency } from "@/context/currency-context";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, deleteDoc, updateDoc, query, where, writeBatch, onSnapshot, getDocs } from "firebase/firestore";
import { useAuth } from "@/context/auth-context";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";


const AddItemForm = ({ onAddItem, onCancel }: { onAddItem: (item: Omit<InventoryItem, 'id' | 'userId'>) => void; onCancel: () => void }) => {
  const [newItem, setNewItem] = useState<Omit<InventoryItem, 'id' | 'userId'>>({
    name: "",
    stock: 0,
    price: 0,
    hsnCode: "",
    unit: "",
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
          <Label htmlFor="hsnCode" className="text-right">HSN Code</Label>
          <Input id="hsnCode" name="hsnCode" value={newItem.hsnCode} onChange={handleChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="unit" className="text-right">Unit</Label>
          <Input id="unit" name="unit" value={newItem.unit} onChange={handleChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="stock" className="text-right">Stock</Label>
          <Input id="stock" name="stock" type="number" value={newItem.stock} onChange={handleChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="price" className="text-right">Price</Label>
          <Input id="price" name="price" type="number" value={newItem.price} onChange={handleChange} className="col-span-3" />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Add Item</Button>
      </DialogFooter>
    </form>
  );
};

const DEFAULT_COLUMN_NAMES: Record<string, string> = {
  name: 'Name',
  stock: 'Stock',
  price: 'Price',
  value: 'Value',
  hsnCode: 'HSN Code',
  unit: 'Unit'
};


export default function InventoryPageClient() {
  const { user } = useAuth();
  const { formatCurrency, formatCurrencyValue } = useCurrency();
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [originalItems, setOriginalItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
     name: true,
     stock: true,
     price: true,
     value: true,
     hsnCode: true,
     unit: true
  });
  
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'ascending' | 'descending' } | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const unsubscribeRef = useRef<() => void | null>(null);

  const [columnOrder, setColumnOrder] = useState<string[]>(Object.keys(DEFAULT_COLUMN_NAMES));
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const resizingColumn = useRef<string | null>(null);

  useEffect(() => {
    const savedOrder = localStorage.getItem('inventoryColumnOrder');
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder);
        // Ensure all default columns are present
        const defaultKeys = Object.keys(DEFAULT_COLUMN_NAMES);
        const allKeys = [...new Set([...parsedOrder, ...defaultKeys])];
        setColumnOrder(allKeys);
      } catch (e) {
        setColumnOrder(Object.keys(DEFAULT_COLUMN_NAMES));
      }
    }
    const savedWidths = localStorage.getItem('inventoryColumnWidths');
    if (savedWidths) {
       try {
        setColumnWidths(JSON.parse(savedWidths));
       } catch (e) {
        // ignore
       }
    }
     const savedVisibility = localStorage.getItem('inventoryColumnVisibility');
    if (savedVisibility) {
        try {
            const parsedVisibility = JSON.parse(savedVisibility);
            setColumnVisibility(prev => ({...prev, ...parsedVisibility}));
        } catch(e) {
            // ignore
        }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('inventoryColumnOrder', JSON.stringify(columnOrder));
  }, [columnOrder]);
  
  useEffect(() => {
    localStorage.setItem('inventoryColumnWidths', JSON.stringify(columnWidths));
  }, [columnWidths]);

  useEffect(() => {
    localStorage.setItem('inventoryColumnVisibility', JSON.stringify(columnVisibility));
  }, [columnVisibility]);
  
  const setupRealtimeListener = useCallback(() => {
    if (!user) return null;

    if (unsubscribeRef.current) {
        unsubscribeRef.current();
    }
    
    const q = query(collection(db, "inventory"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const inventoryList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
        setItems(inventoryList);
        setOriginalItems(JSON.parse(JSON.stringify(inventoryList)));
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching inventory:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch inventory items." });
        setIsLoading(false);
    });

    unsubscribeRef.current = unsubscribe;
    return unsubscribe;
  }, [user, toast]);
  
  const fetchAndSetData = useCallback(async () => {
    if (!user) {
      const guestData = inventoryData.map(item => ({...item, id: item.id || `GUEST_${Math.random().toString(36).substr(2, 9)}`}));
      setItems(guestData);
      setOriginalItems(JSON.parse(JSON.stringify(guestData)));
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    const q = query(collection(db, "inventory"), where("userId", "==", user.uid));
    const querySnapshot = await getDocs(q);
    const inventoryList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
    setItems(inventoryList);
    setOriginalItems(JSON.parse(JSON.stringify(inventoryList)));
    setIsLoading(false);
  }, [user]);


  useEffect(() => {
    setIsLoading(true);
    if (!user) {
        const guestData = inventoryData.map(item => ({...item, id: item.id || `GUEST_${Math.random().toString(36).substr(2, 9)}`}));
        setItems(guestData);
        setOriginalItems(JSON.parse(JSON.stringify(guestData)));
        setIsLoading(false);
        return;
    }
    
    const unsubscribe = setupRealtimeListener();

    return () => {
        if (unsubscribe) {
            unsubscribe();
        }
    }
  }, [user, setupRealtimeListener]);
  
  const handleColumnVisibilityChange = (key: string, checked: boolean) => {
    setColumnVisibility(prev => ({ ...prev, [key]: checked }));
  };
  
  const visibleColumns = useMemo(() => {
    return columnOrder.filter(key => columnVisibility[key as keyof typeof columnVisibility]);
  }, [columnOrder, columnVisibility]);
  
  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };


  const handleAddItem = async (item: Omit<InventoryItem, 'id' | 'userId'>) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to add an item.'})
        return;
    }
    try {
      await addDoc(collection(db, "inventory"), { ...item, userId: user.uid });
      setAddModalOpen(false);
      toast({ title: "Success", description: "New item added to inventory." });
    } catch (error) {
      console.error("Error adding item:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not add item." });
    }
  };
  
  const handleDeleteItems = async (itemIds: string[]) => {
    if (!user) {
        setItems(prev => prev.filter(item => !itemIds.includes(item.id)));
        setSelectedRows([]);
        toast({ title: "Success", description: `${itemIds.length} item(s) removed.` });
        return;
    }
    try {
      const batch = writeBatch(db);
      itemIds.forEach(id => {
        const docRef = doc(db, "inventory", id);
        batch.delete(docRef);
      });
      await batch.commit();

      setSelectedRows([]);
      toast({ title: "Success", description: `${itemIds.length} item(s) removed from inventory.` });
    } catch (error) {
      console.error("Error deleting items:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not delete items." });
    }
  };

 const handleItemChange = (itemId: string, field: keyof Omit<InventoryItem, 'id' | 'userId'>, value: string | number) => {
    setItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
    ));
};

const handleSaveChanges = async () => {
    if (!user) return;

    const batch = writeBatch(db);
    let changesCount = 0;
    
    items.forEach(currentItem => {
      const originalItem = originalItems.find(item => item.id === currentItem.id);
      if (originalItem && JSON.stringify(currentItem) !== JSON.stringify(originalItem)) {
        const { id, userId, ...itemData } = currentItem;
        const itemRef = doc(db, "inventory", id);
        batch.update(itemRef, itemData);
        changesCount++;
      }
    });

    if (changesCount === 0) {
      toast({ title: "No Changes", description: "No items were modified." });
      setIsEditMode(false);
      return;
    }

    try {
      await batch.commit();
      toast({ title: "Success", description: `${changesCount} item(s) updated successfully.` });
    } catch (error) {
      console.error("Error updating items:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save changes." });
    } finally {
      setIsEditMode(false);
    }
};

  const handleExport = () => {
    const headers = visibleColumns;
    const csvContent = [
      headers.map(h => DEFAULT_COLUMN_NAMES[h]).join(','),
      ...sortedItems.map(item => headers.map(headerKey => {
        let value;
        if (headerKey === 'value') {
          value = item.stock * item.price;
        } else {
          value = item[headerKey as keyof InventoryItem];
        }

        const valueStr = String(value ?? '');
        if (valueStr.includes(',')) {
          return `"${valueStr}"`;
        }
        return valueStr;
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
  
 const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to import items.'})
        return;
    };
    const file = event.target.files?.[0];
    if (!file) return;

    if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
    }
    
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const text = e.target?.result as string;
            const allRows = text.split('\n').filter(row => row.trim() !== '');
            if (allRows.length <= 1) {
                toast({ variant: "destructive", title: "Error", description: "CSV file is empty or has no data rows." });
                setIsLoading(false);
                setupRealtimeListener();
                return;
            }
            
            const headerRow = allRows[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const dataRows = allRows.slice(1);
            
            const existingItemsSnapshot = await getDocs(query(collection(db, "inventory"), where("userId", "==", user.uid)));
            const existingItemsMap = new Map(existingItemsSnapshot.docs.map(doc => [doc.data().name.toLowerCase(), { id: doc.id, data: doc.data() }]));

            const synonymMapping: { [key: string]: { key: keyof InventoryItem, type: 'string' | 'number' } } = {
                'name': { key: 'name', type: 'string' }, 'item name': { key: 'name', type: 'string' }, 'product name': { key: 'name', type: 'string' }, 'particulars': { key: 'name', type: 'string' }, 'item': { key: 'name', type: 'string' }, 'product': { key: 'name', type: 'string' }, 'description': { key: 'name', type: 'string' },
                'stock': { key: 'stock', type: 'number' }, 'quantity': { key: 'stock', type: 'number' }, 'qty': { key: 'stock', type: 'number' }, 'in stock': { key: 'stock', type: 'number' }, 'on hand': { key: 'stock', type: 'number' }, 'inventory': { key: 'stock', type: 'number' }, 'bal qty': { key: 'stock', type: 'number' },
                'price': { key: 'price', type: 'number' }, 'rate': { key: 'price', type: 'number' }, 'cost': { key: 'price', type: 'number' }, 'unit price': { key: 'price', type: 'number' }, 'mrp': { key: 'price', type: 'number' }, 'sale price': { key: 'price', type: 'number' }, 'purchase price': { key: 'price', type: 'number' },
                'hsn code': { key: 'hsnCode', type: 'string'}, 'hsn-code': { key: 'hsnCode', type: 'string'}, 'hsn': { key: 'hsnCode', type: 'string'}, 'tax code': { key: 'hsnCode', type: 'string'}, 'sac': { key: 'hsnCode', type: 'string'}, 'sac code': { key: 'hsnCode', type: 'string'}, 'hsn_code': { key: 'hsnCode', type: 'string'},
                'unit': { key: 'unit', type: 'string' }, 'units': { key: 'unit', type: 'string' }, 'uom': { key: 'unit', type: 'string' }, 'measurement': { key: 'unit', type: 'string' }, 'per': { key: 'unit', type: 'string' },
            };

            const headerMap: { [key: string]: number } = {};
            headerRow.forEach((header, index) => {
                const normalizedHeader = header.toLowerCase().replace(/[\s_]/g, ' ').trim();
                const mapping = synonymMapping[normalizedHeader];
                if (mapping) {
                    headerMap[mapping.key] = index;
                }
            });
            
            if (!headerMap.hasOwnProperty('name')) {
                toast({ variant: "destructive", title: "Import Error", description: "CSV must contain a 'Name' column (or a synonym like 'Item Name')." });
                setIsLoading(false);
                setupRealtimeListener();
                return;
            }


            const batch = writeBatch(db);
            
            for (const row of dataRows) {
                const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
                
                const itemName = values[headerMap['name']];
                if (!itemName) continue;

                const newItemData: Partial<InventoryItem> = {
                    name: itemName,
                    price: Number(values[headerMap['price']]) || 0,
                    stock: Number(values[headerMap['stock']]) || 0,
                    hsnCode: values[headerMap['hsnCode']] || '',
                    unit: values[headerMap['unit']] || '',
                    userId: user.uid,
                };
                
                const existingItem = existingItemsMap.get(itemName.toLowerCase());
                
                if (existingItem) {
                    const itemRef = doc(db, "inventory", existingItem.id);
                    batch.set(itemRef, newItemData, { merge: true });
                } else {
                    const newDocRef = doc(collection(db, "inventory"));
                    batch.set(newDocRef, newItemData);
                }
            }
            
            await batch.commit();
            toast({ title: "Success", description: `Successfully imported/updated ${dataRows.length} items.` });

        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to parse and import CSV file." });
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            setImportModalOpen(false);
            await fetchAndSetData();
            setupRealtimeListener();
        }
    };
    reader.readAsText(file);
};
  
  const openImportDialog = () => {
      setImportModalOpen(true);
  }

  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (searchTerm) {
      sortableItems = sortableItems.filter(item =>
        Object.values(item).some(val =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;

        if (sortConfig.key === 'value') {
            aValue = a.price * a.stock;
            bValue = b.price * b.stock;
        } else {
            aValue = a[sortConfig.key as keyof InventoryItem];
            bValue = b[sortConfig.key as keyof InventoryItem];
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig, searchTerm]);

  const totalInventoryValue = useMemo(() => {
    return sortedItems.reduce((acc, item) => acc + (item.stock * item.price), 0);
  }, [sortedItems]);

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedRows(sortedItems.map(item => item.id));
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

  const handleConfirmDelete = (itemIds: string[]) => {
    handleDeleteItems(itemIds);
  };
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, columnKey: string) => {
    dragItem.current = columnKey;
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLTableCellElement>, columnKey: string) => {
    dragOverItem.current = columnKey;
  };
  
  const handleDragEnd = () => {
    if (dragItem.current && dragOverItem.current && dragItem.current !== dragOverItem.current) {
        const newColumnOrder = [...columnOrder];
        const dragItemIndex = newColumnOrder.indexOf(dragItem.current);
        const dragOverItemIndex = newColumnOrder.indexOf(dragOverItem.current);
        
        const [removed] = newColumnOrder.splice(dragItemIndex, 1);
        newColumnOrder.splice(dragOverItemIndex, 0, removed);
        
        setColumnOrder(newColumnOrder);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };
  
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const th = (e.target as HTMLElement).closest('th');
    if (!th) return;

    resizingColumn.current = th.dataset.columnKey as string;
    startX.current = e.clientX;
    startWidth.current = th.offsetWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
        if (!resizingColumn.current) return;
        const diffX = moveEvent.clientX - startX.current;
        const newWidth = startWidth.current + diffX;
        if (newWidth > 50) { // Minimum width
            setColumnWidths(prev => ({
                ...prev,
                [resizingColumn.current!]: newWidth
            }));
        }
    };

    const onMouseUp = () => {
        resizingColumn.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold font-headline">Inventory</h1>
          <p className="text-muted-foreground">Manage your stock items.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openImportDialog} disabled={!user}><FileUp className="mr-2" /> Import</Button>
          <Button variant="outline" onClick={handleExport}><FileDown className="mr-2" /> Export</Button>
          <Button onClick={() => setAddModalOpen(true)} disabled={!user}><PlusCircle className="mr-2" /> Add Item</Button>
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
            <DialogDescription>Upload a CSV file. Existing items with the same name will be updated. New items will be added.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input type="file" accept=".csv" ref={fileInputRef} onChange={handleImport} />
             <p className="text-sm text-muted-foreground mt-2">
                Your CSV must contain a 'Name' column. Other supported columns are HSN, Unit, Stock, and Price (or their synonyms). Other columns will be ignored.
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
                     <Button onClick={handleEditToggle} disabled={!user}>
                        {isEditMode ? <Save className="mr-2" /> : <Edit className="mr-2" />}
                        {isEditMode ? 'Save Changes' : 'Edit Items'}
                    </Button>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search items..." className="pl-8 w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
                        {Object.keys(DEFAULT_COLUMN_NAMES).map((key) => (
                           <DropdownMenuCheckboxItem
                            key={key}
                            className="capitalize"
                            checked={columnVisibility[key]}
                            onCheckedChange={(value) => handleColumnVisibilityChange(key, !!value)}
                          >
                            {DEFAULT_COLUMN_NAMES[key]}
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
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Selected
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the selected {selectedRows.length} items.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleConfirmDelete(selectedRows)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-12 px-4">
                       <Checkbox
                          checked={selectedRows.length > 0 && sortedItems.length > 0 && selectedRows.length === sortedItems.length}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all"
                        />
                  </TableHead>
                  {visibleColumns.map((key) => (
                    <TableHead
                      key={key}
                      className="p-0 h-12 relative select-none border-x"
                      onDragEnter={(e) => handleDragEnter(e, key)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      style={{ width: columnWidths[key] ? `${columnWidths[key]}px` : 'auto' }}
                      data-column-key={key}
                    >
                      <div className="flex items-center justify-center gap-2 px-4 h-full" suppressHydrationWarning>
                         <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, key)}
                            className="cursor-grab"
                          >
                           <GripVertical className="h-4 w-4 text-muted-foreground" />
                         </div>
                        <span className="font-medium">{DEFAULT_COLUMN_NAMES[key] || key}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                           onClick={() => requestSort(key)}
                        >
                          <ArrowUpDown className="h-4 w-4" />
                        </Button>
                      </div>
                       <div
                            onMouseDown={handleMouseDown}
                            className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                        />
                    </TableHead>
                  ))}
                  <TableHead className="w-12 px-4 border-l"/>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.length + 2} className="h-24 text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                  </TableRow>
                ) : sortedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.length + 2} className="h-24 text-center">
                      No items found. Get started by adding a new item.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedItems.map((item) => (
                    <TableRow key={item.id} data-state={selectedRows.includes(item.id) && "selected"}>
                      <TableCell>
                         <Checkbox
                            checked={selectedRows.includes(item.id)}
                            onCheckedChange={(checked) => handleRowSelect(item.id, !!checked)}
                            aria-label={`Select item ${item.name}`}
                          />
                      </TableCell>
                      {visibleColumns.map((key) => (
                        <TableCell key={key}>
                           {key === 'price' ? (
                             <div className="flex items-center gap-2">
                              <span>{formatCurrencyValue(0).charAt(0)}</span>
                              <Input
                                  type="number"
                                  value={item.price}
                                  onChange={(e) => handleItemChange(item.id, 'price', Number(e.target.value))}
                                  className={cn("w-24", !isEditMode && "border-none bg-transparent disabled:cursor-text disabled:opacity-100")}
                                  disabled={!isEditMode || !user}
                              />
                             </div>
                          ) : key === 'value' ? (
                              formatCurrency(item.stock * item.price)
                          ) : key === 'stock' ? (
                              <Input
                                  type="number"
                                  value={item.stock}
                                  onChange={(e) => handleItemChange(item.id, 'stock', Number(e.target.value))}
                                  className={cn("w-20", !isEditMode && "border-none bg-transparent disabled:cursor-text disabled:opacity-100")}
                                  disabled={!isEditMode || !user}
                              />
                          ) : (
                               <Input
                                  type="text"
                                  value={item[key as keyof typeof item]}
                                  onChange={(e) => handleItemChange(item.id, key as keyof Omit<InventoryItem, 'id'|'userId'>, e.target.value)}
                                  className={cn(!isEditMode && "border-none bg-transparent disabled:cursor-text disabled:opacity-100")}
                                  disabled={!isEditMode || !user}
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
                                  <AlertDialogAction onClick={() => handleConfirmDelete([item.id])}>
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
              <TableFooter>
                  <TableRow>
                      <TableCell colSpan={visibleColumns.indexOf('value') > -1 ? visibleColumns.indexOf('value') + 1 : visibleColumns.length + 1} className="text-right font-bold text-lg">
                          Grand Total
                      </TableCell>
                      {visibleColumns.includes('value') && (
                          <TableCell className="text-left font-bold text-lg">
                              {formatCurrency(totalInventoryValue)}
                          </TableCell>
                      )}
                      <TableCell colSpan={visibleColumns.includes('value') ? visibleColumns.length - visibleColumns.indexOf('value') -1 : 0}>
                      </TableCell>
                  </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
