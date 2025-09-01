import { InvoiceForm } from "@/components/invoice-form";
import { MainLayout } from "@/components/layout/main-layout";

export default function NewSalePage() {
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
