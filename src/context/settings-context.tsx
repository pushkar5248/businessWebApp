
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { UserSettings } from '@/lib/types';
import deepmerge from 'deepmerge';

const defaultSettings: UserSettings = {
    profile: {
        displayName: 'Guest User',
        email: '',
    },
    general: {
        businessName: 'Adhunik Marbles (Sample)',
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

interface SettingsContextType {
  settings: UserSettings | null;
  loading: boolean;
  saveSettings: (dataToSave: Partial<UserSettings>) => Promise<void>;
  applyTheme: (theme: 'light' | 'dark') => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);

    const applyTheme = useCallback((theme: 'light' | 'dark') => {
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);
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
                // Deep merge to ensure all nested properties from defaultSettings are present
                const mergedSettings = deepmerge(defaultSettings, data);
                
                // Ensure profile is correctly set from user object or existing profile
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
            // Use updateDoc for partial updates
            await updateDoc(docRef, dataToSave);
            
            // Deep merge new data into existing settings state
            const updatedSettings = deepmerge(settings, dataToSave as Partial<UserSettings>);
            setSettings(updatedSettings);

            toast({ title: 'Success', description: "Your settings have been saved."});
        } catch (error) {
            console.error("Error saving settings:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not save settings."});
        }
    }
    
    const value = { settings, loading, saveSettings, applyTheme };

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
