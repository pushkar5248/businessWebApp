
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { UserSettings } from '@/lib/types';
import deepmerge from 'deepmerge';

export const defaultSettings: UserSettings = {
    profile: {
        displayName: 'Guest User',
        email: '',
    },
    general: {
        businessName: 'Adhunik Minerals',
        businessGstin: '09AJPPC1234F1Z5',
        businessAddress: '123 Marble Street, Fatehabad Road, Agra, UP 282001',
        businessPhone: '9760026605',
        businessEmail: 'contact@adhunikminerals.com'
    },
    appearance: {
        theme: 'light',
    },
    billing: {
        currency: 'INR',
        defaultCgstRate: 9,
        defaultSgstRate: 9,
        invoiceFooter: 'Thank you for your business!',
        invoiceTerms: '1. Goods once sold will not be taken back or exchanged.\n2. Subject to Agra Jurisdiction only.',
    }
};

interface SettingsContextType {
  settings: UserSettings | null;
  loading: boolean;
  saveSettings: (dataToSave: Partial<UserSettings>) => Promise<void>;
  applyTheme: (theme: UserSettings['appearance']['theme']) => void;
  resetSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);

    const applyTheme = useCallback((theme: UserSettings['appearance']['theme']) => {
        // The theme class is now applied in the RootLayout, so this function is just for updating state.
        // We could add logic here if needed in the future.
    }, []);

    const fetchSettings = useCallback(async () => {
        setLoading(true);
        if (!user) {
            setSettings(defaultSettings);
            applyTheme(defaultSettings.appearance.theme);
            setLoading(false);
            return;
        }

        try {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as UserSettings;
                const mergedSettings = deepmerge(defaultSettings, data);
                
                mergedSettings.profile = {
                    displayName: user.displayName || data.profile?.displayName || defaultSettings.profile.displayName,
                    email: user.email || data.profile?.email || '',
                };

                setSettings(mergedSettings);
                applyTheme(mergedSettings.appearance.theme);
            } else {
                 const userDefaultSettings = {
                    ...defaultSettings,
                     profile: {
                        displayName: user.displayName || user.email || 'User',
                        email: user.email || '',
                    },
                }
                await setDoc(docRef, userDefaultSettings);
                setSettings(userDefaultSettings);
                applyTheme(userDefaultSettings.appearance.theme);
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not fetch settings."});
            setSettings(defaultSettings);
            applyTheme(defaultSettings.appearance.theme);
        } finally {
            setLoading(false);
        }
    }, [user, toast, applyTheme]);

    useEffect(() => {
        if (!authLoading) {
            fetchSettings();
        }
    }, [authLoading, fetchSettings]);

    const saveSettings = async (dataToSave: Partial<UserSettings>) => {
        if (!user || !settings) return;
        
        try {
            const docRef = doc(db, 'users', user.uid);
            await updateDoc(docRef, dataToSave);
            
            const updatedSettings = deepmerge(settings, dataToSave as Partial<UserSettings>);
            setSettings(updatedSettings);

            if (dataToSave.appearance?.theme) {
                applyTheme(dataToSave.appearance.theme);
            }

            toast({ title: 'Success', description: "Your settings have been saved."});
        } catch (error) {
            console.error("Error saving settings:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not save settings."});
        }
    }
    
    const resetSettings = async () => {
        if (!user) return;
         const userDefaultSettings = {
            ...defaultSettings,
             profile: {
                displayName: user.displayName || user.email || 'User',
                email: user.email || '',
            },
        }
        try {
            const docRef = doc(db, 'users', user.uid);
            await setDoc(docRef, userDefaultSettings);
            setSettings(userDefaultSettings);
            applyTheme(userDefaultSettings.appearance.theme);
        } catch (error) {
            console.error("Error resetting settings:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not reset settings."});
        }
    };
    
    const value = { settings, loading, saveSettings, applyTheme, resetSettings };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
