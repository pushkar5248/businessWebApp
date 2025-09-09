
import { config } from 'dotenv';
config({ path: '.env' });

import '@/ai/flows/generate-invoice-pdf.ts';
import '@/ai/flows/generate-ledger-pdf.ts';
import '@/ai/flows/fetch-gstin-details.ts';
