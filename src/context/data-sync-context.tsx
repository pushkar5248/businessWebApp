
"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface DataSyncContextType {
  syncKey: number;
  triggerSync: () => void;
}

const DataSyncContext = createContext<DataSyncContextType | undefined>(undefined);

export function DataSyncProvider({ children }: { children: ReactNode }) {
  const [syncKey, setSyncKey] = useState(0);

  const triggerSync = useCallback(() => {
    setSyncKey(prevKey => prevKey + 1);
  }, []);

  const value = { syncKey, triggerSync };

  return (
    <DataSyncContext.Provider value={value}>
      {children}
    </DataSyncContext.Provider>
  );
}

export function useDataSync() {
  const context = useContext(DataSyncContext);
  if (context === undefined) {
    throw new Error('useDataSync must be used within a DataSyncProvider');
  }
  return context;
}
