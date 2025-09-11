
'use server';

/**
 * @fileOverview A professional invoice HTML generation flow using Genkit.
 *
 * - generateSampleInvoicePdf - A function that generates a professional HTML string of an invoice.
 * - GenerateSampleInvoicePdfInput - The input type for the function.
 * - GenerateSampleInvoiceHtmlOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import Handlebars from 'handlebars';
import { getStateCode } from '@/lib/state-codes';


const GenerateSampleInvoicePdfInputSchema = z.object({
  businessName: z.string().describe('The name of the business.'),
  businessAddress: z.string().describe('The address of the business.'),
  businessPhone: z.string().describe('The phone number of the business.'),
  businessEmail: z.string().describe('The email address of the business.'),
  businessGstin: z.string().describe('The GSTIN of the business.'),
  invoiceNumber: z.string().describe('The invoice number.'),
  invoiceDate: z.string().describe('The invoice date.'),
  customerName: z.string().describe('The name of the customer.'),
  customerAddress: z.string().describe('The address of the customer.'),
  customerPhone: z.string().describe('The phone number of the business.'),
  customerState: z.string().optional().describe('The state of the customer.'),
  customerGstin: z.string().optional().describe('The GSTIN of the customer.'),
  deliveryPlaceName: z.string().optional().describe('The name for the delivery place, if different.'),
  deliveryAddress: z.string().optional().describe('The delivery address, if different from the customer address.'),
  deliveryState: z.string().optional().describe('The state for the delivery place.'),
  deliveryGstin: z.string().optional().describe('The GSTIN for the delivery place.'),
  transporterName: z.string().optional().describe('The name of the transporter.'),
  transporterVehicleNumber: z.string().optional().describe('The vehicle number of the transporter.'),
  placeOfSupply: z.string().optional().describe('The place of supply.'),
  transportDate: z.string().optional().describe('The date of transport.'),
  items: z.array(
    z.object({
      name: z.string().describe('The name of the item.'),
      quantity: z.number().describe('The quantity of the item.'),
      price: z.number().describe('The price of the item.'),
      hsnCode: z.string().optional().describe('The HSN code of the item.'),
      unit: z.string().optional().describe('The unit of the item (e.g., pcs, sqft).'),
    })
  ).describe('An array of items in the invoice.'),
  cgstRate: z.number().optional().describe('The CGST rate percentage.'),
  sgstRate: z.number().optional().describe('The SGST rate percentage.'),
  igstRate: z.number().optional().describe('The IGST rate percentage.'),
  total: z.number().describe('The total amount of the invoice.'),
  currency: z.string().describe('The currency symbol to use for the invoice.'),
});

export type GenerateSampleInvoicePdfInput = z.infer<typeof GenerateSampleInvoicePdfInputSchema>;

const GenerateSampleInvoiceHtmlOutputSchema = z.object({
  html: z.string().describe('The invoice HTML as a string.'),
});

export type GenerateSampleInvoiceHtmlOutput = z.infer<typeof GenerateSampleInvoiceHtmlOutputSchema>;

export async function generateSampleInvoicePdf(input: GenerateSampleInvoicePdfInput): Promise<GenerateSampleInvoiceHtmlOutput> {
  return generateSampleInvoiceHtmlFlow(input);
}

const generateSampleInvoiceHtmlFlow = ai.defineFlow(
  {
    name: 'generateSampleInvoiceHtmlFlow',
    inputSchema: GenerateSampleInvoicePdfInputSchema,
    outputSchema: GenerateSampleInvoiceHtmlOutputSchema,
  },
  async (input) => {
    const handlebarsTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Tax Invoice - {{{businessName}}}</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                color: #333;
                background-color: #f8f9fa;
                font-size: 12px;
                line-height: 1.6;
            }
            .invoice-container {
                width: 800px;
                margin: 20px auto;
                padding: 40px;
                background-color: #fff;
                border: 1px solid #dee2e6;
                box-shadow: 0 0 15px rgba(0,0,0,0.05);
            }
            .header, .footer {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                padding-bottom: 20px;
                border-bottom: 2px solid #000;
                margin-bottom: 20px;
            }
            .header .company-details {
                text-align: left;
            }
            .header .company-details h1 {
                margin: 0;
                font-size: 28px;
                font-weight: bold;
                color: #000;
            }
            .header .company-details p {
                margin: 2px 0;
                font-size: 13px;
                color: #555;
            }
            .header .invoice-title {
                text-align: right;
            }
            .header .invoice-title h2 {
                margin: 0;
                font-size: 24px;
                font-weight: 600;
            }
            .header .invoice-title p {
                margin: 5px 0 0;
                font-size: 14px;
            }
            .details-section {
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
                gap: 20px;
            }
            .details-section .info-block {
                width: 48%;
                padding: 15px;
                border: 1px solid #eee;
                border-radius: 8px;
                background-color: #f8f9fa;
            }
            .info-block h3 {
                margin: 0 0 10px 0;
                font-size: 14px;
                font-weight: 600;
                border-bottom: 1px solid #ddd;
                padding-bottom: 8px;
            }
            .info-block p {
                margin: 4px 0;
                min-height: 1em;
            }
            .info-block .field-row {
                display: flex;
                justify-content: space-between;
            }
            .items-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
            }
            .items-table th, .items-table td {
                padding: 12px 15px;
                text-align: left;
                border-bottom: 1px solid #dee2e6;
            }
            .items-table th {
                background-color: #f2f2f2;
                font-weight: 600;
                text-transform: uppercase;
                font-size: 11px;
            }
            .items-table .text-right { text-align: right; }
            .items-table .text-center { text-align: center; }
            .summary-section {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 2px solid #000;
            }
            .summary-section .summary-left {
                width: 60%;
            }
            .summary-section .summary-right {
                width: 35%;
            }
            .totals-table {
                width: 100%;
            }
            .totals-table td {
                padding: 8px 0;
                display: flex;
                justify-content: space-between;
                border-bottom: 1px solid #eee;
            }
            .totals-table tr:last-child td {
                border-bottom: none;
            }
            .totals-table .grand-total td {
                font-weight: bold;
                font-size: 16px;
                padding-top: 15px;
                border-top: 2px solid #000;
            }
            .rupees-in-words {
                font-weight: bold;
                font-size: 13px;
                margin-bottom: 15px;
                line-height: 1.5;
            }
            .rupees-in-words p {
                margin: 0;
            }
            .bank-details h4 {
                margin: 10px 0 5px;
                font-weight: bold;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                font-size: 11px;
                color: #777;
                flex-direction: column;
            }
             .footer .terms {
                margin-bottom: 10px;
             }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <div class="header">
                <div class="company-details">
                    <h1>{{{businessName}}}</h1>
                    <p>{{{businessAddress}}}</p>
                    <p><strong>GSTIN:</strong> {{{businessGstin}}} | <strong>Email:</strong> {{{businessEmail}}} | <strong>Phone:</strong> {{{businessPhone}}}</p>
                </div>
                <div class="invoice-title">
                    <h2>TAX INVOICE</h2>
                    <p><strong>Invoice #:</strong> {{{invoiceNumber}}}</p>
                    <p><strong>Date:</strong> {{{invoiceDate}}}</p>
                </div>
            </div>

            <div class="details-section">
                <div class="info-block">
                    <h3>Billed To</h3>
                    <p><strong>Name:</strong> {{{customerName}}}</p>
                    <p><strong>Address:</strong> {{{customerAddress}}}</p>
                    <div class="field-row">
                        <p><strong>State:</strong> {{#if customerState}}{{{customerState}}}{{else}}_____________{{/if}}</p>
                        <p><strong>Code:</strong> {{{customerStateCode}}}</p>
                    </div>
                    <p><strong>GSTIN:</strong> {{#if customerGstin}}{{{customerGstin}}}{{else}}____________________{{/if}}</p>
                    <p><strong>Phone:</strong> {{#if customerPhone}}{{{customerPhone}}}{{else}}____________________{{/if}}</p>
                </div>
                <div class="info-block">
                    <h3>Shipped To</h3>
                    <p><strong>Name:</strong> {{#if deliveryPlaceName}}{{{deliveryPlaceName}}}{{else}}{{{customerName}}}{{/if}}</p>
                    <p><strong>Address:</strong> {{#if deliveryAddress}}{{{deliveryAddress}}}{{else}}{{{customerAddress}}}{{/if}}</p>
                    <div class="field-row">
                        <p><strong>State:</strong> {{#if deliveryState}}{{{deliveryState}}}{{else}}{{{customerState}}}{{/if}}</p>
                        <p><strong>Code:</strong> {{{deliveryStateCode}}}</p>
                    </div>
                    <p><strong>GSTIN:</strong> {{#if deliveryGstin}}{{{deliveryGstin}}}{{else}}{{{customerGstin}}}{{/if}}</p>
                    <p><strong>Phone:</strong> {{#if customerPhone}}{{{customerPhone}}}{{/if}}</p>
                </div>
            </div>
            
            {{#if transporterName}}
            <div class="details-section" style="margin-bottom: 20px;">
                <div class="info-block" style="width: 100%; background: transparent; border: none; padding: 0;">
                    <h3>Transport Details</h3>
                    <p><strong>Transporter:</strong> {{{transporterName}}} | <strong>Vehicle No:</strong> {{{transporterVehicleNumber}}} | <strong>Place of Supply:</strong> {{{placeOfSupply}}} | <strong>Date:</strong> {{{transportDate}}}</p>
                </div>
            </div>
            {{/if}}

            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 5%;" class="text-center">#</th>
                        <th style="width: 40%;">Item Description</th>
                        <th class="text-center">HSN/SAC</th>
                        <th class="text-right">Qty</th>
                        <th class="text-center">Unit</th>
                        <th class="text-right">Rate</th>
                        <th class="text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {{#each items}}
                    <tr>
                        <td class="text-center">{{addOne @index}}</td>
                        <td>{{{name}}}</td>
                        <td class="text-center">{{{hsnCode}}}</td>
                        <td class="text-right">{{{quantity}}}</td>
                        <td class="text-center">{{{unit}}}</td>
                        <td class="text-right">{{{../currency}}}{{{price}}}</td>
                        <td class="text-right">{{{../currency}}}{{{itemTotal}}}</td>
                    </tr>
                    {{/each}}
                </tbody>
            </table>

            <div class="summary-section">
                <div class="summary-left">
                    <div class="rupees-in-words">
                        <p><strong>Amount in Words:</strong></p>
                        <p>{{{totalInWords}}}</p>
                    </div>
                    <div class="bank-details">
                        <h4>Bank Details</h4>
                        <p><strong>Bank:</strong> IDFC FIRST BANK, FATEHABAD ROAD, AGRA</p>
                        <p><strong>A/c No.:</strong> 10067934008 | <strong>IFSC Code:</strong> IDFB0021293</p>
                    </div>
                </div>
                <div class="summary-right">
                    <table class="totals-table">
                         <tr>
                            <td><span>Subtotal</span> <span>{{{currency}}}{{{subtotal}}}</span></td>
                        </tr>
                        {{#if sgst}}
                        <tr>
                            <td><span>SGST @ {{sgstRate}}%</span> <span>{{{currency}}}{{{sgst}}}</span></td>
                        </tr>
                        {{/if}}
                        {{#if cgst}}
                        <tr>
                            <td><span>CGST @ {{cgstRate}}%</span> <span>{{{currency}}}{{{cgst}}}</span></td>
                        </tr>
                        {{/if}}
                        {{#if igst}}
                        <tr>
                            <td><span>IGST @ {{igstRate}}%</span> <span>{{{currency}}}{{{igst}}}</span></td>
                        </tr>
                        {{/if}}
                        <tr>
                          <td><span>Round Off</span> <span>{{{currency}}}{{{roundOff}}}</span></td>
                        </tr>
                        <tr class="grand-total">
                            <td><span>Grand Total</span> <span>{{{currency}}}{{{total}}}</span></td>
                        </tr>
                    </table>
                </div>
            </div>

            <div class="footer">
                <div class="terms">
                     <strong>Terms & Conditions:</strong> Goods once sold will not be taken back or exchanged. Subject to Agra Jurisdiction only. E. & O. E.
                </div>
                <div class="signature">
                    For <strong>{{{businessName}}}</strong>
                    <br/><br/><br/>
                    <p style="border-top: 1px solid #000; padding-top: 5px;">Authorised Signatory</p>
                </div>
            </div>

        </div>
    </body>
    </html>
    `]];
    Handlebars.registerHelper('addOne', (value: number) => value + 1);

    const subtotal = input.items.reduce((acc, item) => acc + (item.quantity || 0) * (item.price || 0), 0);
    const cgstAmount = subtotal * ((input.cgstRate || 0) / 100);
    const sgstAmount = subtotal * ((input.sgstRate || 0) / 100);
    const igstAmount = subtotal * ((input.igstRate || 0) / 100);
    const totalAmount = subtotal + cgstAmount + sgstAmount + igstAmount;
    const roundedTotal = Math.round(totalAmount);
    const roundOffAmount = roundedTotal - totalAmount;

    function toWords(num: number): string {
        const a = ['','one ','two ','three ','four ', 'five ','six ','seven ','eight ','nine ','ten ','eleven ','twelve ','thirteen ','fourteen ','fifteen ','sixteen ','seventeen ','eighteen ','nineteen '];
        const b = ['', '', 'twenty','thirty','forty','fifty', 'sixty','seventy','eighty','ninety'];
        
        if ((num = num.toString()).length > 9) return 'overflow';
        const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n) return '';
        let str = '';
        str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'crore ' : '';
        str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'lakh ' : '';
        str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'thousand ' : '';
        str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'hundred ' : '';
        str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) + 'only ' : '';
        return str.trim().replace(/\s+/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    function formatDate(dateStr: string) {
        const date = new Date(dateStr);
        // Adjust for timezone offset to prevent off-by-one day errors
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() + userTimezoneOffset);

        const day = String(adjustedDate.getDate()).padStart(2, '0');
        const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
        const year = String(adjustedDate.getFullYear());
        return `${day}-${month}-${year}`;
    }

    const templateData = {
        ...input,
        invoiceDate: formatDate(input.invoiceDate),
        transportDate: input.transportDate ? formatDate(input.transportDate) : null,
        subtotal: subtotal.toFixed(2),
        cgst: cgstAmount > 0 ? cgstAmount.toFixed(2) : null,
        sgst: sgstAmount > 0 ? sgstAmount.toFixed(2) : null,
        igst: igstAmount > 0 ? igstAmount.toFixed(2) : null,
        items: input.items.map(item => ({
            ...item,
            itemTotal: ((item.quantity || 0) * (item.price || 0)).toFixed(2)
        })),
        total: input.total.toFixed(2),
        roundOff: roundOffAmount.toFixed(2),
        totalInWords: toWords(roundedTotal),
        customerStateCode: getStateCode(input.customerState),
        deliveryStateCode: getStateCode(input.deliveryState || input.customerState),
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
