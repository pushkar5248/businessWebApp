
'use server';

/**
 * @fileOverview A flow to restore user data to Firestore from a backup file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';

// Explicitly initialize Firebase within the server-side flow
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);


const RestoreInputSchema = z.object({
  userId: z.string().describe('The ID of the user whose data is being restored.'),
  backupData: z.any().describe('The JSON backup data to restore.'),
});

const RestoreOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export async function restoreUserData(input: z.infer<typeof RestoreInputSchema>): Promise<z.infer<typeof RestoreOutputSchema>> {
  return restoreFlow(input);
}

const restoreFlow = ai.defineFlow(
  {
    name: 'restoreFlow',
    inputSchema: RestoreInputSchema,
    outputSchema: RestoreOutputSchema,
  },
  async ({ userId, backupData }) => {
    console.log(`[Restore Flow] Starting restore for userId: ${userId}`);

    const collectionsToDelete = ['inventory', 'sales', 'purchases'];

    try {
      const batch = writeBatch(db);

      // 1. Delete existing data for the user
      for (const collectionName of collectionsToDelete) {
        console.log(`[Restore Flow] Deleting existing data from '${collectionName}'...`);
        const q = query(collection(db, collectionName), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        console.log(`[Restore Flow] Marked ${snapshot.size} documents from '${collectionName}' for deletion.`);
      }

      // 2. Restore data from backup
      for (const collectionName in backupData) {
        if (Object.prototype.hasOwnProperty.call(backupData, collectionName)) {
          const documents = backupData[collectionName];
          console.log(`[Restore Flow] Restoring ${documents.length} documents to '${collectionName}'...`);
          for (const docData of documents) {
            const { id, ...data } = docData;
            const docRef = doc(db, collectionName, id);
            batch.set(docRef, data);
          }
        }
      }

      // Commit all batched operations
      await batch.commit();
      
      console.log('[Restore Flow] Restore completed successfully.');
      return {
        success: true,
        message: 'Data has been successfully restored from backup.',
      };

    } catch (error) {
      console.error('[Restore Flow] An error occurred during the restore process:', error);
      return {
        success: false,
        message: 'An error occurred during the restore process. Please check the logs.',
      };
    }
  }
);
