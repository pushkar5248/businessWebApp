'use server';

/**
 * @fileOverview A flow to fetch business details based on a GSTIN.
 *
 * - fetchGstinDetails - A function that fetches business details for a given GSTIN.
 * - GstinInput - The input type for the fetchGstinDetails function.
 * - GstinOutput - The return type for the fetchGstinDetails function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

export const GstinInputSchema = z.object({
  gstin: z.string().length(15, { message: "GSTIN must be 15 characters long." }).describe('The GSTIN of the business to look up.'),
});
export type GstinInput = z.infer<typeof GstinInputSchema>;

export const GstinOutputSchema = z.object({
  businessName: z.string().describe('The legal name of the business.'),
  businessAddress: z.string().describe('The principal address of the business.'),
});
export type GstinOutput = z.infer<typeof GstinOutputSchema>;

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
    
    // Simulate an API call to a GSTIN verification service.
    const details = gstinDatabase[gstin.toUpperCase()];

    if (details) {
      console.log('Found details:', details);
      return details;
    }

    console.log('No details found for GSTIN.');
    return null;
  }
);
