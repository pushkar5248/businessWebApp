

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  stock: number;
  price: number;
  supplier: string;
  userId: string;
  hsnCode?: string;
  [key: string]: any; // For custom columns
};

export type SaleStatus = 'Paid' | 'Pending' | 'Overdue';
export type PurchaseStatus = 'Received' | 'Pending';

export type LineItem = {
  inventoryId?: string;
  name: string;
  quantity: number;
  price: number;
}

export type Sale = {
  id: string;
  customer: string;
  date: string;
  amount: number;
  status: SaleStatus;
  items: LineItem[];
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
    vendorGstin?: string;
    vendorAddress: string;
    shippingAddress?: string;
    date: string;
    amount: number;
    status: PurchaseStatus;
    items: LineItem[];
    igstRate?: number;
    deletedAt?: string | null;
    userId: string;
};

export type UserSettings = {
  profile: {
    displayName: string;
    email: string;
    photoURL?: string;
  },
  general: {
    businessName: string;
    businessGstin: string;
    businessAddress: string;
    businessPhone: string;
    businessEmail: string;
  },
  appearance: {
    theme: 'light' | 'dark';
  },
  billing: {
    currency: string;
    defaultCgstRate: number;
    defaultSgstRate: number;
    invoiceFooter: string;
    invoiceTerms: string;
  }
}
