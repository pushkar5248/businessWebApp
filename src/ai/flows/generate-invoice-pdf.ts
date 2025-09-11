
'use server';

/**
 * @fileOverview Invoice HTML generation flow using Genkit.
 *
 * - generateInvoicePdf - A function that generates an HTML string of an invoice based on the provided data and template.
 * - GenerateInvoicePdfInput - The input type for the generateInvoiceHtml function, defining the invoice data.
 * - GenerateInvoiceHtmlOutput - The return type for the generateInvoiceHtml function, providing the HTML as a string.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import Handlebars from 'handlebars';


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
        <title>TAX INVOICE</title>
        <style>
            body {
                font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif;
                color: #333;
                background-color: #fff;
            }
            .invoice-container {
                width: 800px;
                margin: auto;
                padding: 20px;
                border: 1px solid #eee;
            }
            .header {
                text-align: center;
                margin-bottom: 20px;
            }
            .header h1 {
                margin: 0;
                font-size: 20px;
                font-weight: bold;
            }
            .header .ganesh {
                font-size: 12px;
                margin-bottom: 5px;
            }
            .header .contact {
                font-size: 12px;
                position: absolute;
                top: 20px;
                right: 20px;
            }
            .company-details {
                text-align: center;
                margin-bottom: 10px;
            }
            .company-details h2 {
                margin: 0;
                font-size: 32px;
                font-weight: bold;
            }
            .company-details p {
                margin: 2px 0;
                font-size: 12px;
            }
            .meta-info {
                display: flex;
                justify-content: space-between;
                border-top: 2px solid #000;
                border-bottom: 2px solid #000;
                padding: 5px 0;
                margin-bottom: 10px;
                font-size: 14px;
            }
            .transporter-details {
                border: 1px solid #000;
                padding: 5px;
                margin-bottom: 10px;
                font-size: 12px;
            }
            .transporter-details table {
                width: 100%;
                border-collapse: collapse;
            }
             .transporter-details td {
                padding: 2px 5px;
             }
            .invoice-details {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
            }
            .invoice-details .info-block {
                width: 48%;
                border: 1px solid #000;
                padding: 10px;
            }
            .info-block .title {
                font-weight: bold;
                border-bottom: 1px solid #000;
                padding-bottom: 5px;
                margin-bottom: 5px;
            }
            .info-block p {
                margin: 3px 0;
                font-size: 12px;
            }
             .info-block .field-row {
                display: flex;
                justify-content: space-between;
            }
            .items-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 10px;
            }
            .items-table th, .items-table td {
                border: 1px solid #000;
                padding: 8px;
                font-size: 12px;
            }
            .items-table th {
                text-align: center;
            }
            .items-table .om-logo {
                text-align: center;
                font-size: 100px;
                opacity: 0.1;
                height: 150px;
            }
            .footer-section {
                display: flex;
                justify-content: space-between;
                margin-top: 10px;
                font-size: 12px;
            }
            .footer-left {
                width: 60%;
            }
            .footer-right {
                width: 38%;
            }
            .totals-table {
                width: 100%;
                border-collapse: collapse;
            }
            .totals-table td {
                border: 1px solid #000;
                padding: 5px;
                display: flex;
                justify-content: space-between;
            }
            .totals-table .grand-total td {
                font-weight: bold;
            }
            .bank-details {
                border-top: 1px solid #000;
                margin-top: 10px;
                padding-top: 5px;
            }
            .bank-details p {
                font-weight: bold;
                margin: 2px 0;
            }
            .terms {
                margin-top: 10px;
                border-top: 1px solid #000;
                padding-top: 5px;
            }
            .signature {
                text-align: right;
                margin-top: 20px;
            }
            .signature p {
                margin:0;
            }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <div class="header">
                <p class="ganesh">।। श्री गणेशाय नमः ।।</p>
                <h1>TAX INVOICE</h1>
                <div class="contact">
                    <p>M.: 9760026605</p>
                    <p>6396871665</p>
                </div>
            </div>

            <div class="company-details">
                <h2>{{{businessName}}}</h2>
                <p>White & Coloured Marbles, Slabs Kota Stone, Granite & Tiles</p>
                <p>{{{businessAddress}}}</p>
            </div>

            <div class="meta-info">
                <div>GSTIN No.: {{{businessGstin}}}</div>
                <div>Phone: {{{businessPhone}}}</div>
            </div>

            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 10px;">
                <div style="width: 48%;">Invoice No.: <strong>{{{invoiceNumber}}}</strong></div>
                <div style="width: 48%;">Invoice Date: <strong>{{{invoiceDate}}}</strong></div>
            </div>
            
            <div class="transporter-details">
                <table>
                    <tr>
                        <td><strong>Transporter Name:</strong> {{#if transporterName}}{{{transporterName}}}{{else}}____________________{{/if}}</td>
                        <td><strong>Vehicle No.:</strong> {{#if transporterVehicleNumber}}{{{transporterVehicleNumber}}}{{else}}____________________{{/if}}</td>
                    </tr>
                    <tr>
                        <td><strong>Place of Supply:</strong> {{#if placeOfSupply}}{{{placeOfSupply}}}{{else}}____________________{{/if}}</td>
                        <td><strong>Date:</strong> {{#if transportDate}}{{{transportDate}}}{{else}}____________________{{/if}}</td>
                    </tr>
                </table>
            </div>

            <div class="invoice-details">
                <div class="info-block">
                    <div class="title">Details of Recipient (Purchasers)</div>
                    <p><strong>Name:</strong> {{{customerName}}}</p>
                    <p><strong>Address:</strong> {{{customerAddress}}}</p>
                    <div class="field-row"><p><strong>State:</strong> {{#if customerState}}{{{customerState}}}{{else}}____________{{/if}}</p> <p><strong>Code:</strong> ___</p></div>
                    <p><strong>GSTIN/UIN:</strong> {{#if customerGstin}}{{{customerGstin}}}{{else}}____________________{{/if}}</p>
                </div>
                <div class="info-block">
                    <div class="title">Delivery Place of Supply of Goods</div>
                    <p><strong>Name:</strong> {{#if deliveryPlaceName}}{{{deliveryPlaceName}}}{{else}}{{{customerName}}}{{/if}}</p>
                    <p><strong>Address:</strong> {{#if deliveryAddress}}{{{deliveryAddress}}}{{else}}{{{customerAddress}}}{{/if}}</p>
                    <div class="field-row"><p><strong>State:</strong> {{#if deliveryState}}{{{deliveryState}}}{{else}}_____________{{/if}}</p> <p><strong>Code:</strong> ___</p></div>
                    <p><strong>GSTIN/UIN:</strong> {{#if deliveryGstin}}{{{deliveryGstin}}}{{else}}____________________{{/if}}</p>
                </div>
            </div>

            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 5%;">Sr No</th>
                        <th>Product Name</th>
                        <th style="width: 10%;">HSN Code</th>
                        <th style="width: 8%;">Qty</th>
                        <th style="width: 8%;">Unit</th>
                        <th style="width: 12%;">Rate</th>
                        <th style="width: 15%;">Net Taxable Value of Goods</th>
                    </tr>
                </thead>
                <tbody>
                    {{#each items}}
                    <tr>
                        <td style="text-align: center;">{{addOne @index}}</td>
                        <td>{{{name}}}</td>
                        <td style="text-align: center;">{{{hsnCode}}}</td>
                        <td style="text-align: right;">{{{quantity}}}</td>
                        <td style="text-align: center;">{{{unit}}}</td>
                        <td style="text-align: right;">{{{../currency}}}{{{price}}}</td>
                        <td style="text-align: right;">{{{../currency}}}{{{itemTotal}}}</td>
                    </tr>
                    {{/each}}
                    <tr>
                      <td colspan="7" class="om-logo">ॐ</td>
                    </tr>
                </tbody>
            </table>

            <div class="footer-section">
                <div class="footer-left">
                    <p><strong>Electronics Reference No.</strong>.....................................</p>
                    <p><strong>Rupees in Words</strong>: {{{totalInWords}}}</p>
                    <div class="bank-details">
                        <p>Bank Details : IDFC FIRST BANK, FATEHABAD ROAD, AGRA</p>
                        <p>CA A/c No.: 10067934008</p>
                        <p>IFSC Code: IDFB0021293</p>
                    </div>
                </div>
                <div class="footer-right">
                    <table class="totals-table">
                        <tr>
                            <td><span>Total Value of Supply of Goods Before GST</span> <span>{{{currency}}}{{{subtotal}}}</span></td>
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
                          <td><span>Round Off / Other Charge, If Any</span> <span>{{{currency}}}{{{roundOff}}}</span></td>
                        </tr>
                        <tr class="grand-total">
                            <td><span>Grand Total of Invoice</span> <span>{{{currency}}}{{{total}}}</span></td>
                        </tr>
                    </table>
                </div>
            </div>

            <div class="terms">
                <p>E. & O. E.</p>
                <p>Goods once sold will not be taken back or exchanged</p>
                <p>Subject to Agra Jurisdiction only</p>
            </div>
            
            <div class="signature">
                <p>For <strong>Adhunik Marbles</strong></p>
                <br/><br/>
                <p>Auth Signatory</p>
            </div>

        </div>
    </body>
    </html>
    `;

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
        totalInWords: toWords(roundedTotal)
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

    

    
