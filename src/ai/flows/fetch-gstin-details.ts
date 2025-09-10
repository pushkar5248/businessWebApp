
'use server';

/**
 * @fileOverview A flow to fetch business details from a centralized Firestore database based on a GSTIN.
 *
 * - fetchGstinDetails - A function that fetches business details for a given GSTIN from the local database.
 */

import {ai} from '@/ai/genkit';
import type { GstinInput, GstinOutput } from '@/lib/schemas/gstin';
import { GstinInputSchema, GstinOutputSchema } from '@/lib/schemas/gstin';
import { db } from '@/lib/firebase';
import { doc, getDoc } from "firebase/firestore";
import { z } from 'zod';


export async function fetchGstinDetails(input: GstinInput): Promise<GstinOutput | null> {
  return fetchGstinDetailsFlow(input);
}

const fetchGstinDetailsFlow = ai.defineFlow(
  {
    name: 'fetchGstinDetailsFlow',
    inputSchema: GstinInputSchema,
    outputSchema: z.nullable(GstinOutputSchema),
  },
  async ({ gstin }) => {
    console.log(`[GSTIN Flow] Initiating local database lookup for GSTIN: ${gstin}`);

    try {
      const docRef = doc(db, "gstin_data", gstin);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const details = {
            businessName: data.businessName,
            businessAddress: data.businessAddress,
        };
        console.log('[GSTIN Flow] Successfully fetched details from local DB:', details);
        return details;
      } else {
        console.log(`[GSTIN Flow] GSTIN ${gstin} not found in the local database.`);
        return null;
      }
    } catch (error) {
      console.error("[GSTIN Flow] An unexpected error occurred during database lookup:", error);
      return null;
    }
  }
);
