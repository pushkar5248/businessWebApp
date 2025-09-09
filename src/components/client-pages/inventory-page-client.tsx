
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  DropdownMenuItem,
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
import { PlusCircle, FileDown, FileUp, Columns, Search, Trash2, Loader2, ArrowUpDown, Edit, Save, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrency } from "@/context/currency-context";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, deleteDoc, updateDoc, query, where, writeBatch, onSnapshot, getDocs } from "firebase/firestore";
import { useAuth } from "@/context/auth-context";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";


type ColumnKeys = Omit<InventoryItem, 'id' | 'userId'>;

const DEFAULT_COLUMN_NAMES: Record<string, string> = {
  name: 'Name',
  stock: 'Stock',
  price: 'Price',
  value: 'Value',
  hsnCode: 'HSN Code',
  unit: 'Unit'
};

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


export default function InventoryPageClient() {
  const { user } = useAuth();
  const { formatCurrency, formatCurrencyValue } = useCurrency();
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [originalItems, setOriginalItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isAddColumnModalOpen, setAddColumnModalOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  
  const getLocalStorageKey = useCallback((key: string) => {
    return user ? `inventory_${user.uid}_${key}` : `inventory_guest_${key}`;
  }, [user]);

  const [columns, setColumns] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return DEFAULT_COLUMN_NAMES;
    const saved = localStorage.getItem(getLocalStorageKey("columnNames"));
    return saved ? JSON.parse(saved) : DEFAULT_COLUMN_NAMES;
  });

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if(typeof window === 'undefined') return Object.keys(DEFAULT_COLUMN_NAMES);
    const saved = localStorage.getItem(getLocalStorageKey("columnOrder"));
    return saved ? JSON.parse(saved) : Object.keys(DEFAULT_COLUMN_NAMES);
  });
  
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    const savedVisibility = localStorage.getItem(getLocalStorageKey("columnVisibility"));
    return savedVisibility ? JSON.parse(savedVisibility) : {
        name: true, stock: true, price: true, value: true, hsnCode: true, unit: true
    };
  });
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof ColumnKeys, direction: 'ascending' | 'descending' } | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<string | null>(null);
  const [columnToRename, setColumnToRename] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const unsubscribeRef = useRef<() => void | null>(null);

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
  

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const savedSortConfig = localStorage.getItem(getLocalStorageKey("sortConfig"));
        if (savedSortConfig) setSortConfig(JSON.parse(savedSortConfig));
    }
  }, [getLocalStorageKey]);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(getLocalStorageKey("columnVisibility"), JSON.stringify(columnVisibility));
    }
  }, [columnVisibility, getLocalStorageKey]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(getLocalStorageKey("columnOrder"), JSON.stringify(columnOrder));
    }
  }, [columnOrder, getLocalStorageKey]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(getLocalStorageKey("sortConfig"), JSON.stringify(sortConfig));
    }
  }, [sortConfig, getLocalStorageKey]);
  
   useEffect(() => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(getLocalStorageKey("columnNames"), JSON.stringify(columns));
    }
  }, [columns, getLocalStorageKey]);
  
  const allAvailableColumns = useMemo(() => {
    const columnKeys = new Set<string>();
    items.forEach(item => {
      Object.keys(item).forEach(key => columnKeys.add(key));
    });
    // Explicitly filter out 'id' and 'userId' here, but add our calculated 'value' column
    const baseKeys = Array.from(columnKeys).filter(key => key !== 'id' && key !== 'userId');
    return ['value', ...baseKeys];
  }, [items]);

  const handleColumnVisibilityChange = (key: string, checked: boolean) => {
    setColumnVisibility(prev => ({ ...prev, [key]: checked }));
  };
  
  const visibleColumns = useMemo(() => {
    return columnOrder.filter(key => columnVisibility[key as keyof ColumnKeys] && allAvailableColumns.includes(key));
  }, [columnOrder, columnVisibility, allAvailableColumns]);
  
  const requestSort = (key: keyof ColumnKeys | 'value') => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key: key as keyof ColumnKeys, direction });
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
      headers.map(h => columns[h]).join(','),
      ...sortedItems.map(item => headers.map(headerKey => {
        let value;
        if (headerKey === 'value') {
          value = item.stock * item.price;
        } else {
          value = item[headerKey as keyof ColumnKeys];
        }

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
                'name': { key: 'name', type: 'string' },
                'item name': { key: 'name', type: 'string' },
                'product name': { key: 'name', type: 'string' },
                'particulars': { key: 'name', type: 'string' },
                'price': { key: 'price', type: 'number' },
                'rate': { key: 'price', type: 'number' },
                'cost': { key: 'price', type: 'number' },
                'stock': { key: 'stock', type: 'number' },
                'quantity': { key: 'stock', type: 'number' },
                'qty': { key: 'stock', type: 'number' },
                'inventory': { key: 'stock', type: 'number' },
                'hsn code': { key: 'hsnCode', type: 'string'},
                'hsn': { key: 'hsnCode', type: 'string'},
                'hsncode': { key: 'hsnCode', type: 'string'},
                'tax code': { key: 'hsnCode', type: 'string'},
                'unit': { key: 'unit', type: 'string' },
                'units': { key: 'unit', type: 'string' },
            };

            const newColumns: { [key: string]: string } = {};
            const newColumnOrder: string[] = [];
            const csvToInternalKeyMap: { [csvHeader: string]: { key: string, type: 'string' | 'number' } } = {};

            const ignoredHeaders = ['category', 'subcategory', 'supplier'];

            headerRow.forEach(header => {
                const lowerHeader = header.toLowerCase();
                
                if (ignoredHeaders.includes(lowerHeader)) {
                    return; // Skip ignored headers
                }

                const standardMapping = synonymMapping[lowerHeader];
                
                let internalKey: string;
                let type: 'string' | 'number' = 'string';

                if (standardMapping) {
                    internalKey = standardMapping.key;
                    type = standardMapping.type;
                } else {
                    internalKey = `custom_${lowerHeader.replace(/\s+/g, '_')}`;
                }
                
                csvToInternalKeyMap[header] = { key: internalKey, type: type };
                if (!newColumns[internalKey]) {
                  newColumns[internalKey] = header; // Use original header for display
                }
                if (!newColumnOrder.includes(internalKey)) {
                  newColumnOrder.push(internalKey);
                }
            });

            // Ensure essential columns are always present
            for (const key of ['name', 'stock', 'price', 'hsnCode', 'unit']) {
                if (!newColumnOrder.includes(key)) {
                    newColumnOrder.unshift(key);
                    newColumns[key] = DEFAULT_COLUMN_NAMES[key] || key;
                }
            }
            
            setColumns(newColumns);
            setColumnOrder(newColumnOrder);
            const newVisibility = newColumnOrder.reduce((acc, key) => ({...acc, [key]: true}), {});
            setColumnVisibility(newVisibility);
            
            localStorage.setItem(getLocalStorageKey("columnNames"), JSON.stringify(newColumns));
            localStorage.setItem(getLocalStorageKey("columnOrder"), JSON.stringify(newColumnOrder));
            localStorage.setItem(getLocalStorageKey("columnVisibility"), JSON.stringify(newVisibility));


            const batch = writeBatch(db);
            
            for (const row of dataRows) {
                const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
                const newItemData: { [key: string]: any } = {};
                let itemName: string | null = null;
                
                headerRow.forEach((csvHeader, index) => {
                    const mapping = csvToInternalKeyMap[csvHeader];
                    const value = values[index];

                    if (mapping && value !== undefined) {
                        newItemData[mapping.key] = mapping.type === 'number' ? Number(value) || 0 : value || '';
                        if (mapping.key === 'name') {
                            itemName = value;
                        }
                    }
                });
                
                if (!itemName) {
                    continue; // Skip rows without a name
                };

                const existingItem = existingItemsMap.get(itemName.toLowerCase());
                
                if (existingItem) {
                    const itemRef = doc(db, "inventory", existingItem.id);
                    // Non-destructive update: only merge new fields
                    batch.set(itemRef, newItemData, { merge: true });
                } else {
                    const newDocRef = doc(collection(db, "inventory"));
                    newItemData.userId = user.uid;
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
            aValue = a[sortConfig.key];
            bValue = b[sortConfig.key];
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
  
  const confirmDeleteColumn = () => {
    if (!columnToDelete) return;
    setColumns(prev => {
        const newCols = { ...prev };
        delete newCols[columnToDelete];
        return newCols;
    });
    setColumnOrder(prev => prev.filter(key => key !== columnToDelete));
    setColumnVisibility(prev => {
        const newVis = { ...prev };
        delete newVis[columnToDelete];
        return newVis;
    });
    toast({ title: "Column Deleted", description: `Column "${columns[columnToDelete]}" has been deleted.` });
    setColumnToDelete(null);
  };
  
  const handleAddColumn = () => {
    if (!newColumnName.trim()) {
        toast({ variant: 'destructive', title: 'Error', description: 'Column name cannot be empty.'})
        return;
    }
    const newColumnKey = newColumnName.toLowerCase().replace(/\s+/g, '_');
    if (columns[newColumnKey]) {
        toast({ variant: 'destructive', title: 'Error', description: 'A column with this name already exists.'})
        return;
    }
    
    setColumns(prev => ({...prev, [newColumnKey]: newColumnName}));
    setColumnOrder(prev => [...prev, newColumnKey]);
    setColumnVisibility(prev => ({...prev, [newColumnKey]: true}));
    
    setItems(prev => prev.map(item => ({...item, [newColumnKey]: ''})));
    setOriginalItems(prev => prev.map(item => ({...item, [newColumnKey]: ''})));

    setNewColumnName('');
    setAddColumnModalOpen(false);
    toast({ title: 'Column Added', description: `Column "${newColumnName}" has been added.`});
  };

  const handleConfirmDelete = (itemIds: string[]) => {
    handleDeleteItems(itemIds);
  };
  
  const handleRenameColumn = (key: string) => {
    if (!renameValue.trim()) {
        toast({ variant: 'destructive', title: 'Error', description: 'Column name cannot be empty.'});
        return;
    }
    setColumns(prev => ({ ...prev, [key]: renameValue }));
    setColumnToRename(null);
    setRenameValue("");
  };

  const handleDragStart = (e: React.DragEvent<HTMLTableCellElement>, key: string) => {
    setDraggedColumn(key);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.preventDefault();
  };
  
  const handleDrop = (e: React.DragEvent<HTMLTableCellElement>, dropKey: string) => {
    e.preventDefault();
    if (draggedColumn) {
      const newColumnOrder = [...columnOrder];
      const dragIndex = newColumnOrder.indexOf(draggedColumn);
      const dropIndex = newColumnOrder.indexOf(dropKey);
      
      const [removed] = newColumnOrder.splice(dragIndex, 1);
      newColumnOrder.splice(dropIndex, 0, removed);
      
      setColumnOrder(newColumnOrder);
      setDraggedColumn(null);
    }
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
                Make sure your CSV file has a 'name' or 'particulars' column to identify items.
            </p>
          </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setImportModalOpen(false)}>Cancel</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isAddColumnModalOpen} onOpenChange={setAddColumnModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Column</DialogTitle>
            <DialogDescription>Enter a name for your new custom column.</DialogDescription>
          </DialogHeader>
           <div className="grid gap-4 py-4">
               <div className="grid grid-cols-4 items-center gap-4">
                   <Label htmlFor="new-column-name" className="text-right">Name</Label>
                   <Input 
                        id="new-column-name" 
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        className="col-span-3"
                    />
               </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => { setAddColumnModalOpen(false); setNewColumnName(''); }}>Cancel</Button>
             <Button onClick={handleAddColumn}>Add Column</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
        <AlertDialog open={!!columnToDelete} onOpenChange={(open) => !open && setColumnToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the 
                        <strong> &quot;{columnToDelete && columns[columnToDelete]}&quot; </strong> 
                        column and all its associated settings. The data will remain in your database but will be hidden.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setColumnToDelete(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteColumn}>Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
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
                      <DropdownMenuContent align="end" className="w-[250px]">
                        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {Object.keys(columns).map((key) => (
                           <DropdownMenuItem key={key} className="p-0" onSelect={(e) => e.preventDefault()}>
                             <label className="flex items-center gap-2 w-full h-full p-2 cursor-pointer">
                               <Checkbox
                                 checked={columnVisibility[key]}
                                 onCheckedChange={(checked) => handleColumnVisibilityChange(key, !!checked)}
                                 className="mr-2"
                               />
                               <span className="flex-1">{columns[key] || key}</span>
                               <Button
                                 variant="ghost"
                                 size="icon"
                                 className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setColumnToDelete(key);
                                 }}
                               >
                                 <X className="h-4 w-4" />
                               </Button>
                             </label>
                           </DropdownMenuItem>
                        ))}
                         <DropdownMenuSeparator />
                         <DropdownMenuItem onSelect={() => setAddColumnModalOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Custom Column
                         </DropdownMenuItem>
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
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="p-0 h-12">
                  <div className="flex items-center justify-center h-full px-4" suppressHydrationWarning>
                     <Checkbox
                        checked={selectedRows.length > 0 && sortedItems.length > 0 && selectedRows.length === sortedItems.length}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                      />
                  </div>
                </TableHead>
                {visibleColumns.map((key) => (
                  <TableHead
                    key={key}
                    className="h-12 px-4 cursor-move"
                    draggable
                    onDragStart={(e) => handleDragStart(e, key)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, key)}
                  >
                    <div className="flex items-center justify-between" suppressHydrationWarning>
                     {columnToRename === key ? (
                        <div className="flex items-center gap-1">
                          <Input 
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => handleRenameColumn(key)}
                            onKeyDown={(e) => { if(e.key === 'Enter') handleRenameColumn(key) }}
                            autoFocus
                            className="h-8"
                          />
                        </div>
                      ) : (
                        <span className="font-medium flex-1 cursor-pointer" onClick={() => { setColumnToRename(key); setRenameValue(columns[key]); }}>{columns[key] || key}</span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 ml-2"
                        onClick={() => requestSort(key as keyof ColumnKeys | 'value')}
                      >
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableHead>
                ))}
                <TableHead className="h-12 px-4"/>
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
                        ) : ['name', 'hsnCode', 'unit'].includes(key) ? (
                             <Input
                                type="text"
                                value={item[key as keyof typeof item]}
                                onChange={(e) => handleItemChange(item.id, key as keyof ColumnKeys, e.target.value)}
                                className={cn(!isEditMode && "border-none bg-transparent disabled:cursor-text disabled:opacity-100")}
                                disabled={!isEditMode || !user}
                            />
                        ) : (
                            <Input
                                type="text"
                                value={(item as any)[key] ?? ''}
                                onChange={(e) => handleItemChange(item.id, key as keyof ColumnKeys, e.target.value)}
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
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
