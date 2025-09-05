

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  stock: number;
  price: number;
  supplier: string;
  userId: string;
};

export type SaleStatus = 'Paid' | 'Pending' | 'Overdue';
export type PurchaseStatus = 'Received' | 'Pending';

export type Sale = {
  id: string;
  customer: string;
  date: string;
  amount: number;
  status: SaleStatus;
  items: {
    name: string;
    quantity: number;
    price: number;
  }[];
  customerAddress: string;
  customerPhone: string;
  customerState?: string;
  customerGstin?: string;
  deliveryPlaceName?: string;
  deliveryAddress?: string;
  deliveryState?: string;
  deliveryGstin?: string;
  transporterName?: string;
  transporterVehicleNumber?: string;
  placeOfSupply?: string;
  transportDate?: string;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  deletedAt?: string | null;
  userId: string;
};

export type Purchase = {
    id: string;
    vendor: string;
    vendorAddress: string;
    shippingAddress?: string;
    date: string;
    amount: number;
    status: PurchaseStatus;
    items: {
        name: string;
        quantity: number;
        price: number;
    }[];
    igstRate?: number;
    deletedAt?: string | null;
    userId: string;
};

export type UserSettings = {
  profile: {
    displayName: string;
    email: string;
  },
  general: {
    businessName: string;
    businessGstin: string;
    businessAddress: string;
    businessPhone: string;
    businessEmail: string;
  },
  appearance: {
    theme: 'light' | 'dark' | 'dracula' | 'ocean' | 'forest' | 'sunset';
  },
  billing: {
    currency: string;
    defaultCgstRate: number;
    defaultSgstRate: number;
    invoiceFooter: string;
    invoiceTerms: string;
  }
}
