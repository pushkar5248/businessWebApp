
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
  '09AAAAA1234A1Z4': {
    businessName: 'Adhunik Minerals Corp',
    businessAddress: '789 Marble Arch, Agra, UP 282001',
  }
};

// Arrays for generating plausible random business data
const businessNouns = ["Enterprises", "Solutions", "Innovations", "Trading", "Group", "Industries", "Exports", "Minerals", "Stones"];
const businessAdjectives = ["Global", "National", "Sunrise", "Pioneer", "Apex", "Dynamic", "United", "Prime", "Heritage"];
const streetTypes = ["Road", "Street", "Avenue", "Lane", "Drive", "Plaza"];
const cityNames = ["Jaipur", "Mumbai", "Delhi", "Bangalore", "Kolkata", "Chennai", "Pune", "Ahmedabad", "Hyderabad"];


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
    
    // Check our mock database first for specific examples
    const details = gstinDatabase[upperGstin];

    if (details) {
      console.log('Found details in mock database:', details);
      return details;
    }
    
    // If not in the mock database, generate plausible random data for any other 15-digit string
    if (upperGstin.length === 15) {
        console.log('GSTIN not in mock DB, generating random data.');
        const randomAdjective = businessAdjectives[Math.floor(Math.random() * businessAdjectives.length)];
        const randomNoun = businessNouns[Math.floor(Math.random() * businessNouns.length)];
        const randomCity = cityNames[Math.floor(Math.random() * cityNames.length)];
        const randomStreetType = streetTypes[Math.floor(Math.random() * streetTypes.length)];
        
        const generatedDetails: GstinOutput = {
            businessName: `${randomAdjective} ${randomNoun}`,
            businessAddress: `${Math.floor(Math.random() * 900) + 100} ${randomStreetType}, ${randomCity}`,
        };
        console.log('Generated details:', generatedDetails);
        return generatedDetails;
    }

    console.log('No details found for GSTIN.');
    return null;
  }
);
