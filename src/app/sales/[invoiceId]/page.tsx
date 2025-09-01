
"use client";

import { useParams } from 'next/navigation';
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { salesData } from '@/lib/data';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrency } from '@/context/currency-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, FileDown } from 'lucide-react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  generateInvoicePdf,
  type GenerateInvoicePdfInput,
} from "@/ai/flows/generate-invoice-pdf";
import { useToast } from "@/hooks/use-toast";


const getBadgeVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case 'paid':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'overdue':
      return 'destructive';
    default:
      return 'outline';
  }
};

export default function InvoiceDetailsPage() {
    const params = useParams();
    const { invoiceId } = params;
    const { currency, formatCurrency, formatCurrencyValue } = useCurrency();
    const { toast } = useToast();
    const [isGenerating, setIsGenerating] = useState(false);

    const invoice = salesData.find(sale => sale.id === invoiceId);

    if (!invoice) {
        notFound();
    }

    const subtotal = invoice.items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    const cgstAmount = subtotal * ((invoice.cgstRate || 0) / 100);
    const sgstAmount = subtotal * ((invoice.sgstRate || 0) / 100);
    const igstAmount = subtotal * ((invoice.igstRate || 0) / 100);
    const totalTaxes = cgstAmount + sgstAmount + igstAmount;

    const handleGeneratePdf = async () => {
        setIsGenerating(true);
        try {
          const input: GenerateInvoicePdfInput = {
            businessName: "Adhunik Marbles",
            businessAddress: "New Suraksha Vihar Colony, Gwalior Road, Agra 282 009",
            businessPhone: "9760026605, 6396871665",
            businessEmail: "contact@adhunikmarbles.com",
            businessGstin: "09AGZPA5852F1Z0",
            invoiceNumber: invoice.id,
            invoiceDate: invoice.date,
            customerName: invoice.customer,
            customerAddress: invoice.customerAddress,
            customerPhone: invoice.customerPhone,
            customerState: invoice.customerState,
            customerGstin: invoice.customerGstin,
            deliveryPlaceName: invoice.deliveryPlaceName,
            deliveryAddress: invoice.deliveryAddress,
            deliveryState: invoice.deliveryState,
            deliveryGstin: invoice.deliveryGstin,
            transporterName: invoice.transporterName,
            transporterVehicleNumber: invoice.transporterVehicleNumber,
            placeOfSupply: invoice.placeOfSupply,
            transportDate: invoice.transportDate,
            items: invoice.items.map((item) => ({ ...item })),
            cgstRate: invoice.cgstRate,
            sgstRate: invoice.sgstRate,
            igstRate: invoice.igstRate,
            total: invoice.amount,
            currency: currency,
          };

          const result = await generateInvoicePdf(input);
          
          if (result && result.html) {
            const invoiceElement = document.createElement('div');
            invoiceElement.innerHTML = result.html;
            document.body.appendChild(invoiceElement);
            
            const canvas = await html2canvas(invoiceElement.querySelector('.invoice-container')!, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            
            document.body.removeChild(invoiceElement);
            
            pdf.save(`invoice-${invoice.id}.pdf`);
            
            toast({
              title: "Success",
              description: "Invoice PDF has been generated successfully.",
            });
          } else {
            throw new Error("PDF generation failed, no HTML returned.");
          }
        } catch (error) {
          console.error(error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to generate invoice. Please try again.",
          });
        } finally {
          setIsGenerating(false);
        }
    };

    return (
        <MainLayout>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Link href="/sales">
                  <Button variant="outline" size="icon">
                    <ArrowLeft />
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold font-headline">Invoice {invoice.id}</h1>
                  <p className="text-muted-foreground">Details for sale to {invoice.customer}.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleGeneratePdf} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="mr-2 animate-spin" /> : <FileDown className="mr-2" />}
                    Generate Invoice PDF
                </Button>
                <Badge variant={getBadgeVariant(invoice.status)} className="text-base px-4 py-2">{invoice.status}</Badge>
              </div>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Invoice Details</CardTitle>
                    <CardDescription>
                        Date: {invoice.date}
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="font-semibold mb-2">Customer</h3>
                        <p>{invoice.customer}</p>
                        <p>{invoice.customerAddress}</p>
                        <p>{invoice.customerPhone}</p>
                        {invoice.customerState && <p>State: {invoice.customerState}</p>}
                        {invoice.customerGstin && <p>GSTIN: {invoice.customerGstin}</p>}
                    </div>
                    {(invoice.deliveryAddress || invoice.deliveryPlaceName) && (
                         <div>
                            <h3 className="font-semibold mb-2">Delivery Address</h3>
                            {invoice.deliveryPlaceName && <p>{invoice.deliveryPlaceName}</p>}
                            {invoice.deliveryAddress && <p>{invoice.deliveryAddress}</p>}
                            {invoice.deliveryState && <p>State: {invoice.deliveryState}</p>}
                            {invoice.deliveryGstin && <p>GSTIN: {invoice.deliveryGstin}</p>}
                        </div>
                    )}
                    {(invoice.transporterName || invoice.transporterVehicleNumber || invoice.placeOfSupply || invoice.transportDate) && (
                         <div className="md:col-span-2">
                            <h3 className="font-semibold mb-2">Transporter Information</h3>
                            <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
                                {invoice.transporterName && <p><strong>Name:</strong> {invoice.transporterName}</p>}
                                {invoice.transporterVehicleNumber && <p><strong>Vehicle No:</strong> {invoice.transporterVehicleNumber}</p>}
                                {invoice.placeOfSupply && <p><strong>Place of Supply:</strong> {invoice.placeOfSupply}</p>}
                                {invoice.transportDate && <p><strong>Date:</strong> {invoice.transportDate}</p>}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Items</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item</TableHead>
                                <TableHead className="text-center">Quantity</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoice.items.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell className="text-center">{item.quantity}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.quantity * item.price)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
                 <CardFooter className="flex justify-end">
                    <div className="w-full max-w-sm space-y-2">
                        <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>{formatCurrencyValue(subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Taxes</span>
                            <span>{formatCurrencyValue(totalTaxes)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total</span>
                            <span>{formatCurrencyValue(invoice.amount)}</span>
                        </div>
                    </div>
                </CardFooter>
            </Card>

        </MainLayout>
    );
}
