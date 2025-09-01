"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MainLayout } from "@/components/layout/main-layout";
import { useCurrency } from '@/context/currency-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const currencies = [
  { value: 'USD', label: '$ (USD)' },
  { value: 'EUR', label: '€ (EUR)' },
  { value: 'JPY', label: '¥ (JPY)' },
  { value: 'GBP', label: '£ (GBP)' },
  { value: 'AUD', label: 'A$ (AUD)' },
  { value: 'CAD', label: 'C$ (CAD)' },
  { value: 'CHF', label: 'Fr (CHF)' },
  { value: 'CNY', label: '¥ (CNY)' },
  { value: 'INR', label: '₹ (INR)' },
  { value: 'RUP', label: '₹ (RUP)' },
];

function GeneralSettings() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>Update your company's details here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="business-name">Business Name</Label>
                    <Input id="business-name" defaultValue="Adhunik Marbles" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="business-gstin">Business GSTIN</Label>
                    <Input id="business-gstin" defaultValue="27ABCDE1234F1Z5" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="business-address">Business Address</Label>
                    <Textarea id="business-address" defaultValue="123 Marble Street, Stoneville, ST 45678" />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="business-phone">Business Phone</Label>
                        <Input id="business-phone" defaultValue="+91 98765 43210" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="business-email">Business Email</Label>
                        <Input id="business-email" type="email" defaultValue="contact@adhunikmarbles.com" />
                    </div>
                </div>
                <Button>Save Changes</Button>
            </CardContent>
        </Card>
    );
}

function AppearanceSettings() {
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        const theme = localStorage.getItem('theme');
        const darkMode = theme === 'dark';
        setIsDarkMode(darkMode);
        document.documentElement.classList.toggle('dark', darkMode);
    }, []);

    const toggleTheme = (checked: boolean) => {
        setIsDarkMode(checked);
        document.documentElement.classList.toggle('dark', checked);
        localStorage.setItem('theme', checked ? 'dark' : 'light');
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize the look and feel of your application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label className="text-base">Dark Mode</Label>
                        <p className="text-sm text-muted-foreground">
                            Enable a darker color scheme for the interface.
                        </p>
                    </div>
                    <Switch checked={isDarkMode} onCheckedChange={toggleTheme} />
                </div>
                <Button>Save Changes</Button>
            </CardContent>
        </Card>
    );
}

function BillingSettings() {
    const { currency, setCurrency } = useCurrency();
    const [localCurrency, setLocalCurrency] = useState(currency);

    useEffect(() => {
        setLocalCurrency(currency);
    }, [currency]);

    const handleSave = () => {
        setCurrency(localCurrency);
    };
    return (
        <Card>
            <CardHeader>
                <CardTitle>Billing</CardTitle>
                <CardDescription>Manage your invoice and billing settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="space-y-2">
                    <Label htmlFor="currency-symbol">Currency</Label>
                    <Select value={localCurrency} onValueChange={setLocalCurrency}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="default-cgst">Default CGST (%)</Label>
                        <Input id="default-cgst" type="number" defaultValue="9" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="default-sgst">Default SGST (%)</Label>
                        <Input id="default-sgst" type="number" defaultValue="9" />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="invoice-footer">Invoice Footer</Label>
                    <Input id="invoice-footer" defaultValue="Thank you for your business!" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="invoice-terms">Terms & Conditions</Label>
                    <Textarea id="invoice-terms" defaultValue="1. Payment due within 30 days. \n2. All sales are final." />
                </div>
                <Button onClick={handleSave}>Save Changes</Button>
            </CardContent>
        </Card>
    );
}

export default function SettingsPage() {
  return (
    <MainLayout>
        <div className="mb-4">
          <h1 className="text-2xl font-bold font-headline">Settings</h1>
          <p className="text-muted-foreground">
            Manage your application settings.
          </p>
        </div>
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <GeneralSettings />
        </TabsContent>
        <TabsContent value="appearance">
          <AppearanceSettings />
        </TabsContent>
        <TabsContent value="billing">
          <BillingSettings />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
