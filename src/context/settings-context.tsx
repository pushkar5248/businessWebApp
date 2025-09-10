
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
        photoURL: '',
    },
    general: {
        businessName: 'Your Business Name',
        businessGstin: 'XXABCDE1234F1ZX',
        businessAddress: '123 Business Avenue, Suite 100, City, State 12345',
        businessPhone: '(123) 456-7890',
        businessEmail: 'contact@yourbusiness.com'
    },
    appearance: {
        theme: 'light',
    },
    billing: {
        currency: 'INR',
        defaultCgstRate: 9,
        defaultSgstRate: 9,
        invoiceFooter: 'Thank you for your business!',
        invoiceTerms: 'All sales are final.\nPlease make payments to the account details provided.',
    },
    preferences: {
        inventorySort: {
            key: 'name',
            direction: 'ascending'
        }
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
        // The theme class is now applied in the AppBody component based on the settings state.
    }, []);

    const fetchSettings = useCallback(async () => {
        setLoading(true);
        if (!user) {
            const guestSettings = {
                ...defaultSettings,
                profile: {
                    displayName: 'Guest User',
                    email: 'guest@example.com',
                    photoURL: '',
                }
            };
            setSettings(guestSettings);
            applyTheme(guestSettings.appearance.theme);
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
                    photoURL: user.photoURL || data.profile?.photoURL || '',
                };

                setSettings(mergedSettings);
                applyTheme(mergedSettings.appearance.theme);
            } else {
                 const userDefaultSettings = {
                    ...defaultSettings,
                     profile: {
                        displayName: user.displayName || user.email || 'User',
                        email: user.email || '',
                        photoURL: user.photoURL || '',
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
    }, [authLoading, user, fetchSettings]);

    const saveSettings = async (dataToSave: Partial<UserSettings>) => {
        if (!user || !settings) return;
        
        try {
            const docRef = doc(db, 'users', user.uid);
            await setDoc(docRef, dataToSave, { merge: true });
            
            const updatedSettings = deepmerge(settings, dataToSave as Partial<UserSettings>);
            setSettings(updatedSettings);

            if (dataToSave.appearance?.theme) {
                applyTheme(dataToSave.appearance.theme);
            }
            
            const isSilent = dataToSave.preferences?.inventorySort;

            if (!isSilent) {
              toast({ title: 'Success', description: "Your settings have been saved."});
            }
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
                photoURL: user.photoURL || '',
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
