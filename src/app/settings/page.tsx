
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MainLayout } from "@/components/layout/main-layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { useToast } from '@/hooks/use-toast';
import type { UserSettings } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useCurrency } from '@/context/currency-context';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

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

const themes = [
    { name: 'light', label: 'Light' },
    { name: 'dark', label: 'Dark' },
    { name: 'dracula', label: 'Dracula' },
    { name: 'ocean', label: 'Ocean' },
    { name: 'forest', label: 'Forest' },
    { name: 'sunset', label: 'Sunset' },
]


function ProfileSettings({ settings, onSave, isGuest }: { settings: UserSettings, onSave: (data: Partial<UserSettings>) => Promise<void>, isGuest: boolean }) {
    const { user } = useAuth();
    const [displayName, setDisplayName] = useState(settings.profile.displayName);
    const [email, setEmail] = useState(settings.profile.email);

    useEffect(() => {
        setDisplayName(settings.profile.displayName);
        setEmail(settings.profile.email);
    }, [settings]);


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
                    <Input id="display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} disabled={isGuest} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" value={email} disabled />
                </div>
                <Button onClick={handleSave} disabled={isGuest}>Save Changes</Button>
            </CardContent>
        </Card>
    );
}


function GeneralSettings({ settings, onSave, isGuest }: { settings: UserSettings, onSave: (data: Partial<UserSettings>) => void, isGuest: boolean }) {
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
                    <Input id="business-name" value={localSettings.businessName} onChange={e => handleChange('businessName', e.target.value)} disabled={isGuest} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="business-gstin">Business GSTIN</Label>
                    <Input id="business-gstin" value={localSettings.businessGstin} onChange={e => handleChange('businessGstin', e.target.value)} disabled={isGuest} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="business-address">Business Address</Label>
                    <Textarea id="business-address" value={localSettings.businessAddress} onChange={e => handleChange('businessAddress', e.target.value)} disabled={isGuest} />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="business-phone">Business Phone</Label>
                        <Input id="business-phone" value={localSettings.businessPhone} onChange={e => handleChange('businessPhone', e.target.value)} disabled={isGuest} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="business-email">Business Email</Label>
                        <Input id="business-email" type="email" value={localSettings.businessEmail} onChange={e => handleChange('businessEmail', e.target.value)} disabled={isGuest} />
                    </div>
                </div>
                <Button onClick={handleSave} disabled={isGuest}>Save Changes</Button>
            </CardContent>
        </Card>
    );
}

function AppearanceSettings({ settings, onSave, isGuest }: { settings: UserSettings, onSave: (data: Partial<UserSettings>) => void, isGuest: boolean }) {
    const { applyTheme } = useSettings();

    const handleThemeChange = (newTheme: string) => {
        applyTheme(newTheme as UserSettings['appearance']['theme']);
        onSave({ appearance: { theme: newTheme as UserSettings['appearance']['theme'] } });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize the look and feel of your application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-base">Theme</Label>
                    <p className="text-sm text-muted-foreground">Select a theme for your dashboard.</p>
                </div>
                <RadioGroup 
                    value={settings.appearance.theme} 
                    onValueChange={handleThemeChange}
                    className="grid max-w-md grid-cols-2 gap-8 pt-2 md:grid-cols-3"
                    disabled={isGuest}
                >
                    {themes.map((theme) => (
                         <Label
                            key={theme.name}
                            className={cn(
                                "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground",
                                settings.appearance.theme === theme.name && "border-primary"
                            )}
                         >
                            <RadioGroupItem value={theme.name} id={theme.name} className="sr-only" />
                            <span className="flex-1 text-center">{theme.label}</span>
                         </Label>
                    ))}
                </RadioGroup>
            </CardContent>
        </Card>
    );
}

function BillingSettings({ settings, onSave, isGuest }: { settings: UserSettings, onSave: (data: Partial<UserSettings>) => void, isGuest: boolean }) {
    const { setCurrency } = useCurrency();
    const [localSettings, setLocalSettings] = useState(settings.billing);

    useEffect(() => {
        setLocalSettings(settings.billing);
    }, [settings.billing]);

    const handleChange = (field: keyof UserSettings['billing'], value: string | number) => {
        setLocalSettings(prev => ({ ...prev, [field]: value }));
    };
    
    const handleCurrencyChange = (value: string) => {
        setLocalSettings(prev => ({ ...prev, currency: value }));
        setCurrency(value);
    };

    const handleSave = () => {
        onSave({ billing: localSettings });
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
                    <Select value={localSettings.currency} onValueChange={handleCurrencyChange} disabled={isGuest}>
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
                        <Input id="default-cgst" type="number" value={localSettings.defaultCgstRate} onChange={e => handleChange('defaultCgstRate', Number(e.target.value))} disabled={isGuest} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="default-sgst">Default SGST (%)</Label>
                        <Input id="default-sgst" type="number" value={localSettings.defaultSgstRate} onChange={e => handleChange('defaultSgstRate', Number(e.target.value))} disabled={isGuest} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="invoice-footer">Invoice Footer</Label>
                    <Input id="invoice-footer" value={localSettings.invoiceFooter} onChange={e => handleChange('invoiceFooter', e.target.value)} disabled={isGuest}/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="invoice-terms">Terms & Conditions</Label>
                    <Textarea id="invoice-terms" value={localSettings.invoiceTerms} onChange={e => handleChange('invoiceTerms', e.target.value)} disabled={isGuest}/>
                </div>
                <Button onClick={handleSave} disabled={isGuest}>Save Changes</Button>
            </CardContent>
        </Card>
    );
}

export default function SettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const { settings, loading: settingsLoading, saveSettings } = useSettings();
    
    const isGuest = !user;

    const handleSaveSettings = async (dataToSave: Partial<UserSettings>) => {
        if (!user || !settings) return;
        await saveSettings(dataToSave);
    }
    
    if (authLoading || settingsLoading || !settings) {
        return (
            <MainLayout>
                <div className="flex h-[80vh] items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            </MainLayout>
        );
    }
    
    if (isGuest) {
      return (
        <MainLayout>
          <div className="mb-4">
            <h1 className="text-2xl font-bold font-headline">Settings</h1>
            <p className="text-muted-foreground">
              Manage your application settings.
            </p>
          </div>
          <Card>
            <CardHeader>
                <CardTitle>Guest Mode</CardTitle>
                <CardDescription>You are currently in guest mode. Please log in to save your settings.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={() => router.push('/login')}>Login to Save Settings</Button>
            </CardContent>
          </Card>
        </MainLayout>
      )
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
          <ProfileSettings settings={settings} onSave={handleSaveSettings} isGuest={isGuest} />
        </TabsContent>
        <TabsContent value="general">
          <GeneralSettings settings={settings} onSave={handleSaveSettings} isGuest={isGuest} />
        </TabsContent>
        <TabsContent value="appearance">
          <AppearanceSettings settings={settings} onSave={handleSaveSettings} isGuest={isGuest} />
        </TabsContent>
        <TabsContent value="billing">
          <BillingSettings settings={settings} onSave={handleSaveSettings} isGuest={isGuest} />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}

    