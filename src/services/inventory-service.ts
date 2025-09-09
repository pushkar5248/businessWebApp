
import { db } from "@/lib/firebase";
import { LineItem } from "@/lib/types";
import { doc, getDoc, updateDoc, writeBatch, collection, query, where, getDocs, addDoc, increment } from "firebase/firestore";

/**
 * Updates the stock level of inventory items when a sale is made.
 * It decrements the stock for each item in the sale.
 * This function relies on the inventoryId being present in the line item.
 * @param items - An array of line items from the sale.
 */
export async function updateStockOnSale(items: LineItem[]): Promise<void> {
    console.log('updateStockOnSale called with:', items);
    if (!items || items.length === 0) {
        console.log('updateStockOnSale: No items to process.');
        return;
    }

    const batch = writeBatch(db);

    for (const item of items) {
        console.log('Processing sale item:', item);
        if (item.inventoryId) {
            const inventoryRef = doc(db, "inventory", item.inventoryId);
            batch.update(inventoryRef, { stock: increment(-item.quantity) });
            console.log(`Decremented stock for inventoryId: ${item.inventoryId} by ${item.quantity}`);
        } else {
            console.warn(`Skipping stock update for sale item "${item.name}" because it has no inventoryId.`);
        }
    }
    
    await batch.commit();
    console.log('Stock update from sale committed successfully.');
}


/**
 * Updates the stock level of inventory items when a purchase is marked as received.
 * It increments the stock for existing items or creates new inventory items if they don't exist.
 * @param items - An array of line items from the purchase.
 * @param userId - The ID of the user who owns the inventory.
 */
export async function updateStockOnPurchase(items: LineItem[], userId: string): Promise<void> {
    console.log('updateStockOnPurchase called with items:', items, 'and userId:', userId);
    if (!items || items.length === 0) {
        console.log('updateStockOnPurchase: No items to process.');
        return;
    }
    if (!userId) {
        console.error('updateStockOnPurchase: userId is missing.');
        return;
    }
    
    const batch = writeBatch(db);
    
    for (const purchasedItem of items) {
        console.log('Processing purchase item:', purchasedItem);
        // Prioritize updating by ID if it exists, as it's more reliable.
        if (purchasedItem.inventoryId) {
            const itemRef = doc(db, "inventory", purchasedItem.inventoryId);
            batch.update(itemRef, { stock: increment(purchasedItem.quantity) });
            console.log(`Incrementing stock for existing item by ID: ${purchasedItem.inventoryId}`);
        } else {
            console.log(`Item "${purchasedItem.name}" missing inventoryId, attempting to match by name.`);
            const inventoryQuery = query(
                collection(db, "inventory"), 
                where("userId", "==", userId),
                where("name", "==", purchasedItem.name)
            );
            const querySnapshot = await getDocs(inventoryQuery);

            if (!querySnapshot.empty) {
                // Item exists, increment the stock.
                const existingDoc = querySnapshot.docs[0];
                const itemRef = doc(db, "inventory", existingDoc.id);
                batch.update(itemRef, { stock: increment(purchasedItem.quantity) });
                 console.log(`Found match by name for "${purchasedItem.name}". Incrementing stock for doc ID: ${existingDoc.id}`);
            } else {
                // If item doesn't exist, create it in inventory.
                 const newItemRef = doc(collection(db, "inventory"));
                 batch.set(newItemRef, {
                     name: purchasedItem.name,
                     price: purchasedItem.price,
                     stock: purchasedItem.quantity,
                     category: 'Uncategorized',
                     subcategory: '',
                     supplier: '',
                     userId: userId,
                 });
                 console.log(`No match for "${purchasedItem.name}". Creating new inventory item.`);
            }
        }
    }
    
    await batch.commit();
    console.log('Stock update from purchase committed successfully.');
}
