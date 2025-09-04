
"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { UserSettings } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { updateProfile } from 'firebase/auth';

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
];

function ProfileSettings({ settings, onSave }: { settings: UserSettings, onSave: (data: Partial<UserSettings>) => Promise<void> }) {
    const { user } = useAuth();
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [email, setEmail] = useState(user?.email || '');

    const handleSave = async () => {
        if (user && user.displayName !== displayName) {
            await updateProfile(user, { displayName });
        }
        onSave({ profile: { displayName, email } });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Update your personal information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="display-name">Display Name</Label>
                    <Input id="display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" value={email} disabled />
                </div>
                <Button onClick={handleSave}>Save Changes</Button>
            </CardContent>
        </Card>
    );
}


function GeneralSettings({ settings, onSave }: { settings: UserSettings, onSave: (data: Partial<UserSettings>) => void }) {
    const [localSettings, setLocalSettings] = useState(settings.general);

    useEffect(() => {
        setLocalSettings(settings.general);
    }, [settings.general]);

    const handleChange = (field: keyof UserSettings['general'], value: string) => {
        setLocalSettings(prev => ({ ...prev, [field]: value }));
    };
    
    const handleSave = () => {
        onSave({ general: localSettings });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>Update your company's details here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="business-name">Business Name</Label>
                    <Input id="business-name" value={localSettings.businessName} onChange={e => handleChange('businessName', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="business-gstin">Business GSTIN</Label>
                    <Input id="business-gstin" value={localSettings.businessGstin} onChange={e => handleChange('businessGstin', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="business-address">Business Address</Label>
                    <Textarea id="business-address" value={localSettings.businessAddress} onChange={e => handleChange('businessAddress', e.target.value)} />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="business-phone">Business Phone</Label>
                        <Input id="business-phone" value={localSettings.businessPhone} onChange={e => handleChange('businessPhone', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="business-email">Business Email</Label>
                        <Input id="business-email" type="email" value={localSettings.businessEmail} onChange={e => handleChange('businessEmail', e.target.value)} />
                    </div>
                </div>
                <Button onClick={handleSave}>Save Changes</Button>
            </CardContent>
        </Card>
    );
}

function AppearanceSettings({ settings, onSave }: { settings: UserSettings, onSave: (data: Partial<UserSettings>) => void }) {
    const [isDarkMode, setIsDarkMode] = useState(settings.appearance.theme === 'dark');

    useEffect(() => {
        const theme = settings.appearance.theme;
        const darkMode = theme === 'dark';
        setIsDarkMode(darkMode);
        document.documentElement.classList.toggle('dark', darkMode);
    }, [settings.appearance.theme]);

    const toggleTheme = (checked: boolean) => {
        const newTheme = checked ? 'dark' : 'light';
        setIsDarkMode(checked);
        document.documentElement.classList.toggle('dark', checked);
        onSave({ appearance: { theme: newTheme } });
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
            </CardContent>
        </Card>
    );
}

function BillingSettings({ settings, onSave }: { settings: UserSettings, onSave: (data: Partial<UserSettings>) => void }) {
    const { currency, setCurrency } = useCurrency();
    const [localSettings, setLocalSettings] = useState(settings.billing);

    useEffect(() => {
        setLocalSettings(settings.billing);
        if (settings.billing.currency) {
            setCurrency(settings.billing.currency);
        }
    }, [settings.billing, setCurrency]);

    const handleChange = (field: keyof UserSettings['billing'], value: string | number) => {
        setLocalSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        onSave({ billing: localSettings });
        if (localSettings.currency) {
          setCurrency(localSettings.currency);
        }
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
                    <Select value={localSettings.currency} onValueChange={(value) => handleChange('currency', value)}>
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
                        <Input id="default-cgst" type="number" value={localSettings.defaultCgstRate} onChange={e => handleChange('defaultCgstRate', Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="default-sgst">Default SGST (%)</Label>
                        <Input id="default-sgst" type="number" value={localSettings.defaultSgstRate} onChange={e => handleChange('defaultSgstRate', Number(e.target.value))} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="invoice-footer">Invoice Footer</Label>
                    <Input id="invoice-footer" value={localSettings.invoiceFooter} onChange={e => handleChange('invoiceFooter', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="invoice-terms">Terms & Conditions</Label>
                    <Textarea id="invoice-terms" value={localSettings.invoiceTerms} onChange={e => handleChange('invoiceTerms', e.target.value)} />
                </div>
                <Button onClick={handleSave}>Save Changes</Button>
            </CardContent>
        </Card>
    );
}

export default function SettingsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const defaultSettings: UserSettings = {
        profile: {
            displayName: user?.displayName || user?.email || 'User',
            email: user?.email || '',
        },
        general: {
            businessName: 'Adhunik Marbles',
            businessGstin: '27ABCDE1234F1Z5',
            businessAddress: '123 Marble Street, Stoneville, ST 45678',
            businessPhone: '+91 98765 43210',
            businessEmail: 'contact@adhunikmarbles.com'
        },
        appearance: {
            theme: 'light',
        },
        billing: {
            currency: 'INR',
            defaultCgstRate: 9,
            defaultSgstRate: 9,
            invoiceFooter: 'Thank you for your business!',
            invoiceTerms: '1. Payment due within 30 days. \n2. All sales are final.',
        }
    };
    
    const fetchSettings = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                // Deep merge with defaults to avoid errors if some fields are missing
                const data = docSnap.data() as UserSettings;
                const mergedSettings = {
                    ...defaultSettings,
                    ...data,
                    profile: { ...defaultSettings.profile, ...data.profile },
                    general: { ...defaultSettings.general, ...data.general },
                    appearance: { ...defaultSettings.appearance, ...data.appearance },
                    billing: { ...defaultSettings.billing, ...data.billing },
                };
                setSettings(mergedSettings);
            } else {
                // If no settings, create them with defaults
                await setDoc(docRef, defaultSettings);
                setSettings(defaultSettings);
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not fetch settings."});
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);
    
    const handleSaveSettings = async (dataToSave: Partial<UserSettings>) => {
        if (!user || !settings) return;
        
        try {
            const docRef = doc(db, 'users', user.uid);
            await updateDoc(docRef, dataToSave);
            
            // Optimistically update local state
            const updatedSettings = {
                ...settings,
                ...dataToSave,
                profile: { ...settings.profile, ...dataToSave.profile },
                general: { ...settings.general, ...dataToSave.general },
                appearance: { ...settings.appearance, ...dataToSave.appearance },
                billing: { ...settings.billing, ...dataToSave.billing },
            };
            setSettings(updatedSettings);

            toast({ title: 'Success', description: "Your settings have been saved."});
        } catch (error) {
            console.error("Error saving settings:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not save settings."});
        }
    }
    
    if (isLoading || !settings) {
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
        <div className="mb-4">
          <h1 className="text-2xl font-bold font-headline">Settings</h1>
          <p className="text-muted-foreground">
            Manage your application settings.
          </p>
        </div>
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileSettings settings={settings} onSave={handleSaveSettings} />
        </TabsContent>
        <TabsContent value="general">
          <GeneralSettings settings={settings} onSave={handleSaveSettings} />
        </TabsContent>
        <TabsContent value="appearance">
          <AppearanceSettings settings={settings} onSave={handleSaveSettings} />
        </TabsContent>
        <TabsContent value="billing">
          <BillingSettings settings={settings} onSave={handleSaveSettings} />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
