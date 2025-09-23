
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
    businessName: 'M/S ADHUNIK MARBLES',
    businessAddress: 'KUNDAN BHAWAN, ROHTA, GWALIOR ROAD, AGRA, Agra, Uttar Pradesh, 282001',
  },
  '09BEZPA5480A1ZD': {
    businessName: 'KHUSHI ENTERPRISES',
    businessAddress: 'GROUND FLOOR, PLOT NO. 76, SHOP NO. 3, 4 & 5, Paschim Puri Road, Sikandra, Agra, Agra, Uttar Pradesh, 282007',
  },
  '09AEXPA3496B1ZA': {
    businessName: 'M/S SHRI AGRAWAL DYES AND CHEMICAL INDUSTRIES',
    businessAddress: 'NAI KA NAGLA ROAD, HATHRAS, HATHRAS, Hathras, Uttar Pradesh, 204101',
  },
  '09CEJPA5520E1ZV': {
    businessName: 'KRISHNA MARBLES',
    businessAddress: 'PURA GOVERDHAN, 10, PILI POKHAR, HATHRAS ROAD, AGRA, Agra, Uttar Pradesh, 282006',
  },
  '08AUHPB1384K1ZK': {
    businessName: 'STANDARD GRANITES',
    businessAddress: 'Plot No. F-334, Silora, RIICO Industrial Area, Kishangarh, Ajmer, Rajasthan, 305802',
  },
  '09AAZFG6660R1Z2': {
    businessName: 'Gunjan Polyplast',
    businessAddress: 'Khasara No.- 565, Mauza Ramnagar, Near Yamuna Expressway, Khandauli, Agra, Uttar Pradesh, 283126',
  },
  '24ACDFA2859E1ZO': {
    businessName: 'ALASKA SURFACES LLP',
    businessAddress: 'Survey No. 575P1 , 576P1 P2 , 576P2 P2, Jetpar Road, At: Shapar, Jetpur Machchhukantha, Morbi, Gujarat, 363630',
  },
  '06BBKPA1054J2ZY': {
    businessName: 'WONDER POWER INDUSTRIES',
    businessAddress: 'LADWA, BABAIN ROAD, CHOUDHARY COLONY, Ladwa Rural Part, LADWA, Kurukshetra, Haryana, 136132',
  },
  '09ANDPD5794J1ZM': {
    businessName: 'DIXIT ENTERPRISES',
    businessAddress: '111, om shri town, rajarai road, rajarai, Agra, Uttar Pradesh, 282001',
  },
  '09BYTPA2451F1ZF': {
    businessName: 'AGRASEN MARBLES',
    businessAddress: '00, Bharatpur Road, Bichpuri, Agra, Uttar Pradesh, 283105',
  },
  '08ABBFS2396H1ZY': {
    businessName: 'SHREE DHAR INDUSTRIES',
    businessAddress: 'GA-109,, OLD INDUSTRIAL AREA,, MADANGANJ-KISHANGARH, Ajmer, Rajasthan, 305801',
  },
  '08AHVPB8771B1Z3': {
    businessName: 'MANIDHAR BHATTER & COMPANY',
    businessAddress: 'OLD IND., C/O SHREEDHAR INDUSTRIES GA-109, MADANGANJ, KISHANGARH, Ajmer, Rajasthan, 305801',
  },
  '09AYZPP3998D1ZD': {
    businessName: 'VED BUILDERS',
    businessAddress: '26, VILL PACHGAI KHEDA POST KAKUA, AGRA, Agra, Uttar Pradesh, 282009',
  },
  '09AABCA7687D1ZI': {
    businessName: 'M/S ASOPA HOSPITAL PVT. LTD.(DRUG STORE)',
    businessAddress: 'GAILANA ROAD, BYPASS, GAILANA ROAD, Agra, Uttar Pradesh, 282007',
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
