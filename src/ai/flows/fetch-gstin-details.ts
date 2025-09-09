
'use server';

/**
 * @fileOverview A flow to fetch business details based on a GSTIN using a live third-party API.
 *
 * - fetchGstinDetails - A function that fetches business details for a given GSTIN.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import type { GstinInput, GstinOutput } from '@/lib/schemas/gstin';
import { GstinInputSchema, GstinOutputSchema } from '@/lib/schemas/gstin';

// Zod schema for the expected API response structure from gstincheck.co.in
const GstApiResponseSchema = z.object({
  flag: z.boolean(),
  data: z.object({
    tradeNam: z.string(), // Trade Name
    pradr: z.object({
      adr: z.string(), // Full Address
    }),
  }).optional(),
  message: z.string().optional(),
});


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
    
    const apiKey = process.env.GSTIN_API_KEY;

    if (!apiKey) {
      console.error("[GSTIN Flow] Error: GSTIN_API_KEY is not configured in .env file.");
      // In a real app, you might want to throw an error that the frontend can gracefully handle.
      return null;
    }

    // Corrected URL format based on user finding.
    const url = `http://sheet.gstincheck.co.in/check/${apiKey}/${gstin}`;

    try {
      console.log(`[GSTIN Flow] Fetching data from external API: ${url}`);
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`[GSTIN Flow] API call failed with status: ${response.status} ${response.statusText}`);
        return null;
      }

      const rawData = await response.json();
      console.log("[GSTIN Flow] Received raw data:", rawData);

      // The API response for this endpoint is slightly different.
      // It seems to directly return the data object if successful.
      // We will create a new schema to handle this direct data structure.
      const DirectGstDataSchema = z.object({
        tradeNam: z.string(),
        pradr: z.object({
            adr: z.string(),
        }),
      });

      const parsedResponse = DirectGstDataSchema.safeParse(rawData);

      if (parsedResponse.success) {
         const { tradeNam, pradr } = parsedResponse.data;
         const details = {
            businessName: tradeNam,
            businessAddress: pradr.adr,
         };
         console.log('[GSTIN Flow] Successfully fetched and parsed details:', details);
         return details;
      } else {
        // Fallback to check if it's wrapped in { flag: true, data: {...} }
        const wrappedParsedResponse = GstApiResponseSchema.safeParse(rawData);
        if (wrappedParsedResponse.success && wrappedParsedResponse.data.flag && wrappedParsedResponse.data.data) {
             const { tradeNam, pradr } = wrappedParsedResponse.data.data;
             const details = {
                businessName: tradeNam,
                businessAddress: pradr.adr,
             };
             console.log('[GSTIN Flow] Successfully fetched and parsed details from wrapped response:', details);
             return details;
        }

        console.error("[GSTIN Flow] API response validation failed for both direct and wrapped structures:", parsedResponse.error.flatten());
        return null;
      }

    } catch (error) {
      console.error("[GSTIN Flow] An unexpected error occurred during API fetch:", error);
      return null;
    }
  }
);
