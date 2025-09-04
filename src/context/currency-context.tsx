
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSettings } from './settings-context';

interface CurrencyContextType {
  currency: string;
  setCurrency: (currency: string) => void;
  formatCurrency: (value: number) => string;
  formatCurrencyValue: (value: number) => string;
}

const currencySymbols: { [key: string]: string } = {
  USD: '$',
  EUR: '€',
  JPY: '¥',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'Fr',
  CNY: '¥',
  INR: '₹',
  RUP: '₹',
};


const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { settings, loading: settingsLoading } = useSettings();
  const [currency, setCurrencyState] = useState('INR');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!settingsLoading && settings) {
      setCurrencyState(settings.billing.currency);
      setIsLoaded(true);
    }
  }, [settings, settingsLoading]);

  const setCurrency = (newCurrency: string) => {
    setCurrencyState(newCurrency);
    // The settings context will handle persistence
  };

  const getSymbol = (currencyCode: string) => currencySymbols[currencyCode] || '$';

  const formatCurrency = (value: number) => {
    if (typeof value !== 'number' || isNaN(value)) {
      return `${getSymbol(currency)}0.00`;
    }
    return `${getSymbol(currency)}${value.toFixed(2)}`;
  };

  const formatCurrencyValue = (value: number) => {
     if (!isLoaded || typeof value !== 'number' || isNaN(value)) return `${getSymbol(currency)}0.00`;
    return `${getSymbol(currency)}${value.toFixed(2)}`;
  };

  const value = { currency, setCurrency, formatCurrency, formatCurrencyValue };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
