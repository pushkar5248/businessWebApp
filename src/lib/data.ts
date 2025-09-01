
export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  stock: number;
  price: number;
  supplier: string;
};

export type Sale = {
  id: string;
  customer: string;
  date: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
  items: {
    name: string;
    quantity: number;
    price: number;
    tax?: number;
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
};

export type Purchase = {
    id: string;
    vendor: string;
    vendorAddress: string;
    shippingAddress?: string;
    date: string;
    amount: number;
    status: 'Received' | 'Pending';
    items: {
        name: string;
        quantity: number;
        price: number;
    }[];
};


export const chartData = [
  { month: "January", sales: 186 },
  { month: "February", sales: 305 },
  { month: "March", sales: 237 },
  { month: "April", sales: 73 },
  { month: "May", sales: 209 },
  { month: "June", sales: 214 },
];

export const inventoryData: InventoryItem[] = [
  { id: 'ITM001', name: 'Italian Marble Slab', category: 'Marble', subcategory: 'Slabs', stock: 50, price: 150.00, supplier: 'Verona Stones' },
  { id: 'ITM002', name: 'Black Granite Countertop', category: 'Granite', subcategory: 'Countertops', stock: 30, price: 250.00, supplier: 'Stone Solutions' },
  { id: 'ITM003', name: 'White Quartz Tile', category: 'Quartz', subcategory: 'Tiles', stock: 200, price: 25.50, supplier: 'Quartz Co.' },
  { id: 'ITM004', name: 'Sandstone Paver', category: 'Sandstone', subcategory: 'Pavers', stock: 500, price: 15.75, supplier: 'Rock Garden' },
  { id: 'ITM005', name: 'Slate Roofing Tile', category: 'Slate', subcategory: 'Tiles', stock: 1000, price: 8.20, supplier: 'Mountain Slate' },
  { id: 'ITM006', name: 'Travertine Floor Tile', category: 'Travertine', subcategory: 'Tiles', stock: 150, price: 35.00, supplier: 'Ancient Floors' },
  { id: 'ITM007', name: 'Onyx Decorative Piece', category: 'Onyx', subcategory: 'Decorative', stock: 15, price: 500.00, supplier: 'Gem Stones Inc' },
];

export const salesData: Sale[] = [
  { 
    id: 'INV-2024-001', 
    customer: 'Prestige Construction', 
    date: '2024-06-01', 
    amount: 4500.00, 
    status: 'Paid',
    items: [{ name: 'Italian Marble Slab', quantity: 30, price: 150 }],
    customerAddress: '123 Prestige Plaza, Builderville',
    customerPhone: '555-111-2222',
  },
  { 
    id: 'INV-2024-002', 
    customer: 'Dream Homes Pvt. Ltd.', 
    date: '2024-06-05', 
    amount: 12500.50, 
    status: 'Paid',
    items: [{ name: 'Black Granite Countertop', quantity: 50, price: 250.01 }],
    customerAddress: '456 Dream Avenue, Real Estate City',
    customerPhone: '555-333-4444',
  },
  { 
    id: 'INV-2024-003', 
    customer: 'Mr. John Smith', 
    date: '2024-06-12', 
    amount: 850.75, 
    status: 'Pending',
    items: [
        { name: 'White Quartz Tile', quantity: 25, price: 25.50 },
        { name: 'Sandstone Paver', quantity: 10, price: 15.75 }
    ],
    customerAddress: '789 Residential Way, Suburbia',
    customerPhone: '555-555-5555',
  },
  { 
    id: 'INV-2024-004', 
    customer: 'Modern Architects', 
    date: '2024-06-20', 
    amount: 22300.00, 
    status: 'Paid',
    items: [{ name: 'Slate Roofing Tile', quantity: 2000, price: 8.20 }, { name: 'Italian Marble Slab', quantity: 40, price: 150 }],
    customerAddress: '101 Innovation Tower, Archburg',
    customerPhone: '555-666-7777',
    deliveryPlaceName: 'Downtown Site Office',
    deliveryAddress: '202 Construction Ave, Archburg',
    transporterName: 'Quick Logistics',
    transporterVehicleNumber: 'UP80-AB-1234',
    placeOfSupply: 'Archburg',
    transportDate: '2024-06-21',
  },
  { 
    id: 'INV-2024-005', 
    customer: 'City Mall Project', 
    date: '2024-06-25', 
    amount: 75000.00, 
    status: 'Overdue',
    items: [{ name: 'Travertine Floor Tile', quantity: 2000, price: 35.00 }, { name: 'Onyx Decorative Piece', quantity: 10, price: 500.00 }],
    customerAddress: '202 Commerce Center, Downtown',
    customerPhone: '555-888-9999',
  },
];

export const purchasesData: Purchase[] = [
    { id: 'PO-2024-001', vendor: 'Verona Stones', vendorAddress: "Verona, Italy", date: '2024-05-15', amount: 7500.00, status: 'Received', items: [{name: 'Italian Marble Slab', quantity: 50, price: 150}] },
    { id: 'PO-2024-002', vendor: 'Stone Solutions', vendorAddress: "Jaipur, India", date: '2024-05-20', amount: 7500.00, status: 'Received', items: [{name: 'Black Granite Countertop', quantity: 30, price: 250}] },
    { id: 'PO-2024-003', vendor: 'Quartz Co.', vendorAddress: "USA", date: '2024-05-25', amount: 5100.00, status: 'Received', items: [{name: 'White Quartz Tile', quantity: 200, price: 25.50}] },
    { id: 'PO-2024-004', vendor: 'Mountain Slate', vendorAddress: "Brazil", date: '2024-06-02', amount: 8200.00, status: 'Pending', items: [{name: 'Slate Roofing Tile', quantity: 1000, price: 8.20}] },
    { id: 'PO-2024-005', vendor: 'Rock Garden', vendorAddress: "Australia", date: '2024-06-10', amount: 7875.00, status: 'Received', items: [{name: 'Sandstone Paver', quantity: 500, price: 15.75}] },
];
