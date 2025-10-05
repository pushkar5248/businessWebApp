
'use server';

/**
 * @fileOverview A flow to back up user data from Firestore.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

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
        const collRef = collection(db, collectionName);
        let q;
        if (collectionName === 'users') {
            // For 'users', we only back up the specific user's settings document
            const userDocRef = doc(db, 'users', userId);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                backupData[collectionName] = [{ id: docSnap.id, ...docSnap.data() }];
            } else {
                backupData[collectionName] = [];
            }
            continue;
        } else {
           q = query(collRef, where('userId', '==', userId));
        }

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
// This is a workaround because the above flow is not picking up the import for doc and getDoc
import { doc, getDoc } from 'firebase/firestore';

