export type Photo = {
  src: string;
  alt: string;
  position?: string;
  colour?: ProductColour;
};

export type FulfillmentSource = "in-house" | "supplier";

export type Product = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  photo: Photo;
  stock?: number;
  fulfillmentSource?: FulfillmentSource;
  pickupHubId?: string;
  details?: ProductDetails;
};

export type Fabric = "modal" | "chiffon" | "jersey" | "silk" | (string & {});
export type ProductCategory = "hijabs" | "accessories" | (string & {});
export type ProductColour =
  | "rose"
  | "olive"
  | "black"
  | "sand"
  | "mocha"
  | "mauve"
  | "burgundy"
  | "multi"
  | "gold"
  | (string & {});

export type ProductVariant = {
  colour: ProductColour;
  stock: number;
  gallery: [Photo, ...Photo[]];
};

export type ProductDetails = {
  description: string;
  material: string;
  size: string;
  deliveryNote: string;
  variants: [ProductVariant, ...ProductVariant[]];
};

export type CatalogProduct = Product & {
  category: ProductCategory;
  fabric: Fabric | null;
  colour: ProductColour;
  addedAt: string;
  details: ProductDetails;
};

export type Story = {
  id: string;
  label: string;
  photo: Photo;
  avatar: Photo;
  videoSrc?: string;
  href?: string;
};

export type Category = { id: string; name: string; photo: Photo; href: string };
export type NavItem = { label: string; href?: string; feature?: string };

export type FacebookPixelConfig = {
  pixelId: string;
  enabled: boolean;
  testMode?: boolean;
  lastVerifiedAt?: string | null;
};

export type CourierProvider = "steadfast" | "pathao";

export type PickupHubConfig = {
  id: string;
  name: string;
  source: FulfillmentSource;
  contactName?: string;
  phone?: string;
  address: string;
  preferredCourier?: CourierProvider;
  pathaoStoreId?: string;
  steadfastPickupNote?: string;
  isDefault?: boolean;
};

export type PathaoStoreSummary = {
  storeId: number;
  storeName: string;
  storeAddress: string;
  isActive: boolean;
  isDefaultStore: boolean;
};

export type CourierConfig = {
  provider: CourierProvider;
  enabled: boolean;
  steadfastEnabled?: boolean;
  steadfastApiKey?: string;
  steadfastSecretKey?: string;
  steadfastWebhookToken?: string;
  pathaoEnabled?: boolean;
  pathaoClientId?: string;
  pathaoClientSecret?: string;
  pathaoUsername?: string;
  pathaoPassword?: string;
  pathaoStoreId?: string;
  pathaoWebhookSecret?: string;
  defaultInHouseCourier?: CourierProvider;
  defaultSupplierCourier?: CourierProvider;
  pickupHubs?: PickupHubConfig[];
  autoFraudCheck: boolean;
  testMode?: boolean;
};

export type FraudCheckResult = {
  phone: string;
  riskLevel: "safe" | "moderate" | "high" | "unknown";
  successRate?: number; // e.g. 92%
  totalParcels?: number;
  deliveredParcels?: number;
  cancelledParcels?: number;
  returnedParcels?: number;
  totalOrders?: number;
  totalCancelled?: number;
  storeOrdersCount?: number;
  storeDeliveredCount?: number;
  storeCancelledCount?: number;
  courierTotalOrders?: number;
  courierSuccessOrders?: number;
  courierCancelledOrders?: number;
  notes?: string;
  source: "steadfast" | "pathao" | "internal" | "combined";
};

export type ManualPaymentChannel = {
  enabled: boolean;
  accountNumber: string;
  accountType: "Personal" | "Merchant" | "Agent";
  instruction?: string;
};

export type ManualPaymentSettings = {
  bkash: ManualPaymentChannel;
  nagad: ManualPaymentChannel;
  verificationNote?: string;
};
