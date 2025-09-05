
"use client";
import { InvoiceForm } from "@/components/invoice-form";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function NewSalePage() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-full text-center">
            <h1 className="text-2xl font-bold mb-4">Guest Mode</h1>
            <p className="text-muted-foreground mb-6">Creating new sales is disabled in guest mode.</p>
            <Button onClick={() => router.push('/login')}>Login to Create a Sale</Button>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="mb-4">
        <h1 className="text-2xl font-bold font-headline">New Invoice</h1>
        <p className="text-muted-foreground">
          Create a new sales invoice to send to your customer.
        </p>
      </div>
      <InvoiceForm />
    </MainLayout>
  );
}
