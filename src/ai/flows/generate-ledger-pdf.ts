
'use server';

/**
 * @fileOverview Ledger HTML generation flow using Genkit.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import Handlebars from 'handlebars';
import { formatDate } from '@/lib/utils';

const LedgerEntrySchema = z.object({
  date: z.string(),
  particulars: z.string(),
  voucherType: z.string(),
  voucherNumber: z.string(),
  debit: z.string(),
  credit: z.string(),
  balance: z.string(),
});

const GenerateLedgerPdfInputSchema = z.object({
  businessName: z.string().describe('The name of the business.'),
  businessAddress: z.string().describe('The address of the business.'),
  reportDate: z.string().describe('The date the report was generated.'),
  personName: z.string().describe("The name of the customer or vendor."),
  entries: z.array(LedgerEntrySchema),
  openingBalance: z.string(),
  totalDebit: z.string(),
  totalCredit: z.string(),
  closingBalance: z.string(),
  fromDate: z.string().optional().describe("The start date for the ledger report."),
  toDate: z.string().optional().describe("The end date for the ledger report."),
});

export type GenerateLedgerPdfInput = z.infer<typeof GenerateLedgerPdfInputSchema>;

const GenerateLedgerHtmlOutputSchema = z.object({
  html: z.string().describe('The ledger HTML as a string.'),
});

export type GenerateLedgerHtmlOutput = z.infer<typeof GenerateLedgerHtmlOutputSchema>;

export async function generateLedgerPdf(input: GenerateLedgerPdfInput): Promise<GenerateLedgerHtmlOutput> {
  return generateLedgerHtmlFlow(input);
}

const generateLedgerHtmlFlow = ai.defineFlow(
  {
    name: 'generateLedgerHtmlFlow',
    inputSchema: GenerateLedgerPdfInputSchema,
    outputSchema: GenerateLedgerHtmlOutputSchema,
  },
  async (input) => {
    const handlebarsTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Ledger Account</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; background-color: #fff; font-size: 10px; }
            .ledger-container { width: 800px; margin: auto; padding: 20px; border: 1px solid #ccc; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #111; }
            .header h2 { margin: 5px 0; font-size: 18px; font-weight: 500; }
            .header p { margin: 2px 0; font-size: 12px; }
            .meta-info { display: flex; justify-content: space-between; padding: 10px; margin-bottom: 15px; background-color: #f9f9f9; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; }
            .meta-info div { font-size: 12px; font-weight: 500; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .items-table th { background-color: #f2f2f2; font-weight: 600; text-align: center; }
            .items-table td { vertical-align: top; }
            .text-right { text-align: right !important; }
            .font-semibold { font-weight: 600; }
            .footer-summary { display: flex; justify-content: flex-end; margin-top: 20px; }
            .totals-table { width: 40%; border-collapse: collapse; }
            .totals-table td { border: 1px solid #ddd; padding: 8px; }
            .totals-table .label { font-weight: 600; }
            .grand-total { font-weight: bold; font-size: 14px; background-color: #f2f2f2; }
            .page-footer { text-align: center; font-size: 9px; color: #777; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
    </head>
    <body>
        <div class="ledger-container">
            <div class="header">
                <h1>{{{businessName}}}</h1>
                <p>{{{businessAddress}}}</p>
                <h2>Ledger Account: {{{personName}}}</h2>
                <p>From {{#if fromDate}}{{{fromDate}}}{{else}}............{{/if}} To {{#if toDate}}{{{toDate}}}{{else}}............{{/if}}</p>
            </div>

            <div class="meta-info">
                <div>Report Date: {{{reportDate}}}</div>
            </div>

            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 10%;">Date</th>
                        <th>Particulars</th>
                        <th style="width: 12%;">Vch Type</th>
                        <th style="width: 12%;">Vch No.</th>
                        <th style="width: 12%;" class="text-right">Debit</th>
                        <th style="width: 12%;" class="text-right">Credit</th>
                        <th style="width: 15%;" class="text-right">Balance</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td></td>
                        <td class="font-semibold">Opening Balance</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td class="text-right font-semibold">{{{openingBalance}}}</td>
                    </tr>
                    {{#each entries}}
                    <tr>
                        <td>{{date}}</td>
                        <td>{{particulars}}</td>
                        <td>{{voucherType}}</td>
                        <td>{{voucherNumber}}</td>
                        <td class="text-right">{{debit}}</td>
                        <td class="text-right">{{credit}}</td>
                        <td class="text-right">{{balance}}</td>
                    </tr>
                    {{/each}}
                    <tr class="font-semibold" style="background-color: #f9f9f9;">
                        <td colspan="4" class="text-right">Total</td>
                        <td class="text-right">{{{totalDebit}}}</td>
                        <td class="text-right">{{{totalCredit}}}</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
            
            <div class="footer-summary">
                 <table class="totals-table">
                    <tr class="grand-total">
                        <td class="label">Closing Balance</td>
                        <td class="text-right">{{{closingBalance}}}</td>
                    </tr>
                </table>
            </div>

            <div class="page-footer">
                This is a computer-generated document and does not require a signature.
            </div>
        </div>
    </body>
    </html>
    `;

    const templateData = {
        ...input,
        reportDate: formatDate(input.reportDate),
        fromDate: input.fromDate ? formatDate(input.fromDate) : undefined,
        toDate: input.toDate ? formatDate(input.toDate) : undefined,
        entries: input.entries.map(e => ({
            ...e,
            date: formatDate(e.date),
        }))
    };

    try {
      const template = Handlebars.compile(handlebarsTemplate);
      const htmlContent = template(templateData);
      
      return {
        html: htmlContent,
      };
    } catch (error) {
      console.error('Error during HTML generation:', error);
      throw error;
    }
  }
);
