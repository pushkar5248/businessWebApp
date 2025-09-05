"use client";

import dynamic from 'next/dynamic';
import { MainLayout } from '@/components/layout/main-layout';
import { Loader2 } from 'lucide-react';

const PurchasesPageClient = dynamic(() => import('@/components/client-pages/purchases-page-client'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[80vh] items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  ),
});

export default function PurchasesPage() {
  return (
    <MainLayout>
      <PurchasesPageClient />
    </MainLayout>
  );
}
