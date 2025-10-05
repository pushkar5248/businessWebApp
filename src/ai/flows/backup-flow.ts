
'use server';

/**
 * @fileOverview A flow to back up user data from Firestore.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

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


const BackupInputSchema = z.object({
  userId: z.string().describe('The ID of the user whose data to back up.'),
});

const BackupOutputSchema = z.object({
  backupData: z.any().describe('A JSON object containing the user\'s data.'),
});

export async function backupUserData(userId: string): Promise<z.infer<typeof BackupOutputSchema>> {
  return backupFlow({ userId });
}

const backupFlow = ai.defineFlow(
  {
    name: 'backupFlow',
    inputSchema: BackupInputSchema,
    outputSchema: BackupOutputSchema,
  },
  async ({ userId }) => {
    console.log(`[Backup Flow] Starting backup for userId: ${userId}`);

    try {
      const collectionsToBackup = ['inventory', 'sales', 'purchases', 'users'];
      const backupData: Record<string, any[]> = {};

      for (const collectionName of collectionsToBackup) {
        if (collectionName === 'users') {
            // Special case for the 'users' collection to back up the specific user's settings document
            const userDocRef = doc(db, 'users', userId);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                backupData[collectionName] = [{ id: docSnap.id, ...docSnap.data() }];
                 console.log(`[Backup Flow] Backed up 1 document from '${collectionName}'.`);
            } else {
                backupData[collectionName] = [];
                 console.log(`[Backup Flow] No document found for user in '${collectionName}'.`);
            }
            continue; // Skip to the next collection
        } 
        
        // For all other collections, query by userId
        const collRef = collection(db, collectionName);
        const q = query(collRef, where('userId', '==', userId));
        const snapshot = await getDocs(q);

        backupData[collectionName] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log(`[Backup Flow] Backed up ${snapshot.size} documents from '${collectionName}'.`);
      }

      console.log('[Backup Flow] Backup completed successfully.');
      return { backupData };

    } catch (error) {
      console.error('[Backup Flow] An error occurred during the backup process:', error);
      throw new Error('Failed to complete backup.');
    }
  }
);
