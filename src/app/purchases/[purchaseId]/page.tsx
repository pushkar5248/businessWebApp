
"use client";

import { useParams } from 'next/navigation';
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { purchasesData, type Purchase, type PurchaseStatus } from '@/lib/data';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrency } from '@/context/currency-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";


const getBadgeVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case 'received':
      return 'default';
    case 'pending':
      return 'secondary';
    default:
      return 'outline';
  }
};

const purchaseStatuses: PurchaseStatus[] = ['Received', 'Pending'];

export default function PurchaseDetailsPage() {
    const params = useParams();
    const { purchaseId } = params;
    const { formatCurrency, formatCurrencyValue } = useCurrency();
    const { toast } = useToast();

    const [purchase, setPurchase] = useState<Purchase | undefined>(
        purchasesData.find(p => p.id === purchaseId)
    );

    if (!purchase) {
        notFound();
    }

    const handleStatusChange = (newStatus: PurchaseStatus) => {
        if (purchase) {
            const updatedPurchase = { ...purchase, status: newStatus };
            setPurchase(updatedPurchase);
            
            const index = purchasesData.findIndex(p => p.id === purchase.id);
            if (index !== -1) {
                purchasesData[index] = updatedPurchase;
            }

            toast({
                title: "Status Updated",
                description: `Purchase order status changed to ${newStatus}.`
            });
        }
    };
    
    const subtotal = purchase.items.reduce((acc, item) => acc + (item.quantity * item.price), 0);

    return (
        <MainLayout>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Link href="/purchases">
                  <Button variant="outline" size="icon">
                    <ArrowLeft />
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold font-headline">Purchase Order {purchase.id}</h1>
                  <p className="text-muted-foreground">Details for PO sent to {purchase.vendor}.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="flex items-center gap-2">
                             <Badge variant={getBadgeVariant(purchase.status)}>{purchase.status}</Badge>
                             <ChevronDown className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                    {purchaseStatuses.map(status => (
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
                    <CardTitle>PO Details</CardTitle>
                    <CardDescription>
                        Date: {purchase.date}
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="font-semibold mb-2">Vendor</h3>
                        <p>{purchase.vendor}</p>
                        <p>{purchase.vendorAddress}</p>
                    </div>
                     {purchase.shippingAddress && (
                         <div>
                            <h3 className="font-semibold mb-2">Shipping Address</h3>
                            <p>{purchase.shippingAddress}</p>
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
                            {purchase.items.map((item, index) => (
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
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total</span>
                            <span>{formatCurrencyValue(purchase.amount)}</span>
                        </div>
                    </div>
                </CardFooter>
            </Card>

        </MainLayout>
    );
}
