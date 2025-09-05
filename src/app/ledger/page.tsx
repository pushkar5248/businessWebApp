
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import type { Sale, Purchase } from "@/lib/types";
import { useCurrency } from "@/context/currency-context";
import { Loader2, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/context/settings-context";
import { generateLedgerPdf } from "@/ai/flows/generate-ledger-pdf";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type LedgerEntry = {
  date: string;
  particulars: string;
  voucherType: "Sale" | "Purchase" | "Payment" | "Receipt";
  voucherNumber: string;
  debit: number;
  credit: number;
};

export default function CustomerLedgerPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [people, setPeople] = useState<string[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [ledgerData, setLedgerData] = useState<LedgerEntry[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);

  const fetchPeople = useCallback(async () => {
    if (!user) {
        // Guest mode data
        const salesCustomers = ["Prestige Construction", "Dream Homes Pvt. Ltd.", "Mr. John Smith", "Modern Architects", "City Mall Project"];
        const purchaseVendors = ["Verona Stones", "Stone Solutions", "Quartz Co.", "Mountain Slate", "Rock Garden"];
        const uniquePeople = [...new Set([...salesCustomers, ...purchaseVendors])];
        setPeople(uniquePeople.sort());
        setIsLoading(false);
        return;
    };

    setIsLoading(true);
    try {
      const salesQuery = query(collection(db, "sales"), where("userId", "==", user.uid));
      const purchasesQuery = query(collection(db, "purchases"), where("userId", "==", user.uid));

      const [salesSnapshot, purchasesSnapshot] = await Promise.all([
        getDocs(salesQuery),
        getDocs(purchasesQuery),
      ]);
      
      const customers = salesSnapshot.docs.map(doc => (doc.data() as Sale).customer);
      const vendors = purchasesSnapshot.docs.map(doc => (doc.data() as Purchase).vendor);
      
      const uniquePeople = [...new Set([...customers, ...vendors])];
      setPeople(uniquePeople.sort());

    } catch (error) {
      console.error("Error fetching people:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);
  
  const fetchLedgerData = useCallback(async (person: string) => {
    if (!user) {
        setLedgerData([]);
        return;
    };
    
    setIsLoading(true);
    try {
      const salesQuery = query(
        collection(db, "sales"),
        where("userId", "==", user.uid),
        where("customer", "==", person)
      );
      const purchasesQuery = query(
        collection(db, "purchases"),
        where("userId", "==", user.uid),
        where("vendor", "==", person)
      );

      const [salesSnapshot, purchasesSnapshot] = await Promise.all([
        getDocs(salesQuery),
        getDocs(purchasesQuery),
      ]);

      const salesEntries: LedgerEntry[] = salesSnapshot.docs.map(doc => {
        const sale = doc.data() as Sale;
        return {
          date: sale.date,
          particulars: `Sales to ${sale.customer}`,
          voucherType: "Sale",
          voucherNumber: sale.id,
          debit: sale.amount,
          credit: 0,
        };
      });

      const purchaseEntries: LedgerEntry[] = purchasesSnapshot.docs.map(doc => {
        const purchase = doc.data() as Purchase;
        return {
          date: purchase.date,
          particulars: `Purchase from ${purchase.vendor}`,
          voucherType: "Purchase",
          voucherNumber: purchase.id,
          debit: 0,
          credit: purchase.amount,
        };
      });

      const combinedEntries = [...salesEntries, ...purchaseEntries].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      setLedgerData(combinedEntries);
      
    } catch (error) {
        console.error("Error fetching ledger data:", error);
    } finally {
        setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (selectedPerson) {
      fetchLedgerData(selectedPerson);
    } else {
      setLedgerData([]);
    }
  }, [selectedPerson, fetchLedgerData]);

  const { totalDebit, totalCredit, closingBalance, processedLedger } = useMemo(() => {
    let runningBalance = openingBalance;
    const processedLedger = ledgerData.map(entry => {
      runningBalance = runningBalance + entry.debit - entry.credit;
      return { ...entry, balance: runningBalance };
    });

    const totalDebit = ledgerData.reduce((acc, entry) => acc + entry.debit, 0);
    const totalCredit = ledgerData.reduce((acc, entry) => acc + entry.credit, 0);
    const closingBalance = openingBalance + totalDebit - totalCredit;
    
    return { totalDebit, totalCredit, closingBalance, processedLedger };
  }, [ledgerData, openingBalance]);
  
  const handleGeneratePdf = async () => {
    if (!selectedPerson || !settings) {
         toast({
            variant: "destructive",
            title: "Error",
            description: "Please select a person and ensure settings are loaded.",
        });
        return;
    };
    setIsGeneratingPdf(true);
    try {
        const result = await generateLedgerPdf({
            businessName: settings.general.businessName,
            businessAddress: settings.general.businessAddress,
            reportDate: new Date().toLocaleDateString(),
            personName: selectedPerson,
            entries: processedLedger.map(e => ({
                ...e,
                date: new Date(e.date).toLocaleDateString(),
                debit: e.debit > 0 ? formatCurrency(e.debit) : '-',
                credit: e.credit > 0 ? formatCurrency(e.credit) : '-',
                balance: formatCurrency(e.balance) + (e.balance >= 0 ? ' Dr' : ' Cr')
            })),
            openingBalance: formatCurrency(openingBalance) + (openingBalance >= 0 ? ' Dr' : ' Cr'),
            totalDebit: formatCurrency(totalDebit),
            totalCredit: formatCurrency(totalCredit),
            closingBalance: formatCurrency(closingBalance) + (closingBalance >= 0 ? ' Dr' : ' Cr'),
        });

        if (result && result.html) {
            const container = document.createElement('div');
            container.innerHTML = result.html;
            document.body.appendChild(container);

            const canvas = await html2canvas(container.querySelector('.ledger-container')!, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            
            document.body.removeChild(container);
            
            pdf.save(`ledger-${selectedPerson.replace(/\s/g, '_')}.pdf`);
             toast({
              title: "Success",
              description: "Ledger PDF has been generated successfully.",
            });

        } else {
             throw new Error("PDF generation failed, no HTML returned.");
        }
    } catch (error) {
        console.error("Error generating ledger PDF:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not generate ledger PDF." });
    } finally {
        setIsGeneratingPdf(false);
    }
  };


  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold font-headline">Customer Ledger</h1>
          <p className="text-muted-foreground">
            View the detailed financial ledger for any customer or vendor.
          </p>
        </div>
         <Button onClick={handleGeneratePdf} disabled={isGeneratingPdf || !selectedPerson}>
            {isGeneratingPdf ? <Loader2 className="mr-2 animate-spin" /> : <FileDown className="mr-2" />}
            Generate PDF
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ledger Report</CardTitle>
          <CardDescription>
            Select a person to view their complete transaction history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md mb-6">
            <Select onValueChange={setSelectedPerson} value={selectedPerson || ""}>
              <SelectTrigger>
                <SelectValue placeholder="Select a customer or vendor..." />
              </SelectTrigger>
              <SelectContent>
                {people.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading && selectedPerson && (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}

          {!isLoading && selectedPerson && (
            <div>
              <div className="flex justify-between items-center mb-2 p-2 bg-muted/50 rounded-md">
                 <h3 className="font-semibold text-lg">{selectedPerson}'s Ledger</h3>
                 <div className="text-right">
                    <p className="text-sm text-muted-foreground">Opening Balance</p>
                    <p className="font-semibold">{formatCurrency(openingBalance)}</p>
                 </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Particulars</TableHead>
                    <TableHead>Vch Type</TableHead>
                    <TableHead>Vch No.</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedLedger.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center h-24">No transactions found for this person.</TableCell>
                    </TableRow>
                  )}
                  {processedLedger.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                      <TableCell>{entry.particulars}</TableCell>
                      <TableCell>{entry.voucherType}</TableCell>
                      <TableCell>{entry.voucherNumber}</TableCell>
                      <TableCell className="text-right">{entry.debit > 0 ? formatCurrency(entry.debit) : "-"}</TableCell>
                      <TableCell className="text-right">{entry.credit > 0 ? formatCurrency(entry.credit) : "-"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.balance)} {entry.balance >= 0 ? 'Dr' : 'Cr'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end mt-4">
                <div className="w-full max-w-sm space-y-2 border-t pt-4">
                  <div className="flex justify-between font-semibold">
                    <span>Total Debit:</span>
                    <span>{formatCurrency(totalDebit)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Total Credit:</span>
                    <span>{formatCurrency(totalCredit)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                    <span>Closing Balance:</span>
                    <span>{formatCurrency(closingBalance)} {closingBalance >= 0 ? 'Dr' : 'Cr'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </MainLayout>
  );
}
