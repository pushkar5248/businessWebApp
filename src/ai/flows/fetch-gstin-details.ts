
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

// Hardcoded local data for guaranteed lookup.
const localGstinData: Record<string, GstinOutput> = {
  '09AGZPA5852F1Z0': {
    businessName: 'Adhunik Marbles',
    businessAddress: 'KUNDAN BHAWAN, ROHTA, GWALIOR ROAD, AGRA, Agra, Uttar Pradesh, 282001',
  },
  '09BEZPA5480A1ZD': {
    businessName: 'KHUSHI ENTERPRISES',
    businessAddress: 'GROUND FLOOR, PLOT NO. 76, SHOP NO. 3, 4 & 5, Paschim Puri Road, Sikandra, Agra, Agra, Uttar Pradesh, 282007',
  },
};


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
    console.log(`[GSTIN Flow] Initiating lookup for GSTIN: ${gstin}`);

    // First, check the hardcoded local data.
    if (localGstinData[gstin]) {
      const details = localGstinData[gstin];
      console.log('[GSTIN Flow] Successfully fetched details from hardcoded data:', details);
      return details;
    }

    // If not in local data, check Firestore.
    console.log(`[GSTIN Flow] GSTIN ${gstin} not found in hardcoded data, checking Firestore.`);
    try {
      const docRef = doc(db, "gstin_data", gstin);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const details = {
            businessName: data.businessName,
            businessAddress: data.businessAddress,
        };
        console.log('[GSTIN Flow] Successfully fetched details from Firestore:', details);
        return details;
      } else {
        console.log(`[GSTIN Flow] GSTIN ${gstin} not found in Firestore.`);
        return null;
      }
    } catch (error) {
      console.error("[GSTIN Flow] An unexpected error occurred during database lookup:", error);
      return null;
    }
  }
);
