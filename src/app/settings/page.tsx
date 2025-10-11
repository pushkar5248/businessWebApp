

"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MainLayout } from "@/components/layout/main-layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { useToast } from '@/hooks/use-toast';
import type { UserSettings, LineItem, Sale, Purchase } from '@/lib/types';
import { Loader2, Trash2, Upload, Search, Download, UploadCloud } from 'lucide-react';
import { updateProfile, updateEmail } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useCurrency } from '@/context/currency-context';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn, formatDate } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { db, storage } from '@/lib/firebase';
import { collection, doc, getDocs, query, setDoc, where, writeBatch, getDoc } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { fetchGstinDetails } from '@/ai/flows/fetch-gstin-details';
import { saveAs } from 'file-saver';


const currencies = [
  { value: 'USD', label: '$ (USD)' },
  { value: 'EUR', label: '€ (EUR)' },
  { value: 'JPY', label: '¥ (JPY)' },
  { value: 'GBP', label: '£ (GBP)' },
  { value: 'AUD', label: 'A$ (AUD)' },
  { value: 'CAD', label: 'C$ (CAD)' },
  { value: 'CHF', label: 'Fr (CHF)' },
  { value: 'CNY', 'label': '¥ (CNY)' },
  { value: 'INR', 'label': '₹ (INR)' },
];

const themes = [
    { name: 'light', label: 'Light' },
    { name: 'dark', label: 'Dark' },
]


function ProfileSettings({ settings, onSave, isGuest }: { settings: UserSettings, onSave: (data: Partial<UserSettings>) => Promise<void>, isGuest: boolean }) {
    const { user } = useAuth();
    const [displayName, setDisplayName] = useState(settings.profile.displayName);
    const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
    const [email, setEmail] = useState(settings.profile.email);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        setDisplayName(settings.profile.displayName);
        setEmail(settings.profile.email);
        setPhotoURL(user?.photoURL || '');
    }, [settings, user]);


    const handleSave = async () => {
        if (!user) return;
        
        setIsSaving(true);
        try {
            const updates: { displayName?: string, photoURL?: string } = {};
            if(user.displayName !== displayName) updates.displayName = displayName;
            if(user.photoURL !== photoURL) updates.photoURL = photoURL;

            if(Object.keys(updates).length > 0) {
              await updateProfile(user, updates);
            }

            if (user.email !== email) {
                await updateEmail(user, email);
                toast({ title: 'Email Verification Sent', description: 'Please check your new email address to verify the change.' });
            }

            await onSave({ profile: { displayName, email, photoURL } });
            toast({ title: 'Success', description: 'Your profile has been updated.'})

        } catch (error: any) {
            console.error("Error updating profile:", error);
            if (error.code === 'auth/requires-recent-login') {
                 toast({ variant: 'destructive', title: 'Action Required', description: 'This is a sensitive action. Please log out and log back in to change your email.' });
            } else {
                 toast({ variant: 'destructive', title: 'Update Failed', description: error.message || 'Could not update your profile.' });
            }
        } finally {
            setIsSaving(false);
        }
    }

    const handleFileSelect = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        console.log('[DIAGNOSTIC] handleFileUpload triggered.');
        const file = event.target.files?.[0];
        if (!file || !user) {
            console.log('[DIAGNOSTIC] No file selected or user not logged in. Aborting.');
            return;
        }

        console.log(`[DIAGNOSTIC] File selected: ${file.name}. User: ${user.uid}. Setting loading state.`);
        setIsUploading(true);

        try {
            const storageRef = ref(storage, `profile-pictures/${user.uid}/${file.name}`);
            console.log('[DIAGNOSTIC] Created storage reference. Starting upload...');
            
            const snapshot = await uploadBytes(storageRef, file);
            console.log('[DIAGNOSTIC] uploadBytes successful. Getting download URL...');
            
            const downloadURL = await getDownloadURL(snapshot.ref);
            console.log(`[DIAGNOSTIC] Got download URL: ${downloadURL}. Updating Firebase Auth profile...`);
            
            await updateProfile(user, { photoURL: downloadURL });
            console.log('[DIAGNOSTIC] Firebase Auth profile updated successfully. Updating local state...');

            setPhotoURL(downloadURL);
            console.log('[DIAGNOSTIC] Local photoURL state updated.');

            toast({ title: 'Upload successful', description: 'Your profile picture has been updated. Click "Save Changes" to persist it.' });

        } catch (error: any) {
            console.error('[DIAGNOSTIC] An error occurred during upload:', error);
            toast({ 
                variant: 'destructive', 
                title: 'Upload Failed', 
                description: `Error: ${error.message || 'An unknown error occurred.'}` 
            });
        } finally {
            console.log('[DIAGNOSTIC] Upload process finished. Resetting loading state.');
            setIsUploading(false);
        }
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Update your personal information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                        <AvatarImage src={photoURL || undefined} alt="User avatar" />
                        <AvatarFallback>{displayName?.[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                     <div className="space-y-2 flex-1">
                        <Label htmlFor="photo-url">Photo URL</Label>
                        <div className="flex gap-2">
                             <Input id="photo-url" value={photoURL} onChange={e => setPhotoURL(e.target.value)} disabled={isGuest || isUploading || isSaving} placeholder="https://example.com/photo.jpg" />
                             <Button onClick={handleFileSelect} disabled={isGuest || isUploading || isSaving} variant="outline">
                                {isUploading ? <Loader2 className="mr-2 animate-spin" /> : <Upload className="mr-2" />}
                                 Upload
                             </Button>
                             <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                        </div>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="display-name">Display Name</Label>
                    <Input id="display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} disabled={isGuest || isSaving} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={isGuest || isSaving} />
                </div>
                <Button onClick={handleSave} disabled={isGuest || isSaving || isUploading}>
                    {isSaving ? <Loader2 className="mr-2 animate-spin" /> : null}
                    Save Changes
                </Button>
            </CardContent>
        </Card>
    );
}


function GeneralSettings({ settings, onSave, isGuest }: { settings: UserSettings, onSave: (data: Partial<UserSettings>) => void, isGuest: boolean }) {
    const [localSettings, setLocalSettings] = useState(settings.general);
    const [isFetchingGstin, setIsFetchingGstin] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        setLocalSettings(settings.general);
    }, [settings.general]);

    const handleChange = (field: keyof UserSettings['general'], value: string) => {
        setLocalSettings(prev => ({ ...prev, [field]: value }));
    };
    
    const handleSave = () => {
        onSave({ general: localSettings });
    };

    const handleGstinFetch = async () => {
        const gstin = localSettings.businessGstin;
        if (!gstin || gstin.length !== 15) {
            toast({
                variant: "destructive",
                title: "Invalid GSTIN",
                description: "Please enter a valid 15-character GSTIN.",
            });
            return;
        }

        setIsFetchingGstin(true);
        try {
            const result = await fetchGstinDetails({ gstin });
            if (result) {
                setLocalSettings(prev => ({
                    ...prev,
                    businessName: result.businessName,
                    businessAddress: result.businessAddress,
                }));
                toast({
                    title: "Details Fetched",
                    description: `Successfully fetched details for ${result.businessName}.`,
                });
            } else {
                toast({
                    variant: "destructive",
                    title: "Not Found",
                    description: "No details found for the provided GSTIN.",
                });
            }
        } catch (error) {
            console.error("Error fetching GSTIN details:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not fetch GSTIN details. Please try again.",
            });
        } finally {
            setIsFetchingGstin(false);
        }
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
                     <div className="flex items-center gap-2">
                        <Input
                            id="business-gstin"
                            value={localSettings.businessGstin}
                            onChange={e => handleChange('businessGstin', e.target.value.toUpperCase())}
                            disabled={isGuest}
                        />
                        <Button type="button" variant="outline" size="icon" onClick={handleGstinFetch} disabled={isGuest || isFetchingGstin}>
                            {isFetchingGstin ? <Loader2 className="animate-spin" /> : <Search />}
                        </Button>
                    </div>
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

function AdvancedSettings({ onReset, isResetting, isGuest, user }: { onReset: () => void, isResetting: boolean, isGuest: boolean, user: any }) {
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [isRestoreAlertOpen, setIsRestoreAlertOpen] = useState(false);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const restoreFileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleBackup = async () => {
        if (!user) return;
        setIsBackingUp(true);
        try {
            const collectionsToBackup = ['inventory', 'sales', 'purchases', 'users'];
            const backupData: Record<string, any[]> = {};

            for (const collectionName of collectionsToBackup) {
                if (collectionName === 'users') {
                    const userDocRef = doc(db, 'users', user.uid);
                    const docSnap = await getDoc(userDocRef);
                    if (docSnap.exists()) {
                        backupData[collectionName] = [{ id: docSnap.id, ...docSnap.data() }];
                    } else {
                         backupData[collectionName] = [];
                    }
                    continue;
                }
                const collRef = collection(db, collectionName);
                const q = query(collRef, where('userId', '==', user.uid));
                const snapshot = await getDocs(q);
                backupData[collectionName] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }));
            }

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
            const date = new Date().toISOString().split('T')[0];
            saveAs(blob, `adhunik-minerals-backup-${date}.json`);
            toast({ title: 'Backup Successful', description: 'Your data has been downloaded.' });
        } catch (error) {
            console.error("Error backing up data:", error);
            toast({ variant: 'destructive', title: 'Backup Failed', description: 'Could not back up your data.' });
        } finally {
            setIsBackingUp(false);
        }
    };
    
    const handleRestoreFileSelect = () => {
        restoreFileInputRef.current?.click();
    };

    const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user) return;

        setIsRestoring(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const backupData = JSON.parse(e.target?.result as string);
                
                if (!backupData.inventory || !backupData.sales || !backupData.purchases || !backupData.users) {
                    throw new Error("Invalid backup file structure. Required collections are missing.");
                }

                // --- Data Sanitization Step ---
                const sanitizedData = JSON.parse(JSON.stringify(backupData)); 

                const sanitizeLineItem = (item: Partial<LineItem>): LineItem => ({
                    name: item.name || '',
                    quantity: item.quantity || 0,
                    price: item.price || 0,
                    inventoryId: item.inventoryId || '',
                    hsnCode: item.hsnCode || '',
                    unit: item.unit || '',
                    discount: item.discount ?? 0,
                    total: item.total ?? 0,
                });

                if (sanitizedData.sales && Array.isArray(sanitizedData.sales)) {
                    sanitizedData.sales = sanitizedData.sales.map((sale: Sale) => ({
                        ...sale,
                        items: Array.isArray(sale.items) ? sale.items.map(sanitizeLineItem) : [],
                    }));
                }

                if (sanitizedData.purchases && Array.isArray(sanitizedData.purchases)) {
                    sanitizedData.purchases = sanitizedData.purchases.map((purchase: Purchase) => ({
                        ...purchase,
                        items: Array.isArray(purchase.items) ? purchase.items.map(sanitizeLineItem) : [],
                    }));
                }
                // --- End Sanitization Step ---

                const deleteBatch = writeBatch(db);
                const collectionsToDelete = ['inventory', 'sales', 'purchases'];
                for (const collectionName of collectionsToDelete) {
                    const q = query(collection(db, collectionName), where("userId", "==", user.uid));
                    const snapshot = await getDocs(q);
                    snapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
                }
                await deleteBatch.commit(); 

                const dataWriteBatch = writeBatch(db);
                for (const collectionName in sanitizedData) {
                    if (Object.prototype.hasOwnProperty.call(sanitizedData, collectionName)) {
                        const documents = sanitizedData[collectionName];
                        if (Array.isArray(documents)) {
                           for (const docData of documents) {
                                const { id, ...data } = docData;
                                if (id) { 
                                   const docRef = doc(db, collectionName, id);
                                   dataWriteBatch.set(docRef, data);
                                }
                            }
                        }
                    }
                }
                
                await dataWriteBatch.commit();
                
                toast({ title: 'Restore Successful', description: 'Your data has been restored. The page will now reload.' });
                setTimeout(() => window.location.reload(), 2000);

            } catch (error: any) {
                console.error("Error restoring data:", error);
                toast({ variant: 'destructive', title: 'Restore Failed', description: error.message || 'Could not restore data from file.' });
            } finally {
                setIsRestoring(false);
                setIsRestoreAlertOpen(false);
                if (restoreFileInputRef.current) {
                    restoreFileInputRef.current.value = '';
                }
            }
        };
        reader.readAsText(file);
    };

    return (
        <>
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete all your inventory, sales, and purchases data. Your account and profile settings will not be affected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onReset} disabled={isResetting}>
                            {isResetting ? <Loader2 className="mr-2 animate-spin" /> : null}
                            Yes, delete all data
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={isRestoreAlertOpen} onOpenChange={setIsRestoreAlertOpen}>
                 <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. Restoring from a backup will permanently delete all current data and replace it with the data from the backup file.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRestoreFileSelect} disabled={isRestoring}>
                            {isRestoring ? <Loader2 className="mr-2 animate-spin" /> : null}
                            Yes, restore data
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Card>
                <CardHeader>
                    <CardTitle>Advanced</CardTitle>
                    <CardDescription>Perform potentially destructive actions. Please be careful.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <Card className="border-border">
                        <CardHeader>
                            <CardTitle>Backup & Restore</CardTitle>
                            <CardDescription>
                                Download a backup of all your data or restore from a previously downloaded backup file.
                            </CardDescription>
                        </CardHeader>
                        <CardFooter className="flex gap-4">
                             <Button variant="outline" onClick={handleBackup} disabled={isGuest || isBackingUp}>
                                {isBackingUp ? <Loader2 className="mr-2 animate-spin" /> : <Download className="mr-2" />}
                                Backup Data
                            </Button>
                            <Button variant="secondary" onClick={() => setIsRestoreAlertOpen(true)} disabled={isGuest || isRestoring}>
                                {isRestoring ? <Loader2 className="mr-2 animate-spin" /> : <UploadCloud className="mr-2" />}
                                Restore Data
                            </Button>
                             <input type="file" ref={restoreFileInputRef} onChange={handleRestore} className="hidden" accept="application/json" />
                        </CardFooter>
                    </Card>
                    <Card className="border-destructive">
                        <CardHeader>
                             <CardTitle>Reset Application Data</CardTitle>
                             <CardDescription>
                                This will permanently delete all your inventory, sales, and purchase data. Your user account will not be deleted. This action is irreversible.
                             </CardDescription>
                        </CardHeader>
                        <CardFooter>
                             <Button variant="destructive" onClick={() => setIsAlertOpen(true)} disabled={isGuest || isResetting}>
                                <Trash2 className="mr-2" />
                                Reset All Data
                            </Button>
                        </CardFooter>
                    </Card>
                </CardContent>
            </Card>
        </>
    )
}

export default function SettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const { settings, loading: settingsLoading, saveSettings, resetSettings } = useSettings();
    const [isResetting, setIsResetting] = useState(false);
    
    const isGuest = !user;

    const handleSaveSettings = async (dataToSave: Partial<UserSettings>) => {
        if (!user || !settings) return;
        await saveSettings(dataToSave);
    }

    const handleResetData = async () => {
        if (!user) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "You must be logged in to reset data.",
            });
            return;
        }
        setIsResetting(true);
        try {
            // Delete all transactional data
            const collectionsToDelete = ["inventory", "sales", "purchases"];
            const batch = writeBatch(db);

            for (const collectionName of collectionsToDelete) {
                const q = query(collection(db, collectionName), where("userId", "==", user.uid));
                const querySnapshot = await getDocs(q);
                querySnapshot.forEach((doc) => {
                    batch.delete(doc.ref);
                });
            }
            await batch.commit();

            // Reset user's profile photo in Firebase Auth
            await updateProfile(user, { photoURL: "" });

            // Reset user settings document in Firestore
            await resetSettings();
            
            toast({ title: "Data Reset", description: "All your data has been permanently deleted." });
            // Full page reload to ensure all states are reset
            window.location.href = '/';

        } catch (error: any) {
            console.error("Error resetting data:", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to reset data." });
        } finally {
            setIsResetting(false);
        }
    };
    
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
                <CardDescription>You are currently in guest mode. Settings are read-only.</CardDescription>
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
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
        <TabsContent value="advanced">
            <AdvancedSettings onReset={handleResetData} isResetting={isResetting} isGuest={isGuest} user={user} />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
