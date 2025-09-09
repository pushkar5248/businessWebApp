
'use server';

/**
 * @fileOverview A flow to fetch business details based on a GSTIN.
 *
 * - fetchGstinDetails - A function that fetches business details for a given GSTIN.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import type { GstinInput, GstinOutput } from '@/lib/schemas/gstin';
import { GstinInputSchema, GstinOutputSchema } from '@/lib/schemas/gstin';


// This is a mock database of GSTIN details.
// In a real application, this would be a call to a third-party API.
const gstinDatabase: Record<string, GstinOutput> = {
  '27ABCDE1234F1Z5': {
    businessName: 'Stone Solutions Ltd.',
    businessAddress: '101 Rock Solid Rd, Granite City, MH 400001',
  },
  '29BBBCD1234F1Z5': {
    businessName: 'Quartz Co. Innovations',
    businessAddress: '202 Crystal Heights, Silicon Valley, KA 560029',
  },
  // Default/fallback record
  '09AAAAA1234A1Z4': {
    businessName: 'Adhunik Minerals Corp',
    businessAddress: '789 Marble Arch, Agra, UP 282001',
  }
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
    console.log(`Looking up GSTIN: ${gstin}`);
    const upperGstin = gstin.toUpperCase();
    
    // Check our mock database for specific examples
    const details = gstinDatabase[upperGstin];

    if (details) {
      console.log('Found details in mock database:', details);
      return details;
    }
    
    // For any other validly formatted GSTIN, return a default record for demonstration.
    // This provides a consistent and high-quality user experience without a real API.
    if (upperGstin.length === 15) {
        console.log('GSTIN not in mock DB, returning default sample data.');
        return gstinDatabase['09AAAAA1234A1Z4'];
    }

    console.log('No details found for invalid GSTIN format.');
    return null;
  }
);
