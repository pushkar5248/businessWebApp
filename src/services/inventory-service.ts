
import { db } from "@/lib/firebase";
import { LineItem } from "@/lib/types";
import { doc, getDoc, updateDoc, writeBatch, collection, query, where, getDocs, addDoc, increment } from "firebase/firestore";

/**
 * Updates the stock level of inventory items when a sale is made.
 * It decrements the stock for each item in the sale.
 * @param items - An array of line items from the sale.
 */
export async function updateStockOnSale(items: LineItem[]): Promise<void> {
    const batch = writeBatch(db);

    for (const item of items) {
        if (item.inventoryId) {
            const inventoryRef = doc(db, "inventory", item.inventoryId);
            // Atomically decrement the stock by the quantity sold.
            batch.update(inventoryRef, { stock: increment(-item.quantity) });
        }
    }
    
    await batch.commit();
}


/**
 * Updates the stock level of inventory items when a purchase is marked as received.
 * It increments the stock for existing items or creates new inventory items if they don't exist.
 * @param items - An array of line items from the purchase.
 * @param userId - The ID of the user who owns the inventory.
 */
export async function updateStockOnPurchase(items: LineItem[], userId: string): Promise<void> {
    const batch = writeBatch(db);
    const inventoryQuery = query(collection(db, "inventory"), where("userId", "==", userId));
    const inventorySnapshot = await getDocs(inventoryQuery);
    
    const inventoryMap = new Map<string, {docId: string, stock: number}>();
    inventorySnapshot.forEach(doc => {
        const item = doc.data();
        inventoryMap.set(item.name.toLowerCase(), { docId: doc.id, stock: item.stock });
    });

    for (const purchasedItem of items) {
        const existingItem = inventoryMap.get(purchasedItem.name.toLowerCase());
        
        if (existingItem) {
            // If item exists, atomically increment the stock.
            const itemRef = doc(db, "inventory", existingItem.docId);
            batch.update(itemRef, { stock: increment(purchasedItem.quantity) });
        } else {
            // If item doesn't exist, create it in inventory.
             const newItemRef = doc(collection(db, "inventory"));
             batch.set(newItemRef, {
                 name: purchasedItem.name,
                 price: purchasedItem.price,
                 stock: purchasedItem.quantity,
                 category: 'Uncategorized',
                 subcategory: '',
                 supplier: '', // Supplier info is on the purchase order, not line item.
                 userId: userId,
             });
        }
    }
    
    await batch.commit();
}
