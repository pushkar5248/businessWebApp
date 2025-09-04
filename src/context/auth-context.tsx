
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { usePathname, useRouter } from 'next/navigation';
import type { UserSettings } from '@/lib/types';


interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const applyTheme = useCallback((theme: 'light' | 'dark') => {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
  }, []);

  const fetchAndApplySettings = useCallback(async (user: User) => {
    try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const settings = docSnap.data() as UserSettings;
            applyTheme(settings.appearance.theme);
        } else {
            applyTheme('light'); // Default theme
        }
    } catch (error) {
        console.error("Failed to fetch user settings for theme:", error);
        applyTheme('light'); // Default on error
    }
  }, [applyTheme]);

  useEffect(() => {
    const initializeAuth = async () => {
      // Use session persistence to log out on tab close
      // This addresses the user's request to be logged out on reload in the dev environment.
      await setPersistence(auth, browserSessionPersistence);
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setUser(user);
        if (user) {
            await fetchAndApplySettings(user);
        } else {
            applyTheme('light'); // Reset to default light theme on logout
        }
        setLoading(false);
      });
      return unsubscribe;
    };

    const unsubscribePromise = initializeAuth();

    return () => {
      unsubscribePromise.then(unsubscribe => unsubscribe && unsubscribe());
    };
  }, [fetchAndApplySettings, applyTheme]);

  useEffect(() => {
    if (loading) return;

    const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup');

    // If a user is logged in, they should not be able to see the login/signup pages
    if (user && isAuthPage) {
      router.push('/');
    }
  }, [user, loading, router, pathname]);
  

  const value = { user, loading };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
