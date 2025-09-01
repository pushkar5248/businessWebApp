"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  const [currency, setCurrencyState] = useState('INR');
   const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedCurrency = localStorage.getItem('currency');
    if (savedCurrency) {
      setCurrencyState(savedCurrency);
    }
    setIsLoaded(true);
  }, []);

  const setCurrency = (newCurrency: string) => {
    setCurrencyState(newCurrency);
    localStorage.setItem('currency', newCurrency);
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
