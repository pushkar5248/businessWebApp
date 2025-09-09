
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

// Zod schema for the expected API response structure
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

    const url = `http://gstincheck.co.in/api/v1/search?api_key=${apiKey}&gstin_no=${gstin}`;

    try {
      console.log(`[GSTIN Flow] Fetching data from external API...`);
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`[GSTIN Flow] API call failed with status: ${response.status} ${response.statusText}`);
        return null;
      }

      const rawData = await response.json();
      console.log("[GSTIN Flow] Received raw data:", rawData);

      // Validate the response with our Zod schema
      const parsedResponse = GstApiResponseSchema.safeParse(rawData);

      if (!parsedResponse.success) {
        console.error("[GSTIN Flow] API response validation failed:", parsedResponse.error.flatten());
        return null;
      }
      
      const { flag, data, message } = parsedResponse.data;

      if (flag && data) {
        const details = {
          businessName: data.tradeNam,
          businessAddress: data.pradr.adr,
        };
        console.log('[GSTIN Flow] Successfully fetched and parsed details:', details);
        return details;
      } else {
        console.warn(`[GSTIN Flow] API indicated failure for GSTIN ${gstin}. Message: ${message}`);
        return null;
      }

    } catch (error) {
      console.error("[GSTIN Flow] An unexpected error occurred during API fetch:", error);
      return null;
    }
  }
);
