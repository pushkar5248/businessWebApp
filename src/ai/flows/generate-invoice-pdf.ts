
'use server';

/**
 * @fileOverview A professional invoice HTML generation flow using Genkit.
 *
 * - generateInvoicePdf - A function that generates a professional HTML string of an invoice based on the provided data.
 * - GenerateInvoicePdfInput - The input type for the function, defining the invoice data.
 * - GenerateInvoiceHtmlOutput - The return type for the function, providing the HTML as a string.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import Handlebars from 'handlebars';
import { getStateCode } from '@/lib/state-codes';

const GenerateInvoicePdfInputSchema = z.object({
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
  eWayBillNumber: z.string().optional().describe('The e-way bill number.'),
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

export type GenerateInvoicePdfInput = z.infer<typeof GenerateInvoicePdfInputSchema>;

const GenerateInvoiceHtmlOutputSchema = z.object({
  html: z.string().describe('The invoice HTML as a string.'),
});

export type GenerateInvoiceHtmlOutput = z.infer<typeof GenerateInvoiceHtmlOutputSchema>;

export async function generateInvoicePdf(input: GenerateInvoicePdfInput): Promise<GenerateInvoiceHtmlOutput> {
  return generateInvoiceHtmlFlow(input);
}

const generateInvoiceHtmlFlow = ai.defineFlow(
  {
    name: 'generateInvoiceHtmlFlow',
    inputSchema: GenerateInvoicePdfInputSchema,
    outputSchema: GenerateInvoiceHtmlOutputSchema,
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
                color: #374151;
                background-color: #fff;
                font-size: 11px;
                line-height: 1.5;
            }
            .invoice-container {
                width: 800px;
                margin: 20px auto;
                padding: 30px;
                border: 3px solid #000;
            }
            .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 25px;
                padding-bottom: 15px;
                border-bottom: 2px solid #000;
            }
            .header .company-details h2 {
                font-size: 28px;
                font-weight: bold;
                color: #0052A3;
                margin: 0 0 10px 0;
            }
            .header .company-details p {
                margin: 0;
                font-size: 12px;
                color: #6B7280;
            }
            .header-right {
                text-align: right;
            }
            .header-right .invoice-title {
                font-size: 22px;
                font-weight: 600;
                margin: 0 0 10px 0;
                color: #0052A3;
            }
             .header-right .meta-grid {
                display: grid;
                grid-template-columns: auto auto;
                gap: 5px 15px;
                font-size: 11px;
             }
             .meta-grid .label { font-weight: bold; color: #374151; }
             .meta-grid .value { text-align: left; color: #4B5563; }

            .details-section {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 25px;
            }
            .details-section .info-block {
                padding: 15px;
                background-color: #F9FAFB;
                border: 2px solid #000;
                border-radius: 8px;
            }
            .info-block h3 {
                margin: 0 0 10px 0;
                font-size: 12px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: #0052A3;
            }
            .info-block .field-grid {
                 display: grid;
                 grid-template-columns: 70px 1fr;
                 gap: 6px 8px;
            }
            .field-grid .label { font-weight: bold; color: #374151; }
            .field-grid span { color: #4B5563; }
            
            .items-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 25px;
                border: 2px solid #000;
            }
            .items-table th, .items-table td {
                padding: 10px;
                text-align: left;
                border: 1px solid #000;
            }
            .items-table th {
                background-color: #EFF6FF;
                font-weight: 600;
                text-transform: uppercase;
                font-size: 10px;
                color: #0052A3;
            }
            .items-table .text-right { text-align: right; }
            .items-table .text-center { text-align: center; }
            
            .summary-section {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-top: 25px;
                padding-top: 15px;
                border-top: 2px solid #000;
            }
            .summary-left { width: 60%; }
            .summary-right { width: 38%; }

            .totals-table {
                width: 100%;
            }
            .totals-table td {
                padding: 8px 10px;
                display: flex;
                justify-content: space-between;
                border-bottom: 1px solid #e5e7eb;
            }
            .totals-table tr:last-child td { border-bottom: none; }
            .totals-table .grand-total td {
                font-weight: bold;
                font-size: 14px;
                background-color: #DBEAFE;
                color: #0052A3;
                border-radius: 6px;
            }
            .rupees-in-words {
                font-size: 12px;
                margin-bottom: 15px;
                padding: 10px;
                border-radius: 6px;
                background-color: #F9FAFB;
                border: 1px solid #e5e7eb;
                min-height: 40px;
            }
            .rupees-in-words strong {
                color: #0052A3;
            }
            .rupees-in-words span {
                font-weight: normal;
            }
            .bank-details, .terms {
                padding: 10px;
                border-radius: 6px;
                background-color: #F9FAFB;
                margin-top: 10px;
            }
            .bank-details h4, .terms h4 {
                margin: 0 0 5px 0;
                font-weight: bold;
                font-size: 11px;
                color: #0052A3;
            }
             .terms {
                border: 2px solid #000;
             }
            .footer {
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                text-align: center;
                margin-top: 40px;
                padding-top: 20px;
                border-top: 2px solid #000;
                font-size: 11px;
                color: #6B7280;
            }
            .footer div {
                width: 45%;
            }
            .footer .signature-line {
                border-top: 1px solid #000;
                padding-top: 5px;
                margin-bottom: 50px;
            }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <div class="header">
                <div class="company-details">
                    <h2>{{{businessName}}}</h2>
                    <p>{{{businessAddress}}}</p>
                    <p><strong>GSTIN:</strong> {{{businessGstin}}}</p>
                    <p><strong>Email:</strong> {{{businessEmail}}} | <strong>Phone:</strong> {{{businessPhone}}}</p>
                </div>
                <div class="header-right">
                    <h2 class="invoice-title">TAX INVOICE</h2>
                    <div class="meta-grid">
                        <span class="label">Invoice #:</span><span class="value">{{{invoiceNumber}}}</span>
                        <span class="label">Date:</span><span class="value">{{{invoiceDate}}}</span>
                        <span class="label">E-Way Bill:</span><span class="value">{{#if eWayBillNumber}}{{{eWayBillNumber}}}{{else}}N/A{{/if}}</span>
                        <span class="label">Transporter:</span><span class="value">{{#if transporterName}}{{{transporterName}}}{{else}}N/A{{/if}}</span>
                        <span class="label">Vehicle No:</span><span class="value">{{#if transporterVehicleNumber}}{{{transporterVehicleNumber}}}{{else}}N/A{{/if}}</span>
                        <span class="label">Place of Supply:</span><span class="value">{{#if placeOfSupply}}{{{placeOfSupply}}}{{else}}N/A{{/if}}</span>
                    </div>
                </div>
            </div>

            <div class="details-section">
                <div class="info-block">
                    <h3>Details of Receiver (Billed To)</h3>
                     <div class="field-grid">
                        <span class="label">Name:</span> <span>{{{customerName}}}</span>
                        <span class="label">Address:</span> <span>{{{customerAddress}}}</span>
                        <span class="label">Phone:</span> <span>{{#if customerPhone}}{{{customerPhone}}}{{else}}____________________{{/if}}</span>
                        <span class="label">State:</span> <span>{{#if customerState}}{{{customerState}}}{{else}}____________________{{/if}}</span>
                        <span class="label">Code:</span> <span>{{{customerStateCode}}}</span>
                        <span class="label">GSTIN:</span> <span>{{#if customerGstin}}{{{customerGstin}}}{{else}}____________________{{/if}}</span>
                     </div>
                </div>
                <div class="info-block">
                    <h3>Details of Consignee (Shipped To)</h3>
                     <div class="field-grid">
                        <span class="label">Name:</span> <span>{{#if deliveryPlaceName}}{{{deliveryPlaceName}}}{{else}}{{{customerName}}}{{/if}}</span>
                        <span class="label">Address:</span> <span>{{#if deliveryAddress}}{{{deliveryAddress}}}{{else}}{{{customerAddress}}}{{/if}}</span>
                        <span class="label">Phone:</span> <span>{{#if customerPhone}}{{{customerPhone}}}{{else}}____________________{{/if}}</span>
                        <span class="label">State:</span> <span>{{#if deliveryState}}{{{deliveryState}}}{{else}}{{{customerState}}}{{/if}}</span>
                        <span class="label">Code:</span> <span>{{{deliveryStateCode}}}</span>
                        <span class="label">GSTIN:</span> <span>{{#if deliveryGstin}}{{{deliveryGstin}}}{{else}}{{#if customerGstin}}{{{customerGstin}}}{{else}}____________________{{/if}}{{/if}}</span>
                    </div>
                </div>
            </div>
            
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
                    {{#if (shouldAddEmptyRows items)}}
                        {{#each (getEmptyRows items)}}
                        <tr>
                            <td>&nbsp;</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                        </tr>
                        {{/each}}
                    {{/if}}
                </tbody>
            </table>

            <div class="summary-section">
                <div class="summary-left">
                    <div class="rupees-in-words">
                        <strong>Amount in Words:</strong><br/>
                        <span>{{{totalInWords}}}</span>
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
             <div class="terms">
                <h4>Terms & Conditions</h4>
                <p>Goods once sold will not be taken back or exchanged. Subject to Agra Jurisdiction only. E. & O. E.</p>
            </div>


            <div class="footer">
                <div style="text-align: left;">For <strong>Adhunik Marbles</strong></div>
                <div>
                    <div class="signature-line"></div>
                    Authorised Signature
                </div>
            </div>

        </div>
    </body>
    </html>
    `;
    Handlebars.registerHelper('addOne', (value: number) => value + 1);

    const MIN_ROWS = 8;

    Handlebars.registerHelper('shouldAddEmptyRows', function(items) {
        return items.length < MIN_ROWS;
    });

    Handlebars.registerHelper('getEmptyRows', function(items) {
        const emptyRowsCount = MIN_ROWS - items.length;
        return Array(emptyRowsCount).fill({});
    });


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

    
