

export type InventoryItem = {
  id: string;
  name: string;
  stock: number;
  price: number;
  userId: string;
  hsnCode: string;
  unit: string;
};

export type SaleStatus = 'Paid' | 'Pending' | 'Overdue' | 'Draft';
export type PurchaseStatus = 'Received' | 'Pending' | 'Draft';

export type LineItem = {
  inventoryId?: string;
  name: string;
  quantity: number;
  price: number;
  discount?: number;
  total?: number;
  hsnCode?: string;
  unit?: string;
}

export type Sale = {
  id: string;
  customer: string;
  date: string;
  amount: number;
  manualTotal?: number;
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
  eWayBillNumber?: string;
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
    manualTotal?: number;
    status: PurchaseStatus;
    items: LineItem[];
    transporterVehicleNumber?: string;
    cgstRate?: number;
    sgstRate?: number;
    igstRate?: number;
    insuranceAndOthersRate?: number;
    eWayBillNumber?: string;
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
  },
  preferences?: {
    inventorySort?: {
        key: string;
        direction: 'ascending' | 'descending';
    }
  }
}
