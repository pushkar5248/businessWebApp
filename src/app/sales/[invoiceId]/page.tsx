
"use client";

import { useParams } from 'next/navigation';
import React, { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { type SaleStatus, type Sale } from '@/lib/types';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrency } from '@/context/currency-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, FileDown, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from 'next/link';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  generateInvoicePdf,
  type GenerateInvoicePdfInput,
} from "@/ai/flows/generate-invoice-pdf";
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useSettings } from '@/context/settings-context';
import { updateStockOnSale } from '@/services/inventory-service';


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

const saleStatuses: SaleStatus[] = ['Paid', 'Pending', 'Overdue'];

export default function InvoiceDetailsPage() {
    const params = useParams();
    const { invoiceId } = params;
    const { currency, formatCurrency, formatCurrencyValue } = useCurrency();
    const { toast } = useToast();
    const { settings } = useSettings();
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [invoice, setInvoice] = useState<Sale | null>(null);

    const fetchInvoice = useCallback(async () => {
        if (!invoiceId) return;
        setIsLoading(true);
        try {
            const invoiceDocRef = doc(db, "sales", invoiceId as string);
            const invoiceDocSnap = await getDoc(invoiceDocRef);

            if (invoiceDocSnap.exists()) {
                setInvoice({ id: invoiceDocSnap.id, ...invoiceDocSnap.data() } as Sale);
            } else {
                setInvoice(null);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to fetch invoice details." });
        } finally {
            setIsLoading(false);
        }
    }, [invoiceId, toast]);

    useEffect(() => {
        fetchInvoice();
    }, [fetchInvoice]);

    const handleStatusChange = async (newStatus: SaleStatus) => {
        if (!invoice || newStatus === invoice.status) return;

        const oldStatus = invoice.status;
        
        try {
            // First, update the status in Firestore.
            const invoiceRef = doc(db, "sales", invoice.id);
            await updateDoc(invoiceRef, { status: newStatus });

            // If status changes from Pending to Paid, update inventory.
            if (oldStatus === 'Pending' && newStatus === 'Paid') {
                 console.log(`Condition met: Status changed from ${oldStatus} to ${newStatus}. Triggering inventory update.`);
                
                 // Re-fetch the document to ensure we have the latest item data
                 const freshInvoiceSnap = await getDoc(invoiceRef);
                 if (freshInvoiceSnap.exists()) {
                    const freshInvoiceData = freshInvoiceSnap.data() as Sale;
                    console.log("Fresh invoice data fetched for inventory update:", freshInvoiceData);
                    await updateStockOnSale(freshInvoiceData.items);
                    toast({
                        title: "Inventory Updated",
                        description: "Stock levels have been decreased for the items in this sale."
                    });
                 } else {
                     throw new Error("Could not re-fetch invoice for inventory update.");
                 }
            }

            // Update local state to reflect the change in the UI.
            setInvoice({ ...invoice, status: newStatus });
            toast({
                title: "Status Updated",
                description: `Invoice status changed to ${newStatus}.`
            });
        } catch (error) {
            console.error("Error updating status or inventory:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to update status or inventory." });
            // Optionally revert local state if update fails
            setInvoice({ ...invoice, status: oldStatus });
        }
    };

    if (isLoading || !settings) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </MainLayout>
        );
    }
    
    if (!invoice) {
        notFound();
    }

    const subtotal = invoice.items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    const cgstAmount = subtotal * ((invoice.cgstRate || 0) / 100);
    const sgstAmount = subtotal * ((invoice.sgstRate || 0) / 100);
    const igstAmount = subtotal * ((invoice.igstRate || 0) / 100);
    const totalTaxes = cgstAmount + sgstAmount + igstAmount;
    
    const handleGeneratePdf = async () => {
        if (!invoice || !settings) {
             toast({
                variant: "destructive",
                title: "Error",
                description: "Invoice or settings data is not available.",
            });
            return;
        };
        setIsGenerating(true);
        try {
          const input: GenerateInvoicePdfInput = {
            businessName: settings.general.businessName,
            businessAddress: settings.general.businessAddress,
            businessPhone: settings.general.businessPhone,
            businessEmail: settings.general.businessEmail,
            businessGstin: settings.general.businessGstin,
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
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="flex items-center gap-2">
                             <Badge variant={getBadgeVariant(invoice.status)}>{invoice.status}</Badge>
                             <ChevronDown className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                    {saleStatuses.map(status => (
                        <DropdownMenuItem key={status} onSelect={() => handleStatusChange(status)}>
                            {status}
                        </DropdownMenuItem>
                    ))}
                    </DropdownMenuContent>
                </DropdownMenu>
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
