
"use client";
import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { MainLayout } from "@/components/layout/main-layout";
import { inventoryData, salesData } from "@/lib/data";
import { DollarSign, Boxes, ShoppingCart, Users, Loader2 } from "lucide-react";
import { useCurrency } from '@/context/currency-context';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { Sale } from '@/lib/types';


const chartConfig = {
  sales: {
    label: "Sales",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { formatCurrency, formatCurrencyValue } = useCurrency();
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalSalesCount, setTotalSalesCount] = useState(0);
  const [stockItemsCount, setStockItemsCount] = useState(0);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [salesChartData, setSalesChartData] = useState<{ month: string; sales: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const setupGuestData = () => {
    const paidSales = salesData.filter(s => !s.deletedAt && s.status === 'Paid');
    const allSales = salesData.filter(s => !s.deletedAt);
    const revenue = paidSales.reduce((acc, sale) => acc + sale.amount, 0);
    setTotalRevenue(revenue);
    setTotalSalesCount(paidSales.length);
    setRecentSales(allSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setStockItemsCount(inventoryData.length);
    
    const months = Array(6).fill(0).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return {
          label: d.toLocaleString('default', { month: 'short' }),
          year: d.getFullYear(),
          month: d.getMonth(),
          sales: 0
      };
     }).reverse();

      paidSales.forEach(sale => {
          const saleDate = new Date(sale.date);
          const saleYear = saleDate.getFullYear();
          const saleMonth = saleDate.getMonth();

          const monthData = months.find(m => m.year === saleYear && m.month === saleMonth);
          if (monthData) {
              monthData.sales += sale.amount;
          }
      });
      setSalesChartData(months.map(m => ({ month: m.label, sales: m.sales })));
    setIsLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    
    setIsLoading(true);

    if (!user) {
        setupGuestData();
        return;
    }

    // Real-time listener for sales data
    const salesQuery = query(collection(db, "sales"), where("userId", "==", user.uid), where("deletedAt", "==", null));
    const unsubscribeSales = onSnapshot(salesQuery, (querySnapshot) => {
        const allSalesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
        const paidSalesList = allSalesList.filter(s => s.status === 'Paid');

        const revenue = paidSalesList.reduce((acc, sale) => acc + sale.amount, 0);
        setTotalRevenue(revenue);
        setTotalSalesCount(paidSalesList.length);
        setRecentSales(allSalesList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

        const months = Array(6).fill(0).map((_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            return {
                label: d.toLocaleString('default', { month: 'short' }),
                year: d.getFullYear(),
                month: d.getMonth(),
                sales: 0
            };
        }).reverse();

        paidSalesList.forEach(sale => {
            const saleDate = new Date(sale.date);
            const saleYear = saleDate.getFullYear();
            const saleMonth = saleDate.getMonth();
            const monthData = months.find(m => m.year === saleYear && m.month === saleMonth);
            if (monthData) {
                monthData.sales += sale.amount;
            }
        });
        setSalesChartData(months.map(m => ({ month: m.label, sales: m.sales })));
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching sales data:", error);
        setIsLoading(false);
    });

    // Real-time listener for inventory data
    const inventoryQuery = query(collection(db, "inventory"), where("userId", "==", user.uid));
    const unsubscribeInventory = onSnapshot(inventoryQuery, (querySnapshot) => {
        setStockItemsCount(querySnapshot.size);
    }, (error) => {
        console.error("Error fetching inventory count:", error);
    });


    // Cleanup function
    return () => {
      unsubscribeSales();
      unsubscribeInventory();
    };
  }, [user, authLoading]);

  if (isLoading || authLoading) {
    return (
        <MainLayout>
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Based on all-time paid sales
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{totalSalesCount}</div>
            <p className="text-xs text-muted-foreground">
              Total number of paid invoices
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Items</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockItemsCount}</div>
            <p className="text-xs text-muted-foreground">Different items in inventory</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">...</div>
            <p className="text-xs text-muted-foreground">
              Feature coming soon
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Sales Overview</CardTitle>
            <CardDescription>
              Your total paid sales revenue over the last 6 months.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
              <BarChart accessibilityLayer data={salesChartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                 <YAxis 
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    tickFormatter={(value) => formatCurrencyValue(value).replace(/\.00$/, '')}
                 />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />}
                />
                <Bar dataKey="sales" fill="var(--color-sales)" radius={8} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
            <CardDescription>
              Your most recent sales invoices (all statuses).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-12 px-4">Customer</TableHead>
                  <TableHead className="text-right h-12 px-4">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSales.slice(0, 5).map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>
                      <div className="font-medium">{sale.customer}</div>
                      <div className="hidden text-sm text-muted-foreground md:inline">
                        {sale.id}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(sale.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
