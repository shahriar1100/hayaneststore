import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { catalogProducts } from "@/data/catalog";
import { photos } from "@/data/photos";
import { createDemoDetails } from "@/data/product-details";
import { DEFAULT_CATALOG_TAXONOMY, type CatalogTaxonomy } from "@/data/shop-options";
import { stories as defaultStories } from "@/data/store";
import type {
  Order,
  OrderDeliveryZone,
  OrderItem,
  OrderPaymentMethod,
  OrderShipment,
} from "@/lib/orders";
import {
  buildOrderShipments,
  getDefaultPickupHubs,
  reconcileOrderFromShipments,
  resolvePickupHubForSource,
} from "@/lib/fulfillment";
import type {
  CatalogProduct,
  Category,
  CourierProvider,
  Fabric,
  FulfillmentSource,
  Photo,
  PickupHubConfig,
  ProductCategory,
  ProductColour,
  ProductVariant,
  Story,
  FacebookPixelConfig,
  CourierConfig,
  ManualPaymentSettings,
} from "@/types/store";
import {
  deleteUploadedMedia,
  getCanonicalMediaKey,
  isManagedUploadedMedia,
} from "./cloudinary";
import { getBackendConfig } from "./env";

export type ProductSectionKey =
  | "new-items"
  | "flash-sale"
  | "most-popular"
  | "just-for-you"
  | "top-products";

export type ProductStatus = "active" | "inactive";

export type AdminProductRecord = CatalogProduct & {
  sku: string;
  costPrice: number | null;
  status: ProductStatus;
  stock: number;
  lowStockThreshold: number;
  lastRestockedAt: string | null;
  sections: ProductSectionKey[];
  fulfillmentSource: FulfillmentSource;
  pickupHubId?: string;
};

export type AdminProductInput = {
  id?: string;
  sku?: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number | null;
  costPrice?: number | null;
  status?: ProductStatus;
  category: ProductCategory;
  fabric: Fabric | null;
  colour: ProductColour;
  stock: number;
  lowStockThreshold?: number;
  material?: string;
  size?: string;
  deliveryNote?: string;
  imageSrc: string;
  imageAlt: string;
  imagePosition?: string;
  galleryImages?: Photo[];
  sections: ProductSectionKey[];
  variantStocks?: Partial<Record<ProductColour, number>>;
  fulfillmentSource?: FulfillmentSource;
  pickupHubId?: string;
};

export type AdminOrderStatus =
  | "Pending"
  | "Confirmed"
  | "Processing"
  | "Shipped"
  | "Delivered"
  | "Cancelled"
  | "Returned"
  | "Refunded";

export type AdminPaymentStatus =
  | "Paid"
  | "Pending"
  | "Failed"
  | "Refunded"
  | "Partially Refunded";

export type AdminDeliveryStatus =
  | "Pending Dispatch"
  | "In Transit"
  | "Out for Delivery"
  | "Delivered"
  | "Returned"
  | "Cancelled";

export type AdminOrderRecord = Omit<Order, "status"> & {
  status: AdminOrderStatus;
  paymentStatus: AdminPaymentStatus;
  deliveryStatus: AdminDeliveryStatus;
  discountAmount: number;
  couponCode?: string | null;
  taxAmount: number;
  refundAmount: number;
  updatedAt?: string;
};

export type AdminCouponRecord = {
  id: string;
  code: string;
  description: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount: number;
  active: boolean;
  usageCount: number;
  createdAt: string;
};

export type HeroBannerConfig = {
  titleLine1: string;
  titleLine2: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  imageSrc: string;
  imageAlt: string;
  imagePosition: string;
};

export type StoreSocialLinks = {
  facebook?: string;
  instagram?: string;
  youtube?: string;
  tiktok?: string;
};

export type FlashSaleConfig = {
  enabled: boolean;
  endsAt: string | null;
  expiredBehavior: "revert-prices" | "hide-section";
  title: string;
  subtitle: string;
  badge: string;
};

export type EmailSenderConfig = {
  fromEmail?: string;
  fromName?: string;
};

export type AdminSettingsRecord = {
  storeName: string;
  timezone: string;
  currency: string;
  lowStockThreshold: number;
  monthlySalesTarget: number | null;
  insideDhakaShippingFee: number;
  outsideDhakaShippingFee: number;
  contactEmail?: string;
  contactPhone?: string;
  contactLocation?: string;
  socialLinks?: StoreSocialLinks;
  heroBanner: HeroBannerConfig;
  heroSlides: HeroBannerConfig[];
  flashSale: FlashSaleConfig;
  taxonomy: CatalogTaxonomy;
  stories: Story[];
  facebookPixel?: FacebookPixelConfig;
  courier?: CourierConfig;
  manualPayment?: ManualPaymentSettings;
  emailSettings?: EmailSenderConfig;
  adminPasswordHash?: string;
};

export type AdminActivityRecord = {
  id: string;
  type: "order" | "product" | "inventory" | "coupon" | "settings";
  title: string;
  detail: string;
  timestamp: string;
};

export type AdminReviewRecord = {
  id: string;
  productId: string;
  productName?: string;
  orderId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  rating: number;
  title?: string;
  comment: string;
  status: "pending" | "approved" | "rejected";
  verifiedPurchase: boolean;
  createdAt: string;
};

type SupabaseProductRow = {
  id: string;
  slug: string;
  sku?: string | null;
  name: string;
  description: string;
  price: number;
  original_price: number | null;
  cost_price?: number | null;
  status?: ProductStatus | null;
  category: ProductCategory;
  fabric: Fabric | null;
  colour: ProductColour;
  stock: number;
  low_stock_threshold?: number | null;
  material: string;
  size: string;
  delivery_note: string;
  image_src: string;
  image_alt: string;
  image_position: string | null;
  sections: ProductSectionKey[] | null;
  variants: ProductVariant[] | null;
  last_restocked_at?: string | null;
  added_at: string;
};

type SupabaseOrderRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_address: string;
  customer_city: string;
  customer_notes: string | null;
  delivery_zone: OrderDeliveryZone;
  payment_method: OrderPaymentMethod;
  payment_phone: string | null;
  payment_trx_id?: string | null;
  payment_status?: AdminPaymentStatus | null;
  delivery_status?: AdminDeliveryStatus | null;
  items: Order["items"];
  subtotal: number;
  discount_amount?: number | null;
  coupon_code?: string | null;
  shipping_fee: number;
  tax_amount?: number | null;
  refund_amount?: number | null;
  total: number;
  status: AdminOrderStatus;
  created_at: string;
  updated_at?: string | null;
};

const LEGACY_DUPLICATE_ID_MAP: Record<string, string> = {
  "popular-mocha": "sale-mocha",
  "for-you-jersey": "jersey-olive",
};

const LEGACY_CANONICAL_NAME_MAP: Record<string, { oldName: string; newName: string }> = {
  "chiffon-classics": { oldName: "Chiffon Hijab", newName: "Classic Chiffon Hijab" },
  "silk-mauve": { oldName: "Silk Hijab", newName: "Rose Silk Hijab" },
  "for-you-mauve": { oldName: "Premium Modal Hijab", newName: "Soft Mauve Modal Hijab" },
  "for-you-black": { oldName: "Chiffon Hijab", newName: "Midnight Black Chiffon Hijab" },
  "for-you-silk": { oldName: "Silk Hijab", newName: "Lustre Mauve Silk Hijab" },
};

const DEFAULT_SECTION_MAP: Record<ProductSectionKey, readonly string[]> = {
  "new-items": ["premium-modal-rose", "chiffon-classics", "jersey-olive", "silk-mauve"],
  "flash-sale": ["sale-black", "sale-rose", "sale-ivory", "sale-colors", "sale-mocha", "sale-essentials"],
  "most-popular": ["sale-mocha", "popular-black", "popular-sand", "popular-mauve", "popular-olive"],
  "just-for-you": ["for-you-rose", "for-you-modal", "jersey-olive", "for-you-mauve", "for-you-black", "for-you-silk"],
  "top-products": [
    "popular-sand",
    "chiffon-classics",
    "popular-black",
    "top-jersey",
    "premium-modal-rose",
    "sale-essentials",
    "jersey-olive",
    "silk-mauve",
    "sale-mocha",
    "sale-colors",
  ],
};

export const DEFAULT_HERO_BANNER: HeroBannerConfig = {
  titleLine1: "Everyday",
  titleLine2: "Elegance",
  subtitle: "Premium Hijabs for You",
  ctaLabel: "Explore Collection",
  ctaHref: "#new-items",
  imageSrc: photos.hero.src,
  imageAlt: photos.hero.alt,
  imagePosition: photos.hero.position || "center 42%",
};

export const DEFAULT_HERO_SLIDES: [HeroBannerConfig, HeroBannerConfig, HeroBannerConfig] = [
  DEFAULT_HERO_BANNER,
  {
    titleLine1: "Signature Modal",
    titleLine2: "& Chiffon Drapes",
    subtitle: "Breathable, lightweight fabrics crafted for effortless all-day grace",
    ctaLabel: "Shop Modal & Chiffon",
    ctaHref: "/shop?fabric=modal",
    imageSrc: photos.sand.src,
    imageAlt: photos.sand.alt,
    imagePosition: photos.sand.position || "center 20%",
  },
  {
    titleLine1: "Limited Time",
    titleLine2: "Flash Sale Edit",
    subtitle: "Exclusive seasonal markdowns on signature hijabs & modest essentials",
    ctaLabel: "Shop Flash Sale",
    ctaHref: "#flash-sale",
    imageSrc: photos.rose.src,
    imageAlt: photos.rose.alt,
    imagePosition: photos.rose.position || "center 18%",
  },
];

export const DEFAULT_FLASH_SALE: FlashSaleConfig = {
  enabled: true,
  endsAt: null,
  expiredBehavior: "revert-prices",
  title: "Flash Sale",
  subtitle: "Exclusive markdowns on signature drapes before the timer runs out.",
  badge: "Limited Time Offer",
};

export function isFlashSaleActive(config?: FlashSaleConfig | null): boolean {
  if (!config) return true;
  if (!config.enabled) return false;
  if (config.endsAt) {
    const endMs = Date.parse(config.endsAt);
    if (!Number.isNaN(endMs) && endMs <= Date.now()) {
      return false;
    }
  }
  return true;
}

export function normalizeFacebookPixel(raw?: Partial<FacebookPixelConfig> | null): FacebookPixelConfig {
  const pixelId = String(raw?.pixelId ?? "").trim().replace(/[^\d]/g, "");
  return {
    pixelId,
    enabled: Boolean(raw?.enabled && pixelId.length >= 10),
    testMode: Boolean(raw?.testMode),
    lastVerifiedAt: raw?.lastVerifiedAt ? String(raw.lastVerifiedAt) : null,
  };
}

function normalizePickupHubs(
  rawHubs?: unknown,
  fallbackStoreId?: string,
  defaultInHouseCourier?: CourierProvider,
  defaultSupplierCourier?: CourierProvider,
): PickupHubConfig[] {
  if (!Array.isArray(rawHubs) || rawHubs.length === 0) {
    return getDefaultPickupHubs({
      pathaoStoreId: fallbackStoreId,
      defaultInHouseCourier,
      defaultSupplierCourier,
    });
  }
  const normalized = rawHubs
    .filter((h): h is Partial<PickupHubConfig> => Boolean(h && typeof h === "object"))
    .map((h, idx) => {
      const source: FulfillmentSource = h.source === "supplier" ? "supplier" : "in-house";
      const id =
        String(h.id || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-_]+/g, "-") || `hub-${idx + 1}`;
      return {
        id,
        name: String(h.name || (source === "supplier" ? "Supplier Hub" : "Own Warehouse")).trim(),
        source,
        contactName: String(h.contactName || "").trim(),
        phone: String(h.phone || "").trim(),
        address: String(h.address || "Dhaka, Bangladesh").trim(),
        preferredCourier: (h.preferredCourier === "pathao" ? "pathao" : "steadfast") as CourierProvider,
        pathaoStoreId: String(h.pathaoStoreId || "").trim(),
        steadfastPickupNote: String(h.steadfastPickupNote || "").trim(),
        isDefault: Boolean(h.isDefault),
      };
    });
  return normalized.length > 0
    ? normalized
    : getDefaultPickupHubs({
        pathaoStoreId: fallbackStoreId,
        defaultInHouseCourier,
        defaultSupplierCourier,
      });
}

export function normalizeCourier(raw?: Partial<CourierConfig> | null): CourierConfig {
  const steadfastApiKey = raw?.steadfastApiKey?.trim() || "";
  const steadfastSecretKey = raw?.steadfastSecretKey?.trim() || "";
  const pathaoClientId = raw?.pathaoClientId?.trim() || "";
  const pathaoClientSecret = raw?.pathaoClientSecret?.trim() || "";
  const pathaoUsername = raw?.pathaoUsername?.trim() || "";
  const pathaoPassword = raw?.pathaoPassword?.trim() || "";
  const pathaoStoreId = raw?.pathaoStoreId?.trim() || "";

  const steadfastEnabled =
    raw?.steadfastEnabled !== undefined
      ? Boolean(raw.steadfastEnabled)
      : Boolean(steadfastApiKey && steadfastSecretKey);
  const pathaoEnabled =
    raw?.pathaoEnabled !== undefined
      ? Boolean(raw.pathaoEnabled)
      : Boolean(pathaoClientId && pathaoClientSecret && pathaoUsername && pathaoPassword);

  const defaultInHouseCourier: CourierProvider =
    raw?.defaultInHouseCourier === "pathao" ? "pathao" : "steadfast";
  const defaultSupplierCourier: CourierProvider =
    raw?.defaultSupplierCourier === "steadfast" || raw?.defaultSupplierCourier === "pathao"
      ? raw.defaultSupplierCourier
      : pathaoEnabled
        ? "pathao"
        : "steadfast";

  return {
    provider: raw?.provider === "pathao" ? "pathao" : "steadfast",
    enabled: Boolean(raw?.enabled || steadfastEnabled || pathaoEnabled),
    steadfastEnabled,
    steadfastApiKey,
    steadfastSecretKey,
    steadfastWebhookToken: raw?.steadfastWebhookToken?.trim() || "",
    pathaoEnabled,
    pathaoClientId,
    pathaoClientSecret,
    pathaoUsername,
    pathaoPassword,
    pathaoStoreId,
    pathaoWebhookSecret: raw?.pathaoWebhookSecret?.trim() || "",
    defaultInHouseCourier,
    defaultSupplierCourier,
    pickupHubs: normalizePickupHubs(
      raw?.pickupHubs,
      pathaoStoreId,
      defaultInHouseCourier,
      defaultSupplierCourier,
    ),
    autoFraudCheck: raw?.autoFraudCheck !== false,
    testMode: Boolean(raw?.testMode),
  };
}

export const DEFAULT_MANUAL_PAYMENT: ManualPaymentSettings = {
  bkash: {
    enabled: true,
    accountNumber: "01700-000000",
    accountType: "Personal",
    instruction:
      "bKash অ্যাপ থেকে 'Send Money' অপশনে গিয়ে মোট টাকা পাঠান এবং আপনার প্রেরক নম্বর ও Transaction ID (TrxID) নিচে দিন।",
  },
  nagad: {
    enabled: true,
    accountNumber: "01700-000000",
    accountType: "Personal",
    instruction:
      "Nagad অ্যাপ থেকে 'Send Money' অপশনে গিয়ে মোট টাকা পাঠান এবং আপনার প্রেরক নম্বর ও Transaction ID (TrxID) নিচে দিন।",
  },
  verificationNote:
    "অ্যাডমিন আপনার Transaction ID (TrxID) যাচাই করার পর পেমেন্ট ও অর্ডার কনফার্ম হবে।",
};

function normalizeChannelType(val: unknown): "Personal" | "Merchant" | "Agent" {
  return val === "Merchant" || val === "Agent" ? val : "Personal";
}

export function normalizeManualPayment(
  raw?: Partial<ManualPaymentSettings> | null,
): ManualPaymentSettings {
  return {
    bkash: {
      enabled:
        raw?.bkash?.enabled !== undefined
          ? Boolean(raw.bkash.enabled)
          : DEFAULT_MANUAL_PAYMENT.bkash.enabled,
      accountNumber:
        raw?.bkash?.accountNumber !== undefined
          ? String(raw.bkash.accountNumber).trim()
          : DEFAULT_MANUAL_PAYMENT.bkash.accountNumber,
      accountType: normalizeChannelType(raw?.bkash?.accountType),
      instruction:
        raw?.bkash?.instruction !== undefined
          ? String(raw.bkash.instruction).trim()
          : DEFAULT_MANUAL_PAYMENT.bkash.instruction,
    },
    nagad: {
      enabled:
        raw?.nagad?.enabled !== undefined
          ? Boolean(raw.nagad.enabled)
          : DEFAULT_MANUAL_PAYMENT.nagad.enabled,
      accountNumber:
        raw?.nagad?.accountNumber !== undefined
          ? String(raw.nagad.accountNumber).trim()
          : DEFAULT_MANUAL_PAYMENT.nagad.accountNumber,
      accountType: normalizeChannelType(raw?.nagad?.accountType),
      instruction:
        raw?.nagad?.instruction !== undefined
          ? String(raw.nagad.instruction).trim()
          : DEFAULT_MANUAL_PAYMENT.nagad.instruction,
    },
    verificationNote:
      raw?.verificationNote !== undefined
        ? String(raw.verificationNote).trim()
        : DEFAULT_MANUAL_PAYMENT.verificationNote,
  };
}

const DEFAULT_SETTINGS: AdminSettingsRecord = {
  storeName: "HayaNest BD",
  timezone: "Asia/Dhaka",
  currency: "BDT",
  lowStockThreshold: 5,
  monthlySalesTarget: null,
  insideDhakaShippingFee: 70,
  outsideDhakaShippingFee: 130,
  contactEmail: "support@hayanestbd.com",
  contactPhone: "+880 1700-000000",
  contactLocation: "Dhaka, Bangladesh",
  socialLinks: {
    facebook: "",
    instagram: "",
    youtube: "",
    tiktok: "",
  },
  heroBanner: DEFAULT_HERO_BANNER,
  heroSlides: [...DEFAULT_HERO_SLIDES],
  flashSale: DEFAULT_FLASH_SALE,
  taxonomy: DEFAULT_CATALOG_TAXONOMY,
  stories: defaultStories,
  facebookPixel: {
    pixelId: "",
    enabled: false,
    testMode: false,
    lastVerifiedAt: null,
  },
  courier: {
    provider: "steadfast",
    enabled: false,
    steadfastEnabled: false,
    steadfastApiKey: "",
    steadfastSecretKey: "",
    steadfastWebhookToken: "",
    pathaoEnabled: false,
    pathaoClientId: "",
    pathaoClientSecret: "",
    pathaoUsername: "",
    pathaoPassword: "",
    pathaoStoreId: "",
    pathaoWebhookSecret: "",
    defaultInHouseCourier: "steadfast",
    defaultSupplierCourier: "pathao",
    pickupHubs: getDefaultPickupHubs(),
    autoFraudCheck: true,
    testMode: false,
  },
  manualPayment: DEFAULT_MANUAL_PAYMENT,
};

function generateSku(
  product: { id: string; category: ProductCategory; fabric: Fabric | null; colour: ProductColour },
  index = 0,
): string {
  const catCode =
    product.category === "accessories"
      ? "ACC"
      : (product.fabric ?? product.category ?? "HIJ").slice(0, 3).toUpperCase();
  const colCode = (product.colour || "STD").slice(0, 3).toUpperCase();
  const parts = product.id.split("-").filter(Boolean);
  const rawSuffix =
    parts.length >= 2
      ? `${parts[0].slice(0, 2)}${parts[parts.length - 1].slice(-2)}`
      : product.id.replace(/[^a-z0-9]/gi, "").slice(-4);
  const suffix = rawSuffix.toUpperCase() || String(index + 1).padStart(3, "0");
  return `HN-${catCode}-${colCode}-${suffix}`;
}

function getDefaultSectionsForId(id: string): ProductSectionKey[] {
  const canonicalId = LEGACY_DUPLICATE_ID_MAP[id] ?? id;
  const keys = Object.keys(DEFAULT_SECTION_MAP) as ProductSectionKey[];
  return keys.filter((section) => DEFAULT_SECTION_MAP[section].includes(canonicalId));
}

function sumVariantStocks(variants: readonly ProductVariant[]): number {
  return variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock ?? 0)), 0);
}

function buildDefaultAdminProducts(): AdminProductRecord[] {
  return deduplicateAndNormalizeProducts(
    catalogProducts.map((product, index) => {
      const totalVariantStock = sumVariantStocks(product.details.variants);
      return {
        ...product,
        sku: generateSku(product, index),
        costPrice: null,
        status: "active",
        stock: totalVariantStock,
        lowStockThreshold: 5,
        lastRestockedAt: null,
        sections: getDefaultSectionsForId(product.id),
        fulfillmentSource: product.fulfillmentSource === "supplier" ? "supplier" : "in-house",
        ...(product.pickupHubId ? { pickupHubId: product.pickupHubId } : {}),
      };
    }),
  );
}

const RUNTIME_STORE_PATH = path.join(process.cwd(), "data", "runtime-store.json");

export type CustomerAccountRecord = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  password: string;
  resetToken?: string | null;
  resetCode?: string | null;
  resetExpiresAt?: string | null;
  createdAt: string;
};

export type ContactMessageRecord = {
  id: string;
  name: string;
  contact: string;
  topic: string;
  message: string;
  status: "unread" | "resolved";
  createdAt: string;
};

type LocalRuntimeStore = {
  products: AdminProductRecord[];
  orders: AdminOrderRecord[];
  coupons: AdminCouponRecord[];
  settings: AdminSettingsRecord;
  activities: AdminActivityRecord[];
  reviews: AdminReviewRecord[];
  customers?: CustomerAccountRecord[];
  contactMessages?: ContactMessageRecord[];
};

function normalizeProductRecord(raw: Partial<AdminProductRecord> & CatalogProduct, index = 0): AdminProductRecord {
  const variants = raw.details?.variants ?? createDemoDetails(raw).variants;
  const variantTotal = sumVariantStocks(variants);
  const renameRule = LEGACY_CANONICAL_NAME_MAP[raw.id];
  const resolvedName =
    renameRule && raw.name === renameRule.oldName ? renameRule.newName : raw.name;
  const fulfillmentSource: FulfillmentSource =
    raw.fulfillmentSource === "supplier" ? "supplier" : "in-house";
  const pickupHubId = raw.pickupHubId?.trim() || undefined;
  return {
    ...raw,
    name: resolvedName,
    sku: raw.sku || generateSku(raw, index),
    costPrice: typeof raw.costPrice === "number" && !Number.isNaN(raw.costPrice) ? raw.costPrice : null,
    status: raw.status === "inactive" ? "inactive" : "active",
    stock: typeof raw.stock === "number" ? raw.stock : variantTotal,
    lowStockThreshold: typeof raw.lowStockThreshold === "number" ? raw.lowStockThreshold : 5,
    lastRestockedAt: raw.lastRestockedAt ?? null,
    sections: Array.isArray(raw.sections) ? raw.sections : getDefaultSectionsForId(raw.id),
    fulfillmentSource,
    ...(pickupHubId ? { pickupHubId } : {}),
  };
}

function deduplicateAndNormalizeProducts(records: AdminProductRecord[]): AdminProductRecord[] {
  const byCanonicalId = new Map<string, AdminProductRecord>();

  // 1. Merge legacy duplicate IDs (e.g. popular-mocha -> sale-mocha, for-you-jersey -> jersey-olive) and exact ID duplicates
  for (const item of records) {
    const targetId = LEGACY_DUPLICATE_ID_MAP[item.id] ?? item.id;
    const isAlias = targetId !== item.id;
    const existing = byCanonicalId.get(targetId);

    if (!existing) {
      const normalizedItem: AdminProductRecord = isAlias
        ? {
            ...item,
            id: targetId,
            slug: targetId,
            sections: Array.from(new Set([...item.sections, ...getDefaultSectionsForId(targetId)])),
          }
        : item;
      byCanonicalId.set(targetId, normalizedItem);
    } else {
      const mergedSections = Array.from(
        new Set([...existing.sections, ...item.sections, ...getDefaultSectionsForId(targetId)]),
      );
      const primary = isAlias ? existing : item;
      const secondary = isAlias ? item : existing;
      byCanonicalId.set(targetId, {
        ...primary,
        id: targetId,
        slug: targetId,
        originalPrice: primary.originalPrice ?? secondary.originalPrice,
        sections: mergedSections,
      });
    }
  }

  // 2. Merge any remaining records that have the exact same (name + category + fabric + colour)
  const byIdentityKey = new Map<string, AdminProductRecord>();
  for (const item of byCanonicalId.values()) {
    const identityKey = [
      item.name.trim().toLowerCase(),
      item.category.trim().toLowerCase(),
      (item.fabric ?? "").trim().toLowerCase(),
      item.colour.trim().toLowerCase(),
    ].join("::");
    const existing = byIdentityKey.get(identityKey);
    if (!existing) {
      byIdentityKey.set(identityKey, item);
    } else {
      byIdentityKey.set(identityKey, {
        ...existing,
        originalPrice: existing.originalPrice ?? item.originalPrice,
        sections: Array.from(new Set([...existing.sections, ...item.sections])),
      });
    }
  }

  // 3. Ensure every product has a 100% unique SKU and distinct display title
  const usedSkus = new Set<string>();
  const nameCounts = new Map<string, number>();
  const deduplicated = Array.from(byIdentityKey.values());

  for (const item of deduplicated) {
    const key = item.name.trim().toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }

  return deduplicated.map((item, idx) => {
    const nameKey = item.name.trim().toLowerCase();
    let finalName = item.name.trim();
    if ((nameCounts.get(nameKey) ?? 0) > 1) {
      const colourLabel =
        item.colour.charAt(0).toUpperCase() + item.colour.slice(1).replace(/-/g, " ");
      if (!finalName.toLowerCase().includes(colourLabel.toLowerCase())) {
        finalName = `${finalName} (${colourLabel})`;
      }
    }

    let candidateSku = (item.sku || generateSku(item, idx)).trim().toUpperCase();
    if (usedSkus.has(candidateSku)) {
      candidateSku = generateSku(item, idx).toUpperCase();
    }
    let counter = 2;
    while (usedSkus.has(candidateSku)) {
      candidateSku = `${generateSku(item, idx).toUpperCase()}-${counter}`;
      counter += 1;
    }
    usedSkus.add(candidateSku);

    return {
      ...item,
      name: finalName,
      sku: candidateSku,
    };
  });
}

export function derivePaymentStatus(
  status: AdminOrderStatus,
  paymentMethod: OrderPaymentMethod,
  explicit?: AdminPaymentStatus | null,
  refundAmount = 0,
  total = 0,
): AdminPaymentStatus {
  if (status === "Refunded" || (refundAmount > 0 && total > 0 && refundAmount >= total)) {
    return "Refunded";
  }
  if (refundAmount > 0 && refundAmount < total) return "Partially Refunded";
  if (explicit) return explicit;
  if (status === "Cancelled") return "Failed";
  if (paymentMethod === "cod" && status === "Delivered") return "Paid";
  return "Pending";
}

export function deriveDeliveryStatus(
  status: AdminOrderStatus,
  explicit?: AdminDeliveryStatus | null,
): AdminDeliveryStatus {
  if (explicit) return explicit;
  switch (status) {
    case "Delivered":
      return "Delivered";
    case "Shipped":
      return "In Transit";
    case "Returned":
    case "Refunded":
      return "Returned";
    case "Cancelled":
      return "Cancelled";
    case "Processing":
      return "Pending Dispatch";
    case "Pending":
      return "Pending Dispatch";
    default:
      return "Pending Dispatch";
  }
}

type RawOrderItemInput = Partial<OrderItem> & {
  productId?: string;
  image?: string;
  imageSrc?: string;
  image_src?: string;
};

function normalizeOrderItemRecord(rawItem: RawOrderItemInput, index: number): OrderItem {
  const cleanName = String(rawItem.name || "Product");
  const cleanId = String(rawItem.id || rawItem.productId || rawItem.slug || `item-${index + 1}`);
  const cleanSlug = String(rawItem.slug || rawItem.productId || rawItem.id || cleanId);
  const rawPhoto =
    rawItem.photo && typeof rawItem.photo === "object"
      ? (rawItem.photo as { src?: unknown; alt?: unknown })
      : undefined;
  const fallbackSrc =
    rawPhoto?.src ||
    rawItem.image ||
    rawItem.imageSrc ||
    rawItem.image_src ||
    "/images/placeholder.webp";
  const fallbackAlt = rawPhoto?.alt || cleanName;

  return {
    ...rawItem,
    id: cleanId,
    slug: cleanSlug,
    name: cleanName,
    price: Number(rawItem.price ?? 0),
    quantity: Math.max(1, Number(rawItem.quantity ?? 1)),
    ...(rawItem.colour ? { colour: String(rawItem.colour) } : {}),
    ...(rawItem.fulfillmentSource
      ? { fulfillmentSource: rawItem.fulfillmentSource === "supplier" ? "supplier" : "in-house" }
      : {}),
    ...(rawItem.pickupHubId ? { pickupHubId: String(rawItem.pickupHubId) } : {}),
    ...(rawItem.pickupHubName ? { pickupHubName: String(rawItem.pickupHubName) } : {}),
    photo: {
      src: String(fallbackSrc),
      alt: String(fallbackAlt),
    },
  };
}

function normalizeOrderRecord(
  raw: Omit<Order, "status"> & Partial<AdminOrderRecord> & { status?: AdminOrderStatus },
): AdminOrderRecord {
  const status: AdminOrderStatus = raw.status ?? "Pending";
  const items: OrderItem[] = Array.isArray(raw.items)
    ? raw.items.map((item, idx) =>
        normalizeOrderItemRecord((item ?? {}) as RawOrderItemInput, idx),
      )
    : [];
  const subtotal = Number(raw.subtotal ?? 0);
  const shippingFee = Number(raw.shippingFee ?? 0);
  const discountAmount = Math.max(0, Number(raw.discountAmount ?? 0));
  const taxAmount = Math.max(0, Number(raw.taxAmount ?? 0));
  const total = Number(raw.total ?? Math.max(0, subtotal - discountAmount + shippingFee + taxAmount));
  const refundAmount =
    status === "Refunded" && !raw.refundAmount
      ? total
      : Math.max(0, Number(raw.refundAmount ?? 0));
  const cleanPaymentPhone = raw.paymentPhone?.trim() || undefined;
  const cleanPaymentTrxId = raw.paymentTrxId?.trim().toUpperCase() || undefined;
  const shipments =
    Array.isArray(raw.shipments) && raw.shipments.length > 0 ? raw.shipments : undefined;

  return {
    ...raw,
    ...(cleanPaymentPhone ? { paymentPhone: cleanPaymentPhone } : {}),
    ...(cleanPaymentTrxId ? { paymentTrxId: cleanPaymentTrxId } : {}),
    ...(shipments ? { shipments } : {}),
    items,
    status,
    subtotal,
    shippingFee,
    discountAmount,
    couponCode: raw.couponCode ?? null,
    taxAmount,
    refundAmount,
    total,
    paymentStatus: derivePaymentStatus(status, raw.paymentMethod, raw.paymentStatus, refundAmount, total),
    deliveryStatus: deriveDeliveryStatus(status, raw.deliveryStatus),
    updatedAt: raw.updatedAt ?? raw.createdAt,
  };
}

const MEMORY_CACHE_TTL_MS = 120_000;

type StoreRepositoryMemoryCache = {
  cachedLocalStore: { data: LocalRuntimeStore; expiresAt: number } | null;
  cachedSettings: { data: AdminSettingsRecord; expiresAt: number } | null;
  inFlightSettingsPromise: Promise<AdminSettingsRecord> | null;
  cachedRawProducts: { data: AdminProductRecord[]; expiresAt: number } | null;
  inFlightProductsPromise: Promise<AdminProductRecord[]> | null;
  cachedApprovedReviews: { data: AdminReviewRecord[]; expiresAt: number } | null;
  inFlightApprovedReviewsPromise: Promise<AdminReviewRecord[]> | null;
};

const MEMORY_CACHE_GLOBAL_KEY = Symbol.for("hayanest.storeRepositoryMemoryCache");

function getMemoryCache(): StoreRepositoryMemoryCache {
  const globalStore = globalThis as typeof globalThis & {
    [MEMORY_CACHE_GLOBAL_KEY]?: StoreRepositoryMemoryCache;
  };
  if (!globalStore[MEMORY_CACHE_GLOBAL_KEY]) {
    globalStore[MEMORY_CACHE_GLOBAL_KEY] = {
      cachedLocalStore: null,
      cachedSettings: null,
      inFlightSettingsPromise: null,
      cachedRawProducts: null,
      inFlightProductsPromise: null,
      cachedApprovedReviews: null,
      inFlightApprovedReviewsPromise: null,
    };
  }
  return globalStore[MEMORY_CACHE_GLOBAL_KEY];
}

export function invalidateStoreMemoryCache(): void {
  const memCache = getMemoryCache();
  memCache.cachedLocalStore = null;
  memCache.cachedSettings = null;
  memCache.inFlightSettingsPromise = null;
  memCache.cachedRawProducts = null;
  memCache.inFlightProductsPromise = null;
  memCache.cachedApprovedReviews = null;
  memCache.inFlightApprovedReviewsPromise = null;
}

const TMP_RUNTIME_STORE_PATH = path.join(os.tmpdir(), "hayanest-runtime-store.json");

async function readRawRuntimeJson(): Promise<string> {
  try {
    return await readFile(TMP_RUNTIME_STORE_PATH, "utf8");
  } catch {
    return await readFile(RUNTIME_STORE_PATH, "utf8");
  }
}

async function readLocalStore(): Promise<LocalRuntimeStore> {
  const memCache = getMemoryCache();
  if (memCache.cachedLocalStore && Date.now() < memCache.cachedLocalStore.expiresAt) {
    return memCache.cachedLocalStore.data;
  }
  try {
    const raw = await readRawRuntimeJson();
    const parsed = JSON.parse(raw) as Partial<LocalRuntimeStore>;
    const rawProducts =
      Array.isArray(parsed.products) && parsed.products.length > 0
        ? parsed.products.map((p, idx) => normalizeProductRecord(p, idx))
        : buildDefaultAdminProducts();
    const products = deduplicateAndNormalizeProducts(rawProducts);
    const orders = Array.isArray(parsed.orders)
      ? parsed.orders.map((o) => normalizeOrderRecord(o as Order))
      : [];
    const coupons = Array.isArray(parsed.coupons) ? parsed.coupons : [];
    const settings: AdminSettingsRecord = {
      ...DEFAULT_SETTINGS,
      ...(parsed.settings ?? {}),
      manualPayment: normalizeManualPayment(parsed.settings?.manualPayment),
    };
    const activities = Array.isArray(parsed.activities) ? parsed.activities : [];
    const reviews = Array.isArray(parsed.reviews) ? parsed.reviews : [];
    const customers = Array.isArray(parsed.customers) ? parsed.customers : [];
    const contactMessages = Array.isArray(parsed.contactMessages)
      ? parsed.contactMessages
      : [];
    const storeData: LocalRuntimeStore = {
      products,
      orders,
      coupons,
      settings,
      activities,
      reviews,
      customers,
      contactMessages,
    };
    memCache.cachedLocalStore = {
      data: storeData,
      expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
    };
    return storeData;
  } catch {
    const fallbackData: LocalRuntimeStore = {
      products: buildDefaultAdminProducts(),
      orders: [],
      coupons: [],
      settings: DEFAULT_SETTINGS,
      activities: [],
      reviews: [],
      customers: [],
      contactMessages: [],
    };
    memCache.cachedLocalStore = {
      data: fallbackData,
      expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
    };
    return fallbackData;
  }
}

async function writeLocalStore(store: LocalRuntimeStore): Promise<void> {
  invalidateStoreMemoryCache();
  const memCache = getMemoryCache();
  memCache.cachedLocalStore = {
    data: store,
    expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
  };
  const serialized = JSON.stringify(store, null, 2);
  try {
    await mkdir(path.dirname(RUNTIME_STORE_PATH), { recursive: true });
    await writeFile(RUNTIME_STORE_PATH, serialized, "utf8");
  } catch {
    // On Vercel serverless, process.cwd() is read-only (EROFS). Fall back to /tmp safely.
    try {
      await writeFile(TMP_RUNTIME_STORE_PATH, serialized, "utf8");
    } catch {
      // Keep in-memory cache + Supabase persistence
    }
  }
}

function appendActivity(
  store: LocalRuntimeStore,
  entry: Omit<AdminActivityRecord, "id" | "timestamp">,
) {
  store.activities = [
    {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    },
    ...store.activities,
  ].slice(0, 60);
}

const SAFE_DB_CATEGORIES = new Set(["hijabs", "accessories"]);
const SAFE_DB_FABRICS = new Set(["modal", "chiffon", "jersey", "silk"]);
const SAFE_DB_COLOURS = new Set([
  "white",
  "navy",
  "rose",
  "olive",
  "black",
  "sand",
  "mocha",
  "mauve",
  "burgundy",
  "multi",
  "gold",
]);

type ExtendedProductVariant = ProductVariant & {
  customCategory?: string;
  customFabric?: string | null;
  customColour?: string;
  customFulfillmentSource?: FulfillmentSource;
  customPickupHubId?: string;
};

function rowToProduct(row: SupabaseProductRow | Record<string, unknown>, index = 0): AdminProductRecord {
  const rowObj = row as Record<string, unknown>;
  if (rowObj?.payload && typeof rowObj.payload === "object" && rowObj.payload !== null) {
    const p = rowObj.payload as Record<string, unknown>;
    const photoObj =
      p.photo && typeof p.photo === "object" ? (p.photo as Record<string, unknown>) : undefined;
    const detailsObj =
      p.details && typeof p.details === "object" ? (p.details as Record<string, unknown>) : undefined;
    const positionVal = p.image_position || p.imagePosition || photoObj?.position;

    const photo: Photo = {
      src: String(
        photoObj?.src || p.image || p.imageSrc || p.image_src || "/images/placeholder.webp",
      ),
      alt: String(
        photoObj?.alt || p.alt || p.imageAlt || p.image_alt || p.name || rowObj.name || "Product",
      ),
      ...(photoObj?.colour || p.colour
        ? { colour: String(photoObj?.colour || p.colour) }
        : {}),
      ...(positionVal ? { position: String(positionVal) } : {}),
    };
    const resolvedCategory: ProductCategory = (p.category as ProductCategory) || "hijabs";
    const resolvedFabric: Fabric | null = p.fabric ? (p.fabric as Fabric) : null;
    const resolvedColour: ProductColour = (p.colour || "rose") as ProductColour;

    const fallbackDetails = createDemoDetails({
      id: String(rowObj.id),
      category: resolvedCategory,
      fabric: resolvedFabric,
      colour: resolvedColour,
      photo,
    });

    const galleryPhotos: [Photo, ...Photo[]] =
      Array.isArray(p.gallery) && p.gallery.length > 0
        ? ((p.gallery as unknown[]).map((g) =>
            typeof g === "string"
              ? { src: g, alt: String(p.name || rowObj.name || "Photo") }
              : (g as Photo),
          ) as [Photo, ...Photo[]])
        : [photo];

    const rawVariants =
      Array.isArray(detailsObj?.variants) && detailsObj.variants.length > 0
        ? detailsObj.variants
        : Array.isArray(p.variants) && p.variants.length > 0
          ? p.variants
          : null;

    const variants: [ProductVariant, ...ProductVariant[]] = rawVariants
      ? (rawVariants as [ProductVariant, ...ProductVariant[]])
      : [
          {
            colour: resolvedColour,
            customCategory: resolvedCategory,
            customFabric: resolvedFabric,
            customColour: resolvedColour,
            stock: typeof p.stock === "number" ? p.stock : 10,
            gallery: galleryPhotos,
          } as ProductVariant,
        ];

    const computedStock =
      typeof p.stock === "number" && !Number.isNaN(p.stock)
        ? Number(p.stock)
        : sumVariantStocks(variants);

    const resolvedPrice = Number(p.price || 0);
    const rawOrigPrice = p.originalPrice ?? p.original_price;
    const hasOriginalPrice =
      rawOrigPrice !== undefined &&
      rawOrigPrice !== null &&
      rawOrigPrice !== "" &&
      Number(rawOrigPrice) > resolvedPrice;

    const rawCost = p.costPrice ?? p.cost_price;
    const resolvedCostPrice =
      rawCost !== undefined &&
      rawCost !== null &&
      rawCost !== "" &&
      !Number.isNaN(Number(rawCost))
        ? Number(rawCost)
        : null;

    const rawLowStock = p.lowStockThreshold ?? p.low_stock_threshold;
    const resolvedLowStock =
      rawLowStock !== undefined &&
      rawLowStock !== null &&
      rawLowStock !== "" &&
      !Number.isNaN(Number(rawLowStock))
        ? Number(rawLowStock)
        : 5;

    const resolvedDescription = String(
      detailsObj?.description || p.description || fallbackDetails.description,
    );
    const firstVarMeta = variants[0] as ExtendedProductVariant | undefined;
    const resolvedFulfillment: FulfillmentSource =
      p.fulfillmentSource === "supplier" || firstVarMeta?.customFulfillmentSource === "supplier"
        ? "supplier"
        : "in-house";
    const resolvedPickupHubId =
      (p.pickupHubId ? String(p.pickupHubId).trim() : "") ||
      firstVarMeta?.customPickupHubId?.trim() ||
      undefined;

    return {
      id: String(rowObj.id),
      slug: String(rowObj.slug || p.slug || rowObj.id),
      sku: String(
        p.sku ||
          generateSku(
            {
              id: String(rowObj.id),
              category: resolvedCategory,
              fabric: resolvedFabric,
              colour: resolvedColour,
            },
            index,
          ),
      ),
      name: String(rowObj.name || p.name || "Unnamed Product"),
      description: String(p.description || resolvedDescription),
      price: resolvedPrice,
      ...(hasOriginalPrice ? { originalPrice: Number(rawOrigPrice) } : {}),
      costPrice: resolvedCostPrice,
      status: p.status === "inactive" ? "inactive" : "active",
      photo,
      category: resolvedCategory,
      fabric: resolvedFabric,
      colour: resolvedColour,
      addedAt: String(
        p.addedAt ||
          p.added_at ||
          (rowObj.updated_at
            ? String(rowObj.updated_at).slice(0, 10)
            : new Date().toISOString().slice(0, 10)),
      ),
      stock: computedStock,
      lowStockThreshold: resolvedLowStock,
      lastRestockedAt: p.lastRestockedAt ? String(p.lastRestockedAt) : null,
      sections: Array.isArray(p.sections) ? (p.sections as ProductSectionKey[]) : ["top-products"],
      fulfillmentSource: resolvedFulfillment,
      ...(resolvedPickupHubId ? { pickupHubId: resolvedPickupHubId } : {}),
      details: {
        description: resolvedDescription,
        material: String(detailsObj?.material || p.material || fallbackDetails.material),
        size: String(
          detailsObj?.size ||
            p.size ||
            (Array.isArray(p.sizes) ? (p.sizes as string[]).join(", ") : fallbackDetails.size),
        ),
        deliveryNote: String(
          detailsObj?.deliveryNote || p.deliveryNote || fallbackDetails.deliveryNote,
        ),
        variants,
      },
    };
  }

  const flatRow = row as SupabaseProductRow;
  const photo: Photo = {
    src: flatRow.image_src,
    alt: flatRow.image_alt || flatRow.name,
    ...(flatRow.image_position ? { position: flatRow.image_position } : {}),
  };

  const firstVariantMeta =
    Array.isArray(flatRow.variants) && flatRow.variants.length > 0
      ? (flatRow.variants[0] as ExtendedProductVariant)
      : undefined;

  const resolvedCategory: ProductCategory =
    firstVariantMeta?.customCategory?.trim() || flatRow.category;
  const resolvedFabric: Fabric | null =
    firstVariantMeta && "customFabric" in firstVariantMeta
      ? (firstVariantMeta.customFabric ?? null)
      : flatRow.fabric;
  const resolvedColour: ProductColour =
    firstVariantMeta?.customColour?.trim() ||
    firstVariantMeta?.colour?.trim() ||
    flatRow.colour;

  const fallbackDetails = createDemoDetails({
    id: flatRow.id,
    category: resolvedCategory,
    fabric: resolvedFabric,
    colour: resolvedColour,
    photo,
  });

  const variants: [ProductVariant, ...ProductVariant[]] =
    Array.isArray(flatRow.variants) && flatRow.variants.length > 0
      ? [
          {
            ...flatRow.variants[0],
            colour: resolvedColour,
            customCategory: resolvedCategory,
            customFabric: resolvedFabric,
            customColour: resolvedColour,
            gallery:
              Array.isArray(flatRow.variants[0].gallery) && flatRow.variants[0].gallery.length > 0
                ? [photo, ...flatRow.variants[0].gallery.slice(1)]
                : [photo],
          } as ProductVariant,
          ...flatRow.variants.slice(1),
        ]
      : [
          {
            colour: resolvedColour,
            customCategory: resolvedCategory,
            customFabric: resolvedFabric,
            customColour: resolvedColour,
            stock: flatRow.stock,
            gallery: [photo],
          } as ProductVariant,
          ...fallbackDetails.variants.slice(1),
        ];

  const computedStock =
    typeof flatRow.stock === "number" ? Number(flatRow.stock) : sumVariantStocks(variants);

  return {
    id: flatRow.id,
    slug: flatRow.slug || flatRow.id,
    sku:
      flatRow.sku ||
      generateSku(
        { id: flatRow.id, category: resolvedCategory, fabric: resolvedFabric, colour: resolvedColour },
        index,
      ),
    name: flatRow.name,
    description: flatRow.description || fallbackDetails.description,
    price: Number(flatRow.price),
    ...(flatRow.original_price && Number(flatRow.original_price) > Number(flatRow.price)
      ? { originalPrice: Number(flatRow.original_price) }
      : {}),
    costPrice:
      flatRow.cost_price !== null && flatRow.cost_price !== undefined
        ? Number(flatRow.cost_price)
        : null,
    status: flatRow.status === "inactive" ? "inactive" : "active",
    photo,
    category: resolvedCategory,
    fabric: resolvedFabric,
    colour: resolvedColour,
    addedAt: flatRow.added_at || new Date().toISOString().slice(0, 10),
    stock: computedStock,
    lowStockThreshold: Number(flatRow.low_stock_threshold ?? 5),
    lastRestockedAt: flatRow.last_restocked_at ?? null,
    sections: Array.isArray(flatRow.sections) ? flatRow.sections : [],
    fulfillmentSource:
      firstVariantMeta?.customFulfillmentSource === "supplier" ? "supplier" : "in-house",
    ...(firstVariantMeta?.customPickupHubId?.trim()
      ? { pickupHubId: firstVariantMeta.customPickupHubId.trim() }
      : {}),
    details: {
      description: flatRow.description || fallbackDetails.description,
      material: flatRow.material || fallbackDetails.material,
      size: flatRow.size || fallbackDetails.size,
      deliveryNote: flatRow.delivery_note || fallbackDetails.deliveryNote,
      variants,
    },
  };
}

function productToRow(product: AdminProductRecord): SupabaseProductRow {
  const safeCategory: ProductCategory = SAFE_DB_CATEGORIES.has(product.category)
    ? product.category
    : "hijabs";
  const safeFabric: Fabric | null =
    product.fabric === null
      ? null
      : SAFE_DB_FABRICS.has(product.fabric)
        ? product.fabric
        : "modal";
  const safeColour: ProductColour = SAFE_DB_COLOURS.has(product.colour)
    ? product.colour
    : "rose";

  const variantsWithMeta: ProductVariant[] = product.details.variants.map((v, idx) =>
    idx === 0
      ? ({
          ...v,
          colour: product.colour,
          customCategory: product.category,
          customFabric: product.fabric,
          customColour: product.colour,
          customFulfillmentSource: product.fulfillmentSource,
          ...(product.pickupHubId ? { customPickupHubId: product.pickupHubId } : {}),
        } as ProductVariant)
      : v,
  );

  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    description: product.description ?? product.details.description,
    price: product.price,
    original_price: product.originalPrice ?? null,
    cost_price: product.costPrice,
    status: product.status,
    category: safeCategory,
    fabric: safeFabric,
    colour: safeColour,
    stock: product.stock,
    low_stock_threshold: product.lowStockThreshold,
    material: product.details.material,
    size: product.details.size,
    delivery_note: product.details.deliveryNote,
    image_src: product.photo.src,
    image_alt: product.photo.alt,
    image_position: product.photo.position ?? null,
    sections: product.sections,
    variants: variantsWithMeta,
    last_restocked_at: product.lastRestockedAt,
    added_at: product.addedAt,
  };
}

function supabaseHeaders(useServiceRole = false): HeadersInit {
  const config = getBackendConfig();
  const key = useServiceRole
    ? config.supabaseServiceRoleKey || config.supabaseAnonKey
    : config.supabaseAnonKey || config.supabaseServiceRoleKey;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function fetchRawProductsFromSource(): Promise<AdminProductRecord[]> {
  const config = getBackendConfig();
  let products: AdminProductRecord[] | null = null;

  if (config.supabaseConfigured) {
    try {
      const endpoint = `${config.supabaseUrl}/rest/v1/products?select=*`;
      const response = await fetch(endpoint, {
        headers: supabaseHeaders(true),
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const rows = (await response.json()) as SupabaseProductRow[];
        if (Array.isArray(rows) && rows.length > 0) {
          products = deduplicateAndNormalizeProducts(
            rows.map((row, idx) => normalizeProductRecord(rowToProduct(row, idx), idx)),
          );
        }
      }
    } catch {
      // Fall back gracefully if network/table is not ready yet
    }
  }

  if (!products) {
    const local = await readLocalStore();
    products = local.products;
  }

  return products;
}

export async function getAllStoreProducts(options?: {
  bypassCache?: boolean;
  includeInactive?: boolean;
}): Promise<AdminProductRecord[]> {
  const memCache = getMemoryCache();
  let products: AdminProductRecord[];

  if (options?.bypassCache) {
    products = await fetchRawProductsFromSource();
    memCache.cachedRawProducts = {
      data: products,
      expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
    };
  } else if (memCache.cachedRawProducts) {
    products = memCache.cachedRawProducts.data;
    // SWR: Return cached in 0ms, refresh in background if expired
    if (Date.now() >= memCache.cachedRawProducts.expiresAt && !memCache.inFlightProductsPromise) {
      memCache.inFlightProductsPromise = fetchRawProductsFromSource()
        .then((res) => {
          memCache.cachedRawProducts = {
            data: res,
            expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
          };
          memCache.inFlightProductsPromise = null;
          return res;
        })
        .catch(() => {
          memCache.inFlightProductsPromise = null;
          return memCache.cachedRawProducts?.data ?? [];
        });
    }
  } else {
    if (!memCache.inFlightProductsPromise) {
      memCache.inFlightProductsPromise = fetchRawProductsFromSource()
        .then((res) => {
          memCache.cachedRawProducts = {
            data: res,
            expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
          };
          memCache.inFlightProductsPromise = null;
          return res;
        })
        .catch((err) => {
          memCache.inFlightProductsPromise = null;
          throw err;
        });
    }
    products = await memCache.inFlightProductsPromise;
  }

  if (options?.includeInactive) {
    return products;
  }

  const activeProducts = products.filter((item) => item.status !== "inactive");
  const settings = await getStoreSettings();
  const saleActive = isFlashSaleActive(settings.flashSale);

  if (!saleActive) {
    // Standard E-Commerce Expiry Logic:
    // When Flash Sale ends or is disabled, products in the "flash-sale" section automatically
    // revert to their regular originalPrice across the storefront (Shop, Product page, Cart, Checkout).
    return activeProducts.map((item) => {
      if (
        item.sections.includes("flash-sale") &&
        typeof item.originalPrice === "number" &&
        item.originalPrice > item.price
      ) {
        const { originalPrice, ...rest } = item;
        return {
          ...rest,
          price: originalPrice,
        };
      }
      return item;
    });
  }

  return activeProducts;
}

export async function getHomepageCollections() {
  const [products, settings] = await Promise.all([
    getAllStoreProducts({ includeInactive: false }),
    getStoreSettings(),
  ]);
  const bySection = (section: ProductSectionKey, defaultIds: readonly string[]) => {
    const matched = products.filter((item) => item.sections.includes(section));
    if (matched.length > 0) {
      const custom = matched.filter((item) => !defaultIds.includes(item.id));
      const defaults = defaultIds
        .map((id) => matched.find((item) => item.id === id))
        .filter((item): item is AdminProductRecord => Boolean(item));
      return [...custom, ...defaults];
    }
    return products.slice(0, 6);
  };

  const taxonomy = settings.taxonomy ?? DEFAULT_CATALOG_TAXONOMY;
  const fallbackPool = [
    photos.folded,
    photos.rose,
    photos.black,
    photos.mauve,
    photos.sand,
    photos.olive,
    photos.mocha,
  ];

  // Homepage Categories slider: matches the exact categories managed in Admin (taxonomy.categories)
  const homepageCategories: Category[] = taxonomy.categories.map((cat, idx) => {
    const fallbackPhoto =
      cat.value === "accessories"
        ? photos.accessories
        : cat.value === "hijabs"
          ? photos.rose
          : fallbackPool[idx % fallbackPool.length];
    const src = cat.imageSrc?.trim() || fallbackPhoto.src;
    const alt = cat.imageAlt?.trim() || `${cat.label} collection`;
    return {
      id: `cat-${cat.value}`,
      name: cat.label,
      photo: { src, alt },
      href: `/shop?category=${encodeURIComponent(cat.value)}`,
    };
  });

  return {
    allProducts: products,
    heroBanner: settings.heroBanner ?? DEFAULT_HERO_BANNER,
    heroSlides:
      Array.isArray(settings.heroSlides) && settings.heroSlides.length > 0
        ? settings.heroSlides
        : DEFAULT_HERO_SLIDES,
    flashSale: settings.flashSale ?? DEFAULT_FLASH_SALE,
    homepageStories:
      Array.isArray(settings.stories) && settings.stories.length > 0
        ? settings.stories
        : defaultStories,
    homepageCategories,
    newItems: bySection("new-items", DEFAULT_SECTION_MAP["new-items"]),
    saleProducts: bySection("flash-sale", DEFAULT_SECTION_MAP["flash-sale"]),
    popularProducts: bySection("most-popular", DEFAULT_SECTION_MAP["most-popular"]),
    recommendedProducts: bySection("just-for-you", DEFAULT_SECTION_MAP["just-for-you"]),
    topProducts: bySection("top-products", DEFAULT_SECTION_MAP["top-products"]),
  };
}

export function slugifyProductName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function collectProductMediaUrls(product?: AdminProductRecord | null): string[] {
  if (!product) return [];
  const urls = new Set<string>();
  if (product.photo?.src) {
    urls.add(product.photo.src);
  }
  for (const variant of product.details?.variants ?? []) {
    for (const galleryItem of variant.gallery ?? []) {
      if (galleryItem?.src) {
        urls.add(galleryItem.src);
      }
    }
  }
  return Array.from(urls);
}

function collectSettingsMediaUrls(settings?: AdminSettingsRecord | null): string[] {
  if (!settings) return [];
  const urls = new Set<string>();
  if (settings.heroBanner?.imageSrc) {
    urls.add(settings.heroBanner.imageSrc);
  }
  for (const slide of settings.heroSlides ?? []) {
    if (slide?.imageSrc) {
      urls.add(slide.imageSrc);
    }
  }
  for (const story of settings.stories ?? []) {
    if (story.videoSrc) urls.add(story.videoSrc);
    if (story.photo?.src) urls.add(story.photo.src);
    if (story.avatar?.src) urls.add(story.avatar.src);
  }
  for (const cat of settings.taxonomy?.categories ?? []) {
    if (cat.imageSrc) urls.add(cat.imageSrc);
  }
  for (const fab of settings.taxonomy?.fabrics ?? []) {
    if (fab.imageSrc) urls.add(fab.imageSrc);
  }
  return Array.from(urls);
}

export async function cleanupUnusedMediaUrls(
  candidateUrls: Array<string | undefined | null>,
): Promise<number> {
  const managedCandidates = candidateUrls
    .map((u) => u?.trim() ?? "")
    .filter((u) => u.length > 0 && isManagedUploadedMedia(u));

  if (managedCandidates.length === 0) {
    return 0;
  }

  const [allProducts, settings] = await Promise.all([
    getAllStoreProducts({ bypassCache: true, includeInactive: true }),
    getStoreSettings(),
  ]);

  const activeReferenceKeys = new Set<string>();
  for (const product of allProducts) {
    for (const url of collectProductMediaUrls(product)) {
      const key = getCanonicalMediaKey(url);
      if (key) activeReferenceKeys.add(key);
    }
  }
  for (const url of collectSettingsMediaUrls(settings)) {
    const key = getCanonicalMediaKey(url);
    if (key) activeReferenceKeys.add(key);
  }

  const processedKeys = new Set<string>();
  let deletedCount = 0;

  for (const candidateUrl of managedCandidates) {
    const key = getCanonicalMediaKey(candidateUrl);
    if (!key || processedKeys.has(key) || activeReferenceKeys.has(key)) {
      continue;
    }
    processedKeys.add(key);
    const deleted = await deleteUploadedMedia(candidateUrl);
    if (deleted) {
      deletedCount += 1;
    }
  }

  return deletedCount;
}

export async function upsertStoreProduct(input: AdminProductInput): Promise<{
  product: AdminProductRecord;
  storage: "supabase" | "local";
}> {
  const [local, currentCatalog] = await Promise.all([
    readLocalStore(),
    getAllStoreProducts({ bypassCache: true, includeInactive: true }),
  ]);
  const category: ProductCategory = input.category?.trim() || "hijabs";
  const fabric: Fabric | null =
    category === "accessories" || !input.fabric ? null : input.fabric.trim();
  const colour: ProductColour = input.colour?.trim() || "rose";
  const normalizedInputName = input.name.trim().toLowerCase();

  // Standard E-commerce Duplicate Guard:
  // 1. If editing by explicit ID, find that product.
  // 2. If creating a new product, check if an identical product (same Name + Category + Fabric + Colour, or same custom SKU) already exists.
  //    If so, merge into that existing product instead of creating a duplicate inventory row.
  // 3. If a product with the same slug/name exists but has a DIFFERENT colour/fabric, disambiguate the slug (`${baseSlug}-${colour}`).
  const searchPool = [...local.products, ...currentCatalog];
  let existing = input.id?.trim()
    ? searchPool.find((item) => item.id === input.id?.trim())
    : searchPool.find(
        (item) =>
          (input.sku?.trim() && item.sku.toLowerCase() === input.sku.trim().toLowerCase()) ||
          (item.name.trim().toLowerCase() === normalizedInputName &&
            item.category === category &&
            (item.fabric ?? null) === fabric &&
            item.colour === colour),
      );

  const baseSlug = slugifyProductName(input.id || input.name) || `hijab-${Date.now()}`;
  let id = existing?.id || input.id?.trim() || baseSlug;

  if (!existing && !input.id?.trim()) {
    const slugCollision = searchPool.find((item) => item.id === id);
    if (slugCollision) {
      // Same base slug but different colour/fabric -> append colour to create a distinct product slug
      id = `${baseSlug}-${slugifyProductName(colour)}`;
      if (searchPool.some((item) => item.id === id)) {
        id = `${id}-${Date.now().toString().slice(-3)}`;
      }
    }
  }
  existing = existing ?? searchPool.find((item) => item.id === id);
  const previousMediaUrls = collectProductMediaUrls(existing);
  const previousPrimarySrc = existing?.photo?.src;

  const photo: Photo = {
    src: input.imageSrc.trim(),
    alt: input.imageAlt.trim() || input.name.trim(),
    colour,
    ...(input.imagePosition ? { position: input.imagePosition } : {}),
  };

  const price = Math.max(0, Number(input.price));
  const originalPrice =
    input.originalPrice && Number(input.originalPrice) > price
      ? Number(input.originalPrice)
      : undefined;
  const costPrice =
    input.costPrice !== undefined && input.costPrice !== null && String(input.costPrice) !== ""
      ? Math.max(0, Number(input.costPrice))
      : existing?.costPrice ?? null;

  const baseDetails = createDemoDetails({
    id,
    category,
    fabric,
    colour,
    photo,
  });

  const description = input.description.trim() || baseDetails.description;
  const material = input.material?.trim() || baseDetails.material;
  const size = input.size?.trim() || baseDetails.size;
  const deliveryNote =
    input.deliveryNote?.trim() ||
    "Delivery within 1–3 business days inside Dhaka and 3–5 days nationwide.";

  const baseVariants = existing?.details.variants ?? baseDetails.variants;
  const primaryStock = Math.max(0, Math.round(Number(input.stock ?? 10)));

  const userGallery: Photo[] =
    Array.isArray(input.galleryImages) && input.galleryImages.length > 0
      ? input.galleryImages.filter(
          (p) => p && typeof p.src === "string" && p.src.trim().length > 0,
        )
      : [];

  // Group photos by their assigned colour variant
  const photosByColour = new Map<ProductColour, Photo[]>();
  photosByColour.set(colour, [photo]);

  for (const p of userGallery) {
    const assignedCol = (p.colour?.trim() || colour) as ProductColour;
    const currentList = photosByColour.get(assignedCol) ?? [];
    if (!currentList.some((item) => item.src === p.src.trim())) {
      currentList.push({
        src: p.src.trim(),
        alt: p.alt?.trim() || `${input.name.trim()} - ${assignedCol}`,
        colour: assignedCol,
        ...(p.position ? { position: p.position } : {}),
      });
    }
    photosByColour.set(assignedCol, currentList);
  }

  const updatedVariants: [ProductVariant, ...ProductVariant[]] = (() => {
    if (photosByColour.size > 1) {
      // Multiple color variants explicitly configured by admin!
      const orderedColours: ProductColour[] = [
        colour,
        ...Array.from(photosByColour.keys()).filter((c) => c !== colour),
      ];

      return orderedColours.map((col, idx) => {
        const colPhotos = photosByColour.get(col) ?? [];
        const variantGallery: [Photo, ...Photo[]] =
          colPhotos.length > 0
            ? (colPhotos as [Photo, ...Photo[]])
            : ([photo] as [Photo, ...Photo[]]);

        const existingVar = existing?.details.variants.find((v) => v.colour === col);
        const customStock = input.variantStocks?.[col];
        const resolvedStock =
          customStock !== undefined
            ? Math.max(0, Math.round(Number(customStock)))
            : existingVar?.stock !== undefined
            ? existingVar.stock
            : primaryStock;

        return {
          colour: col,
          stock: resolvedStock,
          gallery: variantGallery,
          ...(idx === 0
            ? {
                customCategory: category,
                customFabric: fabric,
                customColour: col,
              }
            : {}),
        };
      }) as [ProductVariant, ...ProductVariant[]];
    }

    // Single colour assigned: update primary variant gallery, preserve other baseVariants
    const primaryGallery: [Photo, ...Photo[]] = (() => {
      const colPhotos = photosByColour.get(colour) ?? [];
      if (colPhotos.length > 0) return colPhotos as [Photo, ...Photo[]];
      const filtered =
        baseVariants[0]?.gallery?.filter(
          (p) => p.src !== photo.src && p.src !== previousPrimarySrc,
        ) ?? [];
      return [photo, ...filtered];
    })();

    return baseVariants.map((v, idx) => {
      const customVariantStock = input.variantStocks?.[v.colour];
      if (customVariantStock !== undefined) {
        return {
          ...v,
          ...(idx === 0
            ? {
                customCategory: category,
                customFabric: fabric,
                customColour: colour,
              }
            : {}),
          stock: Math.max(0, Math.round(Number(customVariantStock))),
          gallery: idx === 0 ? primaryGallery : v.gallery,
        };
      }
      if (idx === 0 || v.colour === colour) {
        return {
          ...v,
          colour: idx === 0 ? colour : v.colour,
          ...(idx === 0
            ? {
                customCategory: category,
                customFabric: fabric,
                customColour: colour,
              }
            : {}),
          stock: primaryStock,
          gallery: primaryGallery,
        };
      }
      return v;
    }) as [ProductVariant, ...ProductVariant[]];
  })();

  const totalStock = input.variantStocks
    ? sumVariantStocks(updatedVariants)
    : updatedVariants.reduce((sum, v) => sum + v.stock, 0);

  const wasRestocked = existing ? totalStock > existing.stock : false;

  // Ensure SKU is unique across all other products
  const otherSkus = new Set(
    searchPool.filter((item) => item.id !== id).map((item) => item.sku.toUpperCase()),
  );
  let resolvedSku = (
    input.sku?.trim() ||
    existing?.sku ||
    generateSku({ id, category, fabric, colour }, searchPool.length)
  ).toUpperCase();
  let skuCounter = 2;
  const baseSku = resolvedSku;
  while (otherSkus.has(resolvedSku)) {
    resolvedSku = `${baseSku}-${skuCounter}`;
    skuCounter += 1;
  }

  // Merge sections if this was matched to an existing identical product when creating
  const mergedSections =
    !input.id?.trim() && existing
      ? Array.from(new Set([...existing.sections, ...input.sections]))
      : Array.from(new Set(input.sections));

  const product: AdminProductRecord = {
    id,
    slug: id,
    sku: resolvedSku,
    name: input.name.trim(),
    description,
    price,
    ...(originalPrice ? { originalPrice } : {}),
    costPrice,
    status: input.status ?? existing?.status ?? "active",
    photo,
    category,
    fabric,
    colour,
    addedAt: existing?.addedAt ?? new Date().toISOString().slice(0, 10),
    stock: totalStock,
    lowStockThreshold: Math.max(
      0,
      Math.round(Number(input.lowStockThreshold ?? existing?.lowStockThreshold ?? local.settings.lowStockThreshold)),
    ),
    lastRestockedAt: wasRestocked ? new Date().toISOString() : existing?.lastRestockedAt ?? null,
    sections: mergedSections,
    fulfillmentSource:
      input.fulfillmentSource === "supplier" ||
      (!input.fulfillmentSource && existing?.fulfillmentSource === "supplier")
        ? "supplier"
        : "in-house",
    ...(input.pickupHubId?.trim()
      ? { pickupHubId: input.pickupHubId.trim() }
      : input.fulfillmentSource
        ? {}
        : existing?.pickupHubId
          ? { pickupHubId: existing.pickupHubId }
          : {}),
    details: {
      description,
      material,
      size,
      deliveryNote,
      variants: updatedVariants,
    },
  };

  const config = getBackendConfig();
  let storage: "supabase" | "local" = "local";

  if (config.supabaseWriteConfigured) {
    try {
      const endpoint = `${config.supabaseUrl}/rest/v1/products?on_conflict=id`;
      let response = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...supabaseHeaders(true),
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify([productToRow(product)]),
      });

      if (!response.ok) {
        // Fallback to payload JSONB format if flat column upsert failed
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            ...supabaseHeaders(true),
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify([{
            id: product.id,
            slug: product.slug,
            name: product.name,
            payload: product,
            updated_at: new Date().toISOString(),
          }]),
        });
      }

      if (response.ok) {
        storage = "supabase";
      }
    } catch {
      // Fall back to local store
    }
  }

  const existingIndex = local.products.findIndex((item) => item.id === product.id);
  if (existingIndex >= 0) {
    local.products[existingIndex] = product;
    appendActivity(local, {
      type: wasRestocked ? "inventory" : "product",
      title: wasRestocked ? `Restocked ${product.name}` : `Updated ${product.name}`,
      detail: `SKU ${product.sku} · Price ৳${product.price} · Stock ${product.stock} units`,
    });
  } else {
    local.products.unshift(product);
    appendActivity(local, {
      type: "product",
      title: `Added new product: ${product.name}`,
      detail: `SKU ${product.sku} · Price ৳${product.price} · Initial stock ${product.stock}`,
    });
  }
  await writeLocalStore(local);
  await persistActivitiesToSupabase(local.activities);

  // Ensure product's category, fabric, and colour exist in store taxonomy so Shop filters & Categories stay in sync
  try {
    const currentSettings = await getStoreSettings();
    const tax = currentSettings.taxonomy ?? DEFAULT_CATALOG_TAXONOMY;
    let taxonomyChanged = false;
    const nextCategories = [...tax.categories];
    const nextFabrics = [...tax.fabrics];
    const nextColours = [...tax.colours];

    const toLabel = (val: string) =>
      val
        .split("-")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

    if (category && !nextCategories.some((c) => c.value === category)) {
      nextCategories.push({
        value: category,
        label: toLabel(category),
        hasFabric: Boolean(fabric),
        imageSrc: photo.src,
        imageAlt: `${toLabel(category)} collection`,
      });
      taxonomyChanged = true;
    }
    if (fabric && !nextFabrics.some((f) => f.value === fabric)) {
      nextFabrics.push({
        value: fabric,
        label: toLabel(fabric),
        imageSrc: photo.src,
        imageAlt: `${toLabel(fabric)} hijabs`,
      });
      taxonomyChanged = true;
    }
    if (colour && !nextColours.some((c) => c.value === colour)) {
      nextColours.push({
        value: colour,
        label: toLabel(colour),
        swatch: "#5a6b7c",
      });
      taxonomyChanged = true;
    }

    if (taxonomyChanged) {
      await updateStoreSettings({
        taxonomy: {
          categories: nextCategories,
          fabrics: nextFabrics,
          colours: nextColours,
        },
      });
    }
  } catch {
    // Non-fatal taxonomy auto-registration
  }

  // Smart Auto-Cleanup: Delete any replaced product image from Cloudinary / local uploads if no longer referenced
  void cleanupUnusedMediaUrls(previousMediaUrls);

  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/cart");
  revalidatePath("/saved");
  revalidatePath("/checkout");
  revalidatePath(`/products/${product.slug}`);

  return { product, storage };
}

export async function updateVariantInventory(input: {
  productId: string;
  colour: ProductColour;
  stock: number;
  costPrice?: number | null;
  lowStockThreshold?: number;
}): Promise<{ product: AdminProductRecord; storage: "supabase" | "local" }> {
  const [local, currentCatalog] = await Promise.all([
    readLocalStore(),
    getAllStoreProducts({ bypassCache: true, includeInactive: true }),
  ]);
  const existing =
    currentCatalog.find((item) => item.id === input.productId) ??
    local.products.find((item) => item.id === input.productId);
  if (!existing) {
    throw new Error(`Product not found: ${input.productId}`);
  }

  const nextStock = Math.max(0, Math.round(Number(input.stock)));
  const updatedVariants = existing.details.variants.map((variant) =>
    variant.colour === input.colour ? { ...variant, stock: nextStock } : variant,
  ) as [ProductVariant, ...ProductVariant[]];

  const totalStock = sumVariantStocks(updatedVariants);
  const wasRestocked = totalStock > existing.stock;

  const updated: AdminProductRecord = {
    ...existing,
    stock: totalStock,
    ...(input.costPrice !== undefined ? { costPrice: input.costPrice } : {}),
    ...(input.lowStockThreshold !== undefined
      ? { lowStockThreshold: Math.max(0, Math.round(input.lowStockThreshold)) }
      : {}),
    lastRestockedAt: wasRestocked ? new Date().toISOString() : existing.lastRestockedAt,
    details: {
      ...existing.details,
      variants: updatedVariants,
    },
  };

  const config = getBackendConfig();
  let storage: "supabase" | "local" = "local";

  if (config.supabaseWriteConfigured) {
    try {
      const rowPayload = productToRow(updated);
      const endpoint = `${config.supabaseUrl}/rest/v1/products?id=eq.${encodeURIComponent(updated.id)}`;
      let response = await fetch(endpoint, {
        method: "PATCH",
        headers: supabaseHeaders(true),
        body: JSON.stringify({
          stock: updated.stock,
          cost_price: updated.costPrice,
          low_stock_threshold: updated.lowStockThreshold,
          variants: rowPayload.variants,
          last_restocked_at: updated.lastRestockedAt,
        }),
      });
      if (!response.ok) {
        let nextPayload: Record<string, unknown> = { ...updated };
        const existingRes = await fetch(
          `${config.supabaseUrl}/rest/v1/products?select=id,slug,name,payload&id=eq.${encodeURIComponent(updated.id)}&limit=1`,
          { headers: supabaseHeaders(true), cache: "no-store" },
        );
        if (existingRes.ok) {
          const rows = (await existingRes.json()) as Array<{ payload?: Record<string, unknown> }>;
          if (rows[0]?.payload && typeof rows[0].payload === "object") {
            const p = { ...rows[0].payload };
            const existingDetails =
              p.details && typeof p.details === "object"
                ? { ...(p.details as Record<string, unknown>) }
                : { ...updated.details };
            existingDetails.variants = updated.details.variants;
            nextPayload = {
              ...p,
              stock: updated.stock,
              costPrice: updated.costPrice,
              lowStockThreshold: updated.lowStockThreshold,
              lastRestockedAt: updated.lastRestockedAt,
              details: existingDetails,
              ...(Array.isArray(p.variants) ? { variants: updated.details.variants } : {}),
            };
          }
        }
        response = await fetch(endpoint, {
          method: "PATCH",
          headers: supabaseHeaders(true),
          body: JSON.stringify({
            slug: updated.slug,
            name: updated.name,
            payload: nextPayload,
            updated_at: new Date().toISOString(),
          }),
        });
      }
      if (response.ok) storage = "supabase";
    } catch {
      // Keep local sync
    }
  }

  const idx = local.products.findIndex((item) => item.id === updated.id);
  if (idx >= 0) local.products[idx] = updated;
  else local.products.unshift(updated);
  appendActivity(local, {
    type: "inventory",
    title: `Variant stock updated: ${updated.name} (${input.colour})`,
    detail: `Variant stock set to ${nextStock} units · Total product stock: ${updated.stock}`,
  });
  await writeLocalStore(local);
  await persistActivitiesToSupabase(local.activities);

  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/cart");
  revalidatePath("/saved");
  revalidatePath("/checkout");
  revalidatePath(`/products/${updated.slug}`);

  return { product: updated, storage };
}

export async function deleteStoreProduct(id: string): Promise<{ storage: "supabase" | "local" }> {
  const [local, currentCatalog] = await Promise.all([
    readLocalStore(),
    getAllStoreProducts({ bypassCache: true, includeInactive: true }),
  ]);
  const removedFromLocal = local.products.find((item) => item.id === id);
  const removedFromCatalog = currentCatalog.find((item) => item.id === id);
  const removed = removedFromLocal ?? removedFromCatalog;
  const removedMediaUrls = collectProductMediaUrls(removed);

  const config = getBackendConfig();
  let storage: "supabase" | "local" = "local";

  if (config.supabaseWriteConfigured) {
    const endpoint = `${config.supabaseUrl}/rest/v1/products?id=eq.${encodeURIComponent(id)}`;
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: supabaseHeaders(true),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Supabase delete failed: ${errText}`);
    }
    storage = "supabase";
  }

  local.products = local.products.filter((item) => item.id !== id);
  if (removed) {
    appendActivity(local, {
      type: "product",
      title: `Removed product: ${removed.name}`,
      detail: `SKU ${removed.sku} was deleted from catalog`,
    });
  }
  await writeLocalStore(local);
  if (removed) {
    await persistActivitiesToSupabase(local.activities);
  }

  // Smart Auto-Cleanup: Delete removed product's images from Cloudinary / local uploads if not used elsewhere
  void cleanupUnusedMediaUrls(removedMediaUrls);

  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/cart");
  revalidatePath("/saved");
  revalidatePath("/checkout");

  return { storage };
}

export async function seedSupabaseCatalog(): Promise<{ count: number }> {
  const config = getBackendConfig();
  if (!config.supabaseWriteConfigured) {
    throw new Error(
      "Supabase keys (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) are not configured in .env.local yet.",
    );
  }

  const local = await readLocalStore();
  const rows = local.products.map(productToRow);

  const endpoint = `${config.supabaseUrl}/rest/v1/products?on_conflict=id`;
  let response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...supabaseHeaders(true),
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const nowIso = new Date().toISOString();
    const jsonbRows = local.products.map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      payload: product,
      updated_at: nowIso,
    }));
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...supabaseHeaders(true),
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(jsonbRows),
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Supabase seed failed: ${errText}`);
  }

  invalidateStoreMemoryCache();
  revalidatePath("/");
  revalidatePath("/shop");

  return { count: rows.length };
}

function parseSupabaseOrderRow(row: SupabaseOrderRow | Record<string, unknown>): AdminOrderRecord {
  const rowObj = row as Record<string, unknown>;
  if (rowObj?.payload && typeof rowObj.payload === "object" && rowObj.payload !== null) {
    const p = rowObj.payload as Record<string, unknown>;
    const cust = (p.customer as Record<string, unknown>) || {};
    return normalizeOrderRecord({
      id: String(rowObj.id || p.id),
      createdAt: String(rowObj.created_at || p.createdAt || new Date().toISOString()),
      updatedAt: String(
        rowObj.updated_at || p.updatedAt || rowObj.created_at || p.createdAt || new Date().toISOString(),
      ),
      customer: {
        name: String(cust.name || p.customer_name || "Customer"),
        phone: String(cust.phone || p.customer_phone || ""),
        ...((cust.email || p.customer_email) ? { email: String(cust.email || p.customer_email) } : {}),
        address: String(cust.address || p.customer_address || ""),
        city: String(cust.city || p.customer_city || ""),
        ...((cust.notes || p.customer_notes) ? { notes: String(cust.notes || p.customer_notes) } : {}),
      },
      deliveryZone: (p.deliveryZone || p.delivery_zone || "inside-dhaka") as OrderDeliveryZone,
      paymentMethod: (p.paymentMethod || p.payment_method || "cod") as OrderPaymentMethod,
      ...((p.paymentPhone || p.payment_phone) ? { paymentPhone: String(p.paymentPhone || p.payment_phone) } : {}),
      ...((p.paymentTrxId || p.payment_trx_id || p.transactionId || p.trxId)
        ? { paymentTrxId: String(p.paymentTrxId || p.payment_trx_id || p.transactionId || p.trxId) }
        : {}),
      items: Array.isArray(p.items) ? (p.items as Order["items"]) : [],
      subtotal: Number(p.subtotal || 0),
      discountAmount: Number(p.discountAmount || p.discount_amount || p.discount || 0),
      couponCode: p.couponCode ? String(p.couponCode) : p.coupon_code ? String(p.coupon_code) : null,
      shippingFee: Number(p.shippingFee || p.shipping_fee || 0),
      taxAmount: Number(p.taxAmount || p.tax_amount || 0),
      refundAmount: Number(p.refundAmount || p.refund_amount || 0),
      total: Number(p.total || 0),
      status: (p.status || "Pending") as Order["status"],
      paymentStatus: (p.paymentStatus || p.payment_status || undefined) as AdminPaymentStatus | undefined,
      deliveryStatus: (p.deliveryStatus || p.delivery_status || undefined) as AdminDeliveryStatus | undefined,
      ...(p.courierProvider
        ? { courierProvider: p.courierProvider as Order["courierProvider"] }
        : {}),
      ...(p.courierTrackingCode
        ? { courierTrackingCode: String(p.courierTrackingCode) }
        : {}),
      ...(p.courierConsignmentId
        ? { courierConsignmentId: String(p.courierConsignmentId) }
        : {}),
      ...(p.courierRawStatus ? { courierRawStatus: String(p.courierRawStatus) } : {}),
      ...(p.courierTrackingMessage
        ? { courierTrackingMessage: String(p.courierTrackingMessage) }
        : {}),
      ...(Array.isArray(p.shipments) ? { shipments: p.shipments as OrderShipment[] } : {}),
    });
  }

  const flatRow = row as SupabaseOrderRow;
  return normalizeOrderRecord({
    id: flatRow.id,
    createdAt: flatRow.created_at,
    updatedAt: flatRow.updated_at ?? flatRow.created_at,
    customer: {
      name: flatRow.customer_name,
      phone: flatRow.customer_phone,
      ...(flatRow.customer_email ? { email: flatRow.customer_email } : {}),
      address: flatRow.customer_address,
      city: flatRow.customer_city,
      ...(flatRow.customer_notes ? { notes: flatRow.customer_notes } : {}),
    },
    deliveryZone: flatRow.delivery_zone,
    paymentMethod: flatRow.payment_method,
    ...(flatRow.payment_phone ? { paymentPhone: flatRow.payment_phone } : {}),
    ...(flatRow.payment_trx_id ? { paymentTrxId: flatRow.payment_trx_id } : {}),
    items: flatRow.items,
    subtotal: Number(flatRow.subtotal),
    discountAmount: Number(flatRow.discount_amount ?? 0),
    couponCode: flatRow.coupon_code ?? null,
    shippingFee: Number(flatRow.shipping_fee),
    taxAmount: Number(flatRow.tax_amount ?? 0),
    refundAmount: Number(flatRow.refund_amount ?? 0),
    total: Number(flatRow.total),
    status: flatRow.status as Order["status"],
    paymentStatus: flatRow.payment_status ?? undefined,
    deliveryStatus: flatRow.delivery_status ?? undefined,
  });
}

export async function getAllStoreOrders(): Promise<AdminOrderRecord[]> {
  const config = getBackendConfig();

  if (config.supabaseWriteConfigured) {
    try {
      const endpoint = `${config.supabaseUrl}/rest/v1/orders?select=*&order=created_at.desc`;
      const response = await fetch(endpoint, {
        headers: supabaseHeaders(true),
        cache: "no-store",
      });
      if (response.ok) {
        const rows = (await response.json()) as (SupabaseOrderRow | Record<string, unknown>)[];
        return rows.map((row) => parseSupabaseOrderRow(row));
      }
    } catch {
      // Fallback to local store
    }
  }

  const local = await readLocalStore();
  return local.orders;
}

function normalizePhoneForMatch(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  // Match last 11 digits for BD numbers (e.g. +88017... vs 017...)
  return digits.length > 11 ? digits.slice(-11) : digits;
}

export async function getStoreOrdersByIds(ids: string[]): Promise<AdminOrderRecord[]> {
  if (!ids || ids.length === 0) return [];
  const allOrders = await getAllStoreOrders();
  const idSet = new Set(ids);
  return allOrders.filter((order) => idSet.has(order.id));
}

export async function getStoreOrdersByCustomer(query: {
  ids?: string[];
  phone?: string | null;
  email?: string | null;
}): Promise<AdminOrderRecord[]> {
  const idSet = new Set((query.ids ?? []).map((id) => id.trim()).filter(Boolean));
  const cleanPhone = normalizePhoneForMatch(query.phone);
  const cleanEmail = query.email?.trim().toLowerCase() || "";

  if (idSet.size === 0 && !cleanPhone && !cleanEmail) {
    return [];
  }

  const allOrders = await getAllStoreOrders();
  return allOrders.filter((order) => {
    if (idSet.has(order.id)) return true;
    if (cleanPhone && normalizePhoneForMatch(order.customer.phone) === cleanPhone) return true;
    if (cleanEmail && order.customer.email?.trim().toLowerCase() === cleanEmail) return true;
    return false;
  });
}

const SYSTEM_SETTINGS_ROW_ID = "__system_store_settings__";
const SYSTEM_SETTINGS_CODE = "__SYSTEM_SETTINGS__";
const SYSTEM_CUSTOMERS_ROW_ID = "__system_customers_registry__";
const SYSTEM_CUSTOMERS_CODE = "__SYSTEM_CUSTOMERS__";
const SYSTEM_CONTACT_MESSAGES_ROW_ID = "__system_contact_messages__";
const SYSTEM_CONTACT_MESSAGES_CODE = "__SYSTEM_CONTACT_MESSAGES__";
const SYSTEM_REVIEWS_ROW_ID = "__system_reviews_registry__";
const SYSTEM_REVIEWS_CODE = "__SYSTEM_REVIEWS__";

const STORE_SETTINGS_DEFAULT_ID = "default";
const STORE_SETTINGS_COUPONS_ID = "__system_coupons__";
const STORE_SETTINGS_REVIEWS_ID = "__system_reviews__";
const STORE_SETTINGS_MESSAGES_ID = "__system_contact_messages__";
const STORE_SETTINGS_ACTIVITIES_ID = "__system_activities__";
const STORE_SETTINGS_CUSTOMERS_ID = "__system_customers__";

async function readStoreSettingsDoc<T>(
  docId: string,
  options?: { revalidate?: number; timeoutMs?: number },
): Promise<T | null> {
  const config = getBackendConfig();
  if (!config.supabaseConfigured) return null;
  try {
    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/store_settings?select=payload&id=eq.${encodeURIComponent(docId)}&limit=1`,
      {
        headers: supabaseHeaders(true),
        ...(options?.revalidate
          ? { next: { revalidate: options.revalidate } }
          : { cache: "no-store" as const }),
        signal: AbortSignal.timeout(options?.timeoutMs ?? 3000),
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ payload?: T }>;
    if (rows[0]?.payload !== undefined && rows[0]?.payload !== null) {
      return rows[0].payload;
    }
  } catch {
    // Fall back gracefully
  }
  return null;
}

async function writeStoreSettingsDoc(docId: string, payload: unknown): Promise<boolean> {
  const config = getBackendConfig();
  if (!config.supabaseWriteConfigured) return false;
  try {
    const res = await fetch(`${config.supabaseUrl}/rest/v1/store_settings?on_conflict=id`, {
      method: "POST",
      headers: {
        ...supabaseHeaders(true),
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([
        {
          id: docId,
          payload,
          updated_at: new Date().toISOString(),
        },
      ]),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function persistActivitiesToSupabase(activities: AdminActivityRecord[]): Promise<void> {
  await writeStoreSettingsDoc(STORE_SETTINGS_ACTIVITIES_ID, {
    items: activities.slice(0, 60),
  });
}

function isSystemCouponRow(row: { id: string; code: string }): boolean {
  return (
    row.id === SYSTEM_SETTINGS_ROW_ID ||
    row.code === SYSTEM_SETTINGS_CODE ||
    row.id === SYSTEM_CUSTOMERS_ROW_ID ||
    row.code === SYSTEM_CUSTOMERS_CODE ||
    row.id === SYSTEM_CONTACT_MESSAGES_ROW_ID ||
    row.code === SYSTEM_CONTACT_MESSAGES_CODE ||
    row.id === SYSTEM_REVIEWS_ROW_ID ||
    row.code === SYSTEM_REVIEWS_CODE ||
    row.id.startsWith("__system_") ||
    row.code.startsWith("__SYSTEM_")
  );
}

function isActiveOrderInventoryState(status: string): boolean {
  return status !== "Cancelled" && status !== "Returned";
}

async function validateOrderStock(items: Order["items"]): Promise<void> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Your order must contain at least one item.");
  }
  const allProducts = await getAllStoreProducts({ bypassCache: true, includeInactive: true });
  for (const item of items) {
    const qty = Math.max(1, Math.round(Number(item.quantity ?? 1)));
    const prod = allProducts.find((p) => p.id === item.id || p.slug === item.slug);
    if (!prod) continue;
    if (prod.status === "inactive") {
      throw new Error(`Sorry, "${prod.name}" is currently unavailable.`);
    }
    const available = Math.max(0, Number(prod.stock ?? 0));
    if (available <= 0) {
      throw new Error(`Sorry, "${prod.name}" is currently out of stock (স্টক শেষ).`);
    }
    if (qty > available) {
      throw new Error(
        `Sorry, only ${available} unit(s) of "${prod.name}" are available in stock.`,
      );
    }
  }
}

async function adjustCatalogStockForOrderItems(
  local: LocalRuntimeStore,
  items: Order["items"],
  direction: -1 | 1,
): Promise<void> {
  if (!Array.isArray(items) || items.length === 0) return;
  const config = getBackendConfig();

  for (const item of items) {
    const qty = Math.max(0, Math.round(Number(item.quantity ?? 1)));
    if (qty <= 0) continue;

    // 1. Update local store product stock
    const localProd = local.products.find((p) => p.id === item.id || p.slug === item.slug);
    let nextStock: number | undefined;
    let nextVariants: ProductVariant[] | undefined;

    if (localProd) {
      localProd.stock = Math.max(0, localProd.stock + direction * qty);
      if (localProd.details.variants.length > 0) {
        const targetIdx = item.colour
          ? localProd.details.variants.findIndex((v) => v.colour === item.colour)
          : 0;
        const resolvedIdx = targetIdx >= 0 ? targetIdx : 0;
        localProd.details.variants[resolvedIdx].stock = Math.max(
          0,
          localProd.details.variants[resolvedIdx].stock + direction * qty,
        );
      }
      nextStock = localProd.stock;
      nextVariants = localProd.details.variants;
    }

    // 2. Sync stock adjustment to Supabase products table
    if (config.supabaseWriteConfigured) {
      try {
        const checkRes = await fetch(
          `${config.supabaseUrl}/rest/v1/products?select=id,stock,variants&id=eq.${encodeURIComponent(item.id)}&limit=1`,
          {
            headers: supabaseHeaders(true),
            cache: "no-store",
          },
        );
        if (checkRes.ok) {
          const rows = (await checkRes.json()) as Array<{
            id: string;
            stock: number;
            variants?: ProductVariant[];
          }>;
          const flatStock =
            nextStock ??
            (rows[0] ? Math.max(0, Number(rows[0].stock ?? 0) + direction * qty) : undefined);
          let flatVariants = nextVariants;
          if (!flatVariants && rows[0] && Array.isArray(rows[0].variants) && rows[0].variants.length > 0) {
            const targetIdx = item.colour
              ? rows[0].variants.findIndex((v) => v.colour === item.colour)
              : 0;
            const resolvedIdx = targetIdx >= 0 ? targetIdx : 0;
            flatVariants = rows[0].variants.map((v, idx) =>
              idx === resolvedIdx
                ? { ...v, stock: Math.max(0, Number(v.stock ?? 0) + direction * qty) }
                : v,
            );
          }

          if (flatStock !== undefined) {
            await fetch(
              `${config.supabaseUrl}/rest/v1/products?id=eq.${encodeURIComponent(item.id)}`,
              {
                method: "PATCH",
                headers: supabaseHeaders(true),
                body: JSON.stringify({
                  stock: flatStock,
                  ...(flatVariants ? { variants: flatVariants } : {}),
                }),
              },
            );
          }
        } else {
          // JSONB payload schema fallback (match by id, then by slug)
          let rowRes = await fetch(
            `${config.supabaseUrl}/rest/v1/products?select=id,slug,name,payload&id=eq.${encodeURIComponent(item.id)}&limit=1`,
            { headers: supabaseHeaders(true), cache: "no-store" },
          );
          let rows = rowRes.ok
            ? ((await rowRes.json()) as Array<{
                id: string;
                slug: string;
                name: string;
                payload?: Record<string, unknown>;
              }>)
            : [];
          if (rows.length === 0 && item.slug) {
            rowRes = await fetch(
              `${config.supabaseUrl}/rest/v1/products?select=id,slug,name,payload&slug=eq.${encodeURIComponent(item.slug)}&limit=1`,
              { headers: supabaseHeaders(true), cache: "no-store" },
            );
            rows = rowRes.ok
              ? ((await rowRes.json()) as Array<{
                  id: string;
                  slug: string;
                  name: string;
                  payload?: Record<string, unknown>;
                }>)
              : [];
          }

          if (rows[0]?.payload && typeof rows[0].payload === "object") {
            const currentPayload = { ...rows[0].payload };
            const currentDetails =
              currentPayload.details && typeof currentPayload.details === "object"
                ? { ...(currentPayload.details as Record<string, unknown>) }
                : null;
            const sourceVariants = Array.isArray(currentDetails?.variants)
              ? (currentDetails.variants as ProductVariant[])
              : Array.isArray(currentPayload.variants)
                ? (currentPayload.variants as ProductVariant[])
                : null;

            let patchedVariants: ProductVariant[] | undefined = nextVariants;
            if (sourceVariants && sourceVariants.length > 0) {
              const targetIdx = item.colour
                ? sourceVariants.findIndex((v) => v.colour === item.colour)
                : 0;
              const resolvedIdx = targetIdx >= 0 ? targetIdx : 0;
              patchedVariants = sourceVariants.map((v, idx) =>
                idx === resolvedIdx
                  ? { ...v, stock: Math.max(0, Number(v.stock ?? 0) + direction * qty) }
                  : v,
              );
            }

            const patchedStock =
              nextStock ?? Math.max(0, Number(currentPayload.stock ?? 0) + direction * qty);

            const nextPayload: Record<string, unknown> = {
              ...currentPayload,
              stock: patchedStock,
            };
            if (currentDetails && patchedVariants) {
              nextPayload.details = { ...currentDetails, variants: patchedVariants };
            } else if (Array.isArray(currentPayload.variants) && patchedVariants) {
              nextPayload.variants = patchedVariants;
            }

            await fetch(
              `${config.supabaseUrl}/rest/v1/products?id=eq.${encodeURIComponent(rows[0].id)}`,
              {
                method: "PATCH",
                headers: supabaseHeaders(true),
                body: JSON.stringify({
                  payload: nextPayload,
                  updated_at: new Date().toISOString(),
                }),
              },
            );
          }
        }
      } catch {
        // Keep local stock update
      }
    }
  }
}

async function incrementCouponUsage(
  local: LocalRuntimeStore,
  couponCode?: string | null,
): Promise<void> {
  if (!couponCode) return;
  const normalizedCode = couponCode.trim().toUpperCase();
  if (!normalizedCode) return;

  const localCoupon = local.coupons.find((c) => c.code === normalizedCode);
  if (localCoupon) {
    localCoupon.usageCount = Math.max(0, (localCoupon.usageCount ?? 0) + 1);
  }

  const config = getBackendConfig();
  if (config.supabaseWriteConfigured) {
    try {
      const checkRes = await fetch(
        `${config.supabaseUrl}/rest/v1/coupons?select=id,usage_count&code=eq.${encodeURIComponent(normalizedCode)}&limit=1`,
        {
          headers: supabaseHeaders(true),
          cache: "no-store",
        },
      );
      if (checkRes.ok) {
        const rows = (await checkRes.json()) as Array<{ id: string; usage_count: number }>;
        if (rows[0]) {
          const nextUsage = Math.max(0, Number(rows[0].usage_count ?? 0) + 1);
          await fetch(
            `${config.supabaseUrl}/rest/v1/coupons?id=eq.${encodeURIComponent(rows[0].id)}`,
            {
              method: "PATCH",
              headers: supabaseHeaders(true),
              body: JSON.stringify({ usage_count: nextUsage }),
            },
          );
        }
      } else {
        const doc = await readStoreSettingsDoc<{ items?: AdminCouponRecord[] }>(
          STORE_SETTINGS_COUPONS_ID,
        );
        if (doc && Array.isArray(doc.items)) {
          const updated = doc.items.map((c) =>
            c.code === normalizedCode
              ? { ...c, usageCount: Math.max(0, (c.usageCount ?? 0) + 1) }
              : c,
          );
          await writeStoreSettingsDoc(STORE_SETTINGS_COUPONS_ID, { items: updated });
        }
      }
    } catch {
      // Keep local usage count
    }
  }
}

export async function recordCustomerOrder(
  order: Order & Partial<Pick<AdminOrderRecord, "discountAmount" | "couponCode" | "paymentStatus" | "deliveryStatus">>,
): Promise<{ storage: "supabase" | "local"; order: AdminOrderRecord }> {
  const [allProducts, settings] = await Promise.all([
    getAllStoreProducts({ bypassCache: true, includeInactive: true }),
    getStoreSettings({ bypassCache: true }),
  ]);

  const enrichedItems: OrderItem[] = (Array.isArray(order.items) ? order.items : []).map((item) => {
    const matchedProduct = allProducts.find((p) => p.id === item.id || p.slug === item.slug);
    const fulfillmentSource: FulfillmentSource =
      item.fulfillmentSource === "supplier" || matchedProduct?.fulfillmentSource === "supplier"
        ? "supplier"
        : "in-house";
    const pickupHubId = item.pickupHubId?.trim() || matchedProduct?.pickupHubId?.trim() || undefined;
    const hub = resolvePickupHubForSource(
      settings.courier?.pickupHubs,
      fulfillmentSource,
      pickupHubId,
      settings.courier,
    );
    return {
      ...item,
      fulfillmentSource,
      pickupHubId: hub.id,
      pickupHubName: hub.name,
    };
  });

  const preliminary = normalizeOrderRecord({
    ...order,
    items: enrichedItems,
  });
  const initialShipments =
    preliminary.shipments && preliminary.shipments.length > 0
      ? preliminary.shipments
      : buildOrderShipments(preliminary, settings.courier);
  const normalized: AdminOrderRecord = {
    ...preliminary,
    ...(initialShipments.length > 0 ? { shipments: initialShipments } : {}),
  };

  await validateOrderStock(normalized.items);
  const config = getBackendConfig();
  let storage: "supabase" | "local" = "local";

  if (config.supabaseConfigured) {
    try {
      const row: SupabaseOrderRow = {
        id: normalized.id,
        customer_name: normalized.customer.name,
        customer_phone: normalized.customer.phone,
        customer_email: normalized.customer.email ?? null,
        customer_address: normalized.customer.address,
        customer_city: normalized.customer.city,
        customer_notes: normalized.customer.notes ?? null,
        delivery_zone: normalized.deliveryZone,
        payment_method: normalized.paymentMethod,
        payment_phone: normalized.paymentPhone ?? null,
        payment_trx_id: normalized.paymentTrxId ?? null,
        payment_status: normalized.paymentStatus,
        delivery_status: normalized.deliveryStatus,
        items: normalized.items,
        subtotal: normalized.subtotal,
        discount_amount: normalized.discountAmount,
        coupon_code: normalized.couponCode ?? null,
        shipping_fee: normalized.shippingFee,
        tax_amount: normalized.taxAmount,
        refund_amount: normalized.refundAmount,
        total: normalized.total,
        status: normalized.status,
        created_at: normalized.createdAt,
      };
      const endpoint = `${config.supabaseUrl}/rest/v1/orders`;
      let response = await fetch(endpoint, {
        method: "POST",
        headers: supabaseHeaders(true),
        body: JSON.stringify([row]),
      });
      if (!response.ok) {
        // Fallback to payload JSONB format if flat column insert failed
        response = await fetch(endpoint, {
          method: "POST",
          headers: supabaseHeaders(true),
          body: JSON.stringify([{
            id: normalized.id,
            payload: normalized,
            created_at: normalized.createdAt,
          }]),
        });
      }
      if (response.ok) {
        storage = "supabase";
      }
    } catch {
      // Fallback to local runtime store
    }
  }

  const local = await readLocalStore();
  if (!local.orders.some((existing) => existing.id === normalized.id)) {
    local.orders.unshift(normalized);

    // Deduct stock in both local store and Supabase products table
    await adjustCatalogStockForOrderItems(local, normalized.items, -1);

    // Increment coupon usage count if a coupon was applied
    if (normalized.couponCode) {
      await incrementCouponUsage(local, normalized.couponCode);
    }

    appendActivity(local, {
      type: "order",
      title: `New order ${normalized.id} from ${normalized.customer.name}`,
      detail: `${normalized.items.length} item(s) · Total ৳${normalized.total} via ${normalized.paymentMethod.toUpperCase()}`,
    });
    await writeLocalStore(local);
    await persistActivitiesToSupabase(local.activities);
  }

  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/cart");
  revalidatePath("/checkout");

  return { storage, order: normalized };
}

export async function updateStoreOrder(input: {
  id: string;
  status?: AdminOrderStatus;
  paymentStatus?: AdminPaymentStatus;
  deliveryStatus?: AdminDeliveryStatus;
  refundAmount?: number;
  courierProvider?: "steadfast" | "pathao" | "manual";
  courierTrackingCode?: string;
  courierConsignmentId?: string;
  courierRawStatus?: string;
  courierTrackingMessage?: string;
  shipments?: OrderShipment[];
  reconcileFromShipments?: boolean;
}): Promise<{ storage: "supabase" | "local"; order: AdminOrderRecord | null }> {
  const config = getBackendConfig();
  const local = await readLocalStore();
  let target = local.orders.find((order) => order.id === input.id);

  if (config.supabaseWriteConfigured) {
    try {
      const lookupRes = await fetch(
        `${config.supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(input.id)}&select=*&limit=1`,
        {
          headers: supabaseHeaders(true),
          cache: "no-store",
        },
      );
      if (lookupRes.ok) {
        const rows = (await lookupRes.json()) as (SupabaseOrderRow | Record<string, unknown>)[];
        if (rows[0]) {
          const remoteOrder = parseSupabaseOrderRow(rows[0]);
          const localIdx = local.orders.findIndex((order) => order.id === input.id);
          if (localIdx >= 0) {
            local.orders[localIdx] = remoteOrder;
            target = local.orders[localIdx];
          } else {
            target = { ...remoteOrder };
            local.orders.unshift(target);
          }
        }
      }
    } catch {
      // Fall back cleanly to local target
    }
  }

  const previousStatus = target?.status ?? "Pending";

  const reconciled =
    input.shipments && input.reconcileFromShipments !== false && target
      ? reconcileOrderFromShipments(
          {
            status: input.status ?? target.status,
            paymentMethod: target.paymentMethod,
            paymentStatus: input.paymentStatus ?? target.paymentStatus,
            deliveryStatus: input.deliveryStatus ?? target.deliveryStatus,
            courierProvider: input.courierProvider ?? target.courierProvider,
            courierTrackingCode: input.courierTrackingCode ?? target.courierTrackingCode,
            courierConsignmentId: input.courierConsignmentId ?? target.courierConsignmentId,
            courierRawStatus: input.courierRawStatus ?? target.courierRawStatus,
            courierTrackingMessage: input.courierTrackingMessage ?? target.courierTrackingMessage,
          },
          input.shipments,
        )
      : null;

  let derivedStatusFromDelivery: AdminOrderStatus | undefined;
  const effectiveDeliveryInput = input.deliveryStatus ?? reconciled?.deliveryStatus;
  if (!input.status && !reconciled?.status && effectiveDeliveryInput) {
    if (effectiveDeliveryInput === "Delivered") {
      derivedStatusFromDelivery = "Delivered";
    } else if (
      effectiveDeliveryInput === "In Transit" ||
      effectiveDeliveryInput === "Out for Delivery"
    ) {
      derivedStatusFromDelivery = "Shipped";
    } else if (effectiveDeliveryInput === "Returned") {
      derivedStatusFromDelivery = "Returned";
    } else if (effectiveDeliveryInput === "Cancelled") {
      derivedStatusFromDelivery = "Cancelled";
    } else if (effectiveDeliveryInput === "Pending Dispatch") {
      const currentSt = target?.status;
      derivedStatusFromDelivery =
        currentSt === "Pending" || currentSt === "Confirmed" || currentSt === "Processing"
          ? currentSt
          : "Confirmed";
    }
  }

  const nextStatus =
    input.status ??
    (reconciled?.status as AdminOrderStatus | undefined) ??
    derivedStatusFromDelivery ??
    target?.status ??
    "Pending";
  const nextRefund =
    input.refundAmount !== undefined
      ? Math.max(0, Number(input.refundAmount))
      : nextStatus === "Refunded" && target
        ? target.total
        : target?.refundAmount ?? 0;

  let nextPaymentStatus: AdminPaymentStatus;
  if (input.paymentStatus) {
    nextPaymentStatus = input.paymentStatus;
  } else if (
    nextStatus === "Refunded" ||
    (nextRefund > 0 && target && target.total > 0 && nextRefund >= target.total)
  ) {
    nextPaymentStatus = "Refunded";
  } else if (nextRefund > 0 && target && nextRefund < target.total) {
    nextPaymentStatus = "Partially Refunded";
  } else if (nextStatus === "Cancelled" && target?.paymentStatus !== "Paid") {
    nextPaymentStatus = "Failed";
  } else if (nextStatus === "Delivered" && (!target || target.paymentMethod === "cod")) {
    nextPaymentStatus = "Paid";
  } else if (reconciled?.paymentStatus) {
    nextPaymentStatus = reconciled.paymentStatus;
  } else {
    nextPaymentStatus = target?.paymentStatus ?? "Pending";
  }

  const nextDeliveryStatus =
    input.deliveryStatus ??
    reconciled?.deliveryStatus ??
    deriveDeliveryStatus(nextStatus, nextStatus === previousStatus ? target?.deliveryStatus : undefined);

  // Restore stock if order transitions from active -> Cancelled/Returned, or re-deduct if re-activated
  if (target && previousStatus !== nextStatus) {
    const wasActive = isActiveOrderInventoryState(previousStatus);
    const isNowActive = isActiveOrderInventoryState(nextStatus);
    if (wasActive && !isNowActive) {
      await adjustCatalogStockForOrderItems(local, target.items, 1);
    } else if (!wasActive && isNowActive) {
      await adjustCatalogStockForOrderItems(local, target.items, -1);
    }
  }

  if (target) {
    target.status = nextStatus;
    target.paymentStatus = nextPaymentStatus;
    target.deliveryStatus = nextDeliveryStatus;
    target.refundAmount = nextRefund;
    if (input.shipments) {
      target.shipments = input.shipments;
    } else if (
      Array.isArray(target.shipments) &&
      target.shipments.length === 1 &&
      (input.status || input.deliveryStatus)
    ) {
      target.shipments = [
        {
          ...target.shipments[0],
          deliveryStatus: nextDeliveryStatus,
          updatedAt: new Date().toISOString(),
        },
      ];
    } else if (
      Array.isArray(target.shipments) &&
      target.shipments.length > 1 &&
      (input.status === "Delivered" || input.status === "Cancelled" || input.status === "Returned")
    ) {
      const nowIso = new Date().toISOString();
      target.shipments = target.shipments.map((pkg) => ({
        ...pkg,
        deliveryStatus: nextDeliveryStatus,
        updatedAt: nowIso,
      }));
    }
    const finalProvider = input.courierProvider ?? reconciled?.courierProvider;
    const finalTracking = input.courierTrackingCode ?? reconciled?.courierTrackingCode;
    const finalConsignment = input.courierConsignmentId ?? reconciled?.courierConsignmentId;
    const finalRawStatus = input.courierRawStatus ?? reconciled?.courierRawStatus;
    const finalTrackingMsg = input.courierTrackingMessage ?? reconciled?.courierTrackingMessage;

    if (finalProvider) target.courierProvider = finalProvider;
    if (finalTracking) target.courierTrackingCode = finalTracking;
    if (finalConsignment) target.courierConsignmentId = finalConsignment;
    if (finalRawStatus) target.courierRawStatus = finalRawStatus;
    if (finalTrackingMsg) target.courierTrackingMessage = finalTrackingMsg;
    target.updatedAt = new Date().toISOString();
  }

  let storage: "supabase" | "local" = "local";

  if (config.supabaseWriteConfigured) {
    try {
      const endpoint = `${config.supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(input.id)}`;
      let response = await fetch(endpoint, {
        method: "PATCH",
        headers: supabaseHeaders(true),
        body: JSON.stringify({
          status: nextStatus,
          payment_status: nextPaymentStatus,
          delivery_status: nextDeliveryStatus,
          refund_amount: nextRefund,
        }),
      });
      if (!response.ok && target) {
        // Fallback to JSONB payload column (live DB orders table has id, payload, created_at)
        response = await fetch(endpoint, {
          method: "PATCH",
          headers: supabaseHeaders(true),
          body: JSON.stringify({
            payload: target,
          }),
        });
      }
      if (response.ok) {
        storage = "supabase";
      }
    } catch {
      // Keep local update
    }
  }

  if (target) {
    appendActivity(local, {
      type: "order",
      title: `Order ${target.id} updated`,
      detail: `Order: ${nextStatus} · Payment: ${nextPaymentStatus} · Delivery: ${nextDeliveryStatus}`,
    });
    await writeLocalStore(local);
    await persistActivitiesToSupabase(local.activities);
  }

  revalidatePath("/");
  revalidatePath("/shop");

  return { storage, order: target ?? null };
}

export async function findOrderByCourierReference(ref: {
  consignmentId?: string | number | null;
  trackingCode?: string | null;
  invoiceRef?: string | null;
}): Promise<{ order: AdminOrderRecord; matchedShipmentId?: string } | null> {
  const cleanCid = ref.consignmentId ? String(ref.consignmentId).trim() : "";
  const cleanTracking = ref.trackingCode ? String(ref.trackingCode).trim() : "";
  const cleanInvoice = ref.invoiceRef ? String(ref.invoiceRef).trim() : "";

  if (!cleanCid && !cleanTracking && !cleanInvoice) return null;

  const orders = await getAllStoreOrders();

  for (const order of orders) {
    if (Array.isArray(order.shipments) && order.shipments.length > 0) {
      const matchedPkg = order.shipments.find(
        (s) =>
          (cleanCid && s.consignmentId && String(s.consignmentId).trim() === cleanCid) ||
          (cleanTracking && s.trackingCode && String(s.trackingCode).trim() === cleanTracking) ||
          (cleanInvoice && s.invoiceRef && String(s.invoiceRef).trim() === cleanInvoice),
      );
      if (matchedPkg) {
        return { order, matchedShipmentId: matchedPkg.id };
      }
    }
  }

  for (const order of orders) {
    if (
      (cleanCid && order.courierConsignmentId && String(order.courierConsignmentId).trim() === cleanCid) ||
      (cleanTracking && order.courierTrackingCode && String(order.courierTrackingCode).trim() === cleanTracking)
    ) {
      return { order, matchedShipmentId: order.shipments?.[0]?.id };
    }
  }

  if (cleanInvoice) {
    const baseOrderId = cleanInvoice.replace(/-P\d+$/i, "");
    const direct = orders.find((o) => o.id === cleanInvoice || o.id === baseOrderId);
    if (direct) {
      const idxMatch = cleanInvoice.match(/-P(\d+)$/i);
      const pkgId = idxMatch ? `PKG-${idxMatch[1]}` : direct.shipments?.[0]?.id;
      return { order: direct, matchedShipmentId: pkgId };
    }
  }

  return null;
}

export async function updateStoreOrderStatus(
  id: string,
  status: AdminOrderStatus,
): Promise<{ storage: "supabase" | "local" }> {
  const res = await updateStoreOrder({ id, status });
  return { storage: res.storage };
}

export async function getStoreCoupons(): Promise<AdminCouponRecord[]> {
  const config = getBackendConfig();
  if (config.supabaseConfigured) {
    try {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/coupons?select=*&order=created_at.desc`,
        {
          headers: supabaseHeaders(true),
          cache: "no-store",
        },
      );
      if (res.ok) {
        const rows = (await res.json()) as Array<{
          id: string;
          code: string;
          description: string;
          discount_type: "percentage" | "fixed";
          discount_value: number;
          min_order_amount: number;
          active: boolean;
          usage_count: number;
          created_at: string;
        }>;
        if (Array.isArray(rows)) {
          const validRows = rows.filter((r) => !isSystemCouponRow(r));
          if (validRows.length > 0) {
            return validRows.map((r) => ({
              id: r.id,
              code: r.code,
              description: r.description,
              discountType: r.discount_type,
              discountValue: Number(r.discount_value),
              minOrderAmount: Number(r.min_order_amount ?? 0),
              active: Boolean(r.active),
              usageCount: Number(r.usage_count ?? 0),
              createdAt: r.created_at,
            }));
          }
        }
      } else {
        const doc = await readStoreSettingsDoc<{ items?: AdminCouponRecord[] }>(
          STORE_SETTINGS_COUPONS_ID,
        );
        if (doc && Array.isArray(doc.items)) {
          return doc.items.filter((c) => !isSystemCouponRow(c));
        }
      }
    } catch {
      // Fallback to local store
    }
  }

  const local = await readLocalStore();
  return local.coupons.filter((c) => !isSystemCouponRow(c));
}

export async function upsertStoreCoupon(input: {
  id?: string;
  code: string;
  description?: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount?: number;
  active?: boolean;
}): Promise<AdminCouponRecord> {
  const [local, existingCoupons] = await Promise.all([readLocalStore(), getStoreCoupons()]);
  const normalizedCode = input.code.trim().toUpperCase().replace(/\s+/g, "");
  const nextCoupons = [...existingCoupons];
  const existingIdx = nextCoupons.findIndex(
    (c) => c.id === input.id || c.code === normalizedCode,
  );

  const record: AdminCouponRecord = {
    id: input.id || (existingIdx >= 0 ? nextCoupons[existingIdx].id : `cpn-${Date.now()}`),
    code: normalizedCode,
    description:
      input.description?.trim() ||
      `${input.discountValue}${input.discountType === "percentage" ? "%" : " BDT"} off`,
    discountType: input.discountType,
    discountValue: Math.max(0, Number(input.discountValue)),
    minOrderAmount: Math.max(0, Number(input.minOrderAmount ?? 0)),
    active: input.active ?? true,
    usageCount: existingIdx >= 0 ? nextCoupons[existingIdx].usageCount : 0,
    createdAt: existingIdx >= 0 ? nextCoupons[existingIdx].createdAt : new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    nextCoupons[existingIdx] = record;
  } else {
    nextCoupons.unshift(record);
  }

  const config = getBackendConfig();
  if (config.supabaseWriteConfigured) {
    try {
      const flatRes = await fetch(`${config.supabaseUrl}/rest/v1/coupons?on_conflict=id`, {
        method: "POST",
        headers: {
          ...supabaseHeaders(true),
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify([
          {
            id: record.id,
            code: record.code,
            description: record.description,
            discount_type: record.discountType,
            discount_value: record.discountValue,
            min_order_amount: record.minOrderAmount,
            active: record.active,
            usage_count: record.usageCount,
            created_at: record.createdAt,
          },
        ]),
      });
      if (!flatRes.ok) {
        await writeStoreSettingsDoc(STORE_SETTINGS_COUPONS_ID, { items: nextCoupons });
      }
    } catch {
      // Fallback to store_settings / local store
      await writeStoreSettingsDoc(STORE_SETTINGS_COUPONS_ID, { items: nextCoupons });
    }
  }

  local.coupons = nextCoupons;
  appendActivity(local, {
    type: "coupon",
    title: `Coupon ${record.code} saved`,
    detail: `${record.description} · Min order ৳${record.minOrderAmount}`,
  });
  await writeLocalStore(local);
  await persistActivitiesToSupabase(local.activities);
  return record;
}

export async function deleteStoreCoupon(id: string): Promise<void> {
  const [local, existingCoupons] = await Promise.all([readLocalStore(), getStoreCoupons()]);
  const nextCoupons = existingCoupons.filter((c) => c.id !== id);
  const removed = existingCoupons.find((c) => c.id === id);

  const config = getBackendConfig();
  if (config.supabaseWriteConfigured) {
    try {
      const flatRes = await fetch(
        `${config.supabaseUrl}/rest/v1/coupons?id=eq.${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: supabaseHeaders(true),
        },
      );
      if (!flatRes.ok) {
        await writeStoreSettingsDoc(STORE_SETTINGS_COUPONS_ID, { items: nextCoupons });
      }
    } catch {
      await writeStoreSettingsDoc(STORE_SETTINGS_COUPONS_ID, { items: nextCoupons });
    }
  }

  local.coupons = nextCoupons;
  if (removed) {
    appendActivity(local, {
      type: "coupon",
      title: `Coupon ${removed.code} deleted`,
      detail: `${removed.description} removed from store promotions`,
    });
  }
  await writeLocalStore(local);
  if (removed) {
    await persistActivitiesToSupabase(local.activities);
  }
}

function normalizeTaxonomy(
  raw?: Partial<CatalogTaxonomy> | null,
  products?: readonly AdminProductRecord[],
): CatalogTaxonomy {
  const categories =
    Array.isArray(raw?.categories) && raw.categories.length > 0
      ? [...raw.categories]
      : [...DEFAULT_CATALOG_TAXONOMY.categories];
  const fabrics =
    Array.isArray(raw?.fabrics) && raw.fabrics.length > 0
      ? [...raw.fabrics]
      : [...DEFAULT_CATALOG_TAXONOMY.fabrics];
  const colours =
    Array.isArray(raw?.colours) && raw.colours.length > 0
      ? [...raw.colours]
      : [...DEFAULT_CATALOG_TAXONOMY.colours];

  if (Array.isArray(products)) {
    const toLabel = (val: string) =>
      val
        .split("-")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

    for (const p of products) {
      if (p.category && !categories.some((c) => c.value === p.category)) {
        categories.push({
          value: p.category,
          label: toLabel(p.category),
          hasFabric: Boolean(p.fabric),
          imageAlt: `${toLabel(p.category)} collection`,
        });
      }
      if (p.fabric && !fabrics.some((f) => f.value === p.fabric)) {
        fabrics.push({
          value: p.fabric,
          label: toLabel(p.fabric),
          imageAlt: `${toLabel(p.fabric)} hijabs`,
        });
      }
      if (p.colour && !colours.some((c) => c.value === p.colour)) {
        colours.push({
          value: p.colour,
          label: toLabel(p.colour),
          swatch: "#5a6b7c",
        });
      }
      for (const v of p.details?.variants ?? []) {
        if (v.colour && !colours.some((c) => c.value === v.colour)) {
          colours.push({
            value: v.colour,
            label: toLabel(v.colour),
            swatch: "#5a6b7c",
          });
        }
      }
    }
  }

  return {
    categories,
    fabrics,
    colours,
  };
}

function optimizeStoryVideoSrc(rawUrl?: string): string | undefined {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes("res.cloudinary.com") && trimmed.includes("/video/upload/")) {
    if (!trimmed.includes("/video/upload/f_auto")) {
      return trimmed.replace(
        "/video/upload/",
        "/video/upload/f_auto,q_auto:eco,vc_auto,w_720,c_limit/",
      );
    }
  }
  return trimmed;
}

function normalizeStories(raw?: Story[] | null): Story[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return defaultStories;
  }
  return raw
    .filter(
      (item) =>
        item &&
        typeof item.label === "string" &&
        (Boolean(item.photo?.src) || Boolean(item.videoSrc?.trim())),
    )
    .map((item, idx) => {
      const fallbackPhotoSrc = item.photo?.src || defaultStories[0].photo.src;
      const optimizedVideo = optimizeStoryVideoSrc(item.videoSrc);
      return {
        id: item.id || `story-${idx + 1}`,
        label: item.label.trim() || `Story ${idx + 1}`,
        photo: {
          src: fallbackPhotoSrc,
          alt: item.photo?.alt || item.label,
          ...(item.photo?.position ? { position: item.photo.position } : {}),
        },
        avatar: {
          src: item.avatar?.src || fallbackPhotoSrc,
          alt: item.avatar?.alt || item.label,
          ...(item.avatar?.position ? { position: item.avatar.position } : {}),
        },
        ...(optimizedVideo ? { videoSrc: optimizedVideo } : {}),
        ...(item.href?.trim() ? { href: item.href.trim() } : {}),
      };
    });
}

function sanitizeHeroImageSrc(rawSrc: string | undefined, fallbackSrc: string): string {
  const trimmed = rawSrc?.trim();
  if (!trimmed || trimmed === "/images/hijab-black-banner.png") {
    return fallbackSrc;
  }
  return trimmed;
}

function normalizeHeroSlides(
  rawSlides?: HeroBannerConfig[] | null,
  primaryBanner?: HeroBannerConfig | null,
): HeroBannerConfig[] {
  const baseSlides = [
    DEFAULT_HERO_SLIDES[0],
    DEFAULT_HERO_SLIDES[1],
    DEFAULT_HERO_SLIDES[2],
  ];
  const inputSlides = Array.isArray(rawSlides) ? rawSlides : [];
  return baseSlides.map((fallback, idx) => {
    const slideCandidate = inputSlides[idx];
    const candidate =
      idx === 0
        ? {
            ...fallback,
            ...(primaryBanner ?? {}),
            ...(slideCandidate ?? {}),
            imageSrc:
              slideCandidate?.imageSrc &&
              slideCandidate.imageSrc !== "/images/hijab-black-banner.png"
                ? slideCandidate.imageSrc
                : primaryBanner?.imageSrc &&
                    primaryBanner.imageSrc !== "/images/hijab-black-banner.png"
                  ? primaryBanner.imageSrc
                  : fallback.imageSrc,
          }
        : (slideCandidate ?? fallback);
    return {
      titleLine1: candidate?.titleLine1?.trim() || fallback.titleLine1,
      titleLine2: candidate?.titleLine2?.trim() || fallback.titleLine2,
      subtitle: candidate?.subtitle?.trim() || fallback.subtitle,
      ctaLabel: candidate?.ctaLabel?.trim() || fallback.ctaLabel,
      ctaHref: candidate?.ctaHref?.trim() || fallback.ctaHref,
      imageSrc: sanitizeHeroImageSrc(candidate?.imageSrc, fallback.imageSrc),
      imageAlt: candidate?.imageAlt?.trim() || fallback.imageAlt,
      imagePosition: candidate?.imagePosition?.trim() || fallback.imagePosition,
    };
  });
}

async function fetchStoreSettingsFromSource(): Promise<AdminSettingsRecord> {
  const local = await readLocalStore();
  const config = getBackendConfig();

  if (config.supabaseConfigured) {
    try {
      let parsed: Partial<AdminSettingsRecord> | null = await readStoreSettingsDoc<
        Partial<AdminSettingsRecord>
      >(STORE_SETTINGS_DEFAULT_ID, { timeoutMs: 3000 });

      if (!parsed) {
        const res = await fetch(
          `${config.supabaseUrl}/rest/v1/coupons?select=description&id=eq.${encodeURIComponent(SYSTEM_SETTINGS_ROW_ID)}&limit=1`,
          {
            headers: supabaseHeaders(true),
            cache: "no-store",
            signal: AbortSignal.timeout(3000),
          },
        );
        if (res.ok) {
          const rows = (await res.json()) as Array<{ description?: string }>;
          if (rows[0]?.description) {
            parsed = JSON.parse(rows[0].description) as Partial<AdminSettingsRecord>;
          }
        }
      }

      if (parsed && typeof parsed === "object") {
        const mergedPrimaryBanner: HeroBannerConfig = {
          ...DEFAULT_HERO_BANNER,
          ...(local.settings.heroBanner ?? {}),
          ...(parsed.heroBanner ?? {}),
        };
        const normalizedSlides = normalizeHeroSlides(
          Array.isArray(parsed.heroSlides) && parsed.heroSlides.length > 0
            ? parsed.heroSlides
            : local.settings.heroSlides,
          mergedPrimaryBanner,
        );
        return {
          ...DEFAULT_SETTINGS,
          ...local.settings,
          ...parsed,
          insideDhakaShippingFee: Math.max(
            0,
            Number(parsed.insideDhakaShippingFee ?? local.settings.insideDhakaShippingFee ?? 70),
          ),
          outsideDhakaShippingFee: Math.max(
            0,
            Number(parsed.outsideDhakaShippingFee ?? local.settings.outsideDhakaShippingFee ?? 130),
          ),
          contactEmail:
            parsed.contactEmail?.trim() ||
            local.settings.contactEmail?.trim() ||
            DEFAULT_SETTINGS.contactEmail,
          contactPhone:
            parsed.contactPhone?.trim() ||
            local.settings.contactPhone?.trim() ||
            DEFAULT_SETTINGS.contactPhone,
          contactLocation:
            parsed.contactLocation?.trim() ||
            local.settings.contactLocation?.trim() ||
            DEFAULT_SETTINGS.contactLocation,
          socialLinks: {
            ...DEFAULT_SETTINGS.socialLinks,
            ...(local.settings.socialLinks ?? {}),
            ...(parsed.socialLinks ?? {}),
          },
          heroBanner: normalizedSlides[0],
          heroSlides: normalizedSlides,
          flashSale: {
            ...DEFAULT_FLASH_SALE,
            ...(local.settings.flashSale ?? {}),
            ...(parsed.flashSale ?? {}),
          },
          taxonomy: normalizeTaxonomy(parsed.taxonomy ?? local.settings.taxonomy, local.products),
          stories: normalizeStories(parsed.stories ?? local.settings.stories),
          facebookPixel: normalizeFacebookPixel(parsed.facebookPixel ?? local.settings.facebookPixel),
          courier: normalizeCourier(parsed.courier ?? local.settings.courier),
          manualPayment: normalizeManualPayment(
            parsed.manualPayment ?? local.settings.manualPayment,
          ),
          emailSettings: {
            fromEmail:
              parsed.emailSettings?.fromEmail !== undefined
                ? parsed.emailSettings.fromEmail.trim()
                : local.settings.emailSettings?.fromEmail?.trim() || "",
            fromName:
              parsed.emailSettings?.fromName !== undefined
                ? parsed.emailSettings.fromName.trim() || "HayaNest BD"
                : local.settings.emailSettings?.fromName?.trim() || "HayaNest BD",
          },
        };
      }
    } catch {
      // Fallback to local settings
    }
  }

  const localPrimaryBanner: HeroBannerConfig = {
    ...DEFAULT_HERO_BANNER,
    ...(local.settings.heroBanner ?? {}),
  };
  const localNormalizedSlides = normalizeHeroSlides(
    local.settings.heroSlides,
    localPrimaryBanner,
  );

  return {
    ...DEFAULT_SETTINGS,
    ...local.settings,
    contactEmail: local.settings.contactEmail?.trim() || DEFAULT_SETTINGS.contactEmail,
    contactPhone: local.settings.contactPhone?.trim() || DEFAULT_SETTINGS.contactPhone,
    contactLocation: local.settings.contactLocation?.trim() || DEFAULT_SETTINGS.contactLocation,
    socialLinks: {
      ...DEFAULT_SETTINGS.socialLinks,
      ...(local.settings.socialLinks ?? {}),
    },
    heroBanner: localNormalizedSlides[0],
    heroSlides: localNormalizedSlides,
    flashSale: {
      ...DEFAULT_FLASH_SALE,
      ...(local.settings.flashSale ?? {}),
    },
    taxonomy: normalizeTaxonomy(local.settings.taxonomy, local.products),
    stories: normalizeStories(local.settings.stories),
    facebookPixel: normalizeFacebookPixel(local.settings.facebookPixel),
    courier: normalizeCourier(local.settings.courier),
    manualPayment: normalizeManualPayment(local.settings.manualPayment),
    emailSettings: {
      fromEmail: local.settings.emailSettings?.fromEmail?.trim() || "",
      fromName: local.settings.emailSettings?.fromName?.trim() || "HayaNest BD",
    },
  };
}

export async function getStoreSettings(options?: {
  bypassCache?: boolean;
}): Promise<AdminSettingsRecord> {
  const memCache = getMemoryCache();

  if (options?.bypassCache) {
    const fresh = await fetchStoreSettingsFromSource();
    memCache.cachedSettings = {
      data: fresh,
      expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
    };
    memCache.inFlightSettingsPromise = null;
    return fresh;
  }

  if (memCache.cachedSettings) {
    const data = memCache.cachedSettings.data;
    // SWR: Return cached in 0ms, refresh in background if expired
    if (Date.now() >= memCache.cachedSettings.expiresAt && !memCache.inFlightSettingsPromise) {
      memCache.inFlightSettingsPromise = fetchStoreSettingsFromSource()
        .then((res) => {
          memCache.cachedSettings = {
            data: res,
            expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
          };
          memCache.inFlightSettingsPromise = null;
          return res;
        })
        .catch(() => {
          memCache.inFlightSettingsPromise = null;
          return memCache.cachedSettings?.data ?? DEFAULT_SETTINGS;
        });
    }
    return data;
  }

  if (!memCache.inFlightSettingsPromise) {
    memCache.inFlightSettingsPromise = fetchStoreSettingsFromSource()
      .then((res) => {
        memCache.cachedSettings = {
          data: res,
          expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
        };
        memCache.inFlightSettingsPromise = null;
        return res;
      })
      .catch((err) => {
        memCache.inFlightSettingsPromise = null;
        throw err;
      });
  }
  return memCache.inFlightSettingsPromise;
}

export async function updateStoreSettings(
  patch: Partial<AdminSettingsRecord>,
): Promise<AdminSettingsRecord> {
  const memCache = getMemoryCache();
  const local = await readLocalStore();
  const currentSettings = await getStoreSettings({ bypassCache: true });
  const previousSettingsMediaUrls = collectSettingsMediaUrls(currentSettings);
  const patchedPrimaryBanner: HeroBannerConfig = {
    ...DEFAULT_HERO_BANNER,
    ...(currentSettings.heroBanner ?? {}),
    ...(patch.heroBanner ?? {}),
  };
  const nextHeroSlides = normalizeHeroSlides(
    patch.heroSlides ??
      (patch.heroBanner
        ? [
            patchedPrimaryBanner,
            ...(currentSettings.heroSlides?.slice(1) ?? DEFAULT_HERO_SLIDES.slice(1)),
          ]
        : currentSettings.heroSlides),
    patchedPrimaryBanner,
  );
  const nextSettings: AdminSettingsRecord = {
    ...currentSettings,
    ...patch,
    lowStockThreshold: Math.max(
      0,
      Number(patch.lowStockThreshold ?? currentSettings.lowStockThreshold),
    ),
    insideDhakaShippingFee: Math.max(
      0,
      Number(patch.insideDhakaShippingFee ?? currentSettings.insideDhakaShippingFee ?? 70),
    ),
    outsideDhakaShippingFee: Math.max(
      0,
      Number(patch.outsideDhakaShippingFee ?? currentSettings.outsideDhakaShippingFee ?? 130),
    ),
    contactEmail:
      (patch.contactEmail !== undefined ? patch.contactEmail.trim() : currentSettings.contactEmail) ||
      DEFAULT_SETTINGS.contactEmail,
    contactPhone:
      (patch.contactPhone !== undefined ? patch.contactPhone.trim() : currentSettings.contactPhone) ||
      DEFAULT_SETTINGS.contactPhone,
    contactLocation:
      (patch.contactLocation !== undefined
        ? patch.contactLocation.trim()
        : currentSettings.contactLocation) || DEFAULT_SETTINGS.contactLocation,
    socialLinks: {
      ...DEFAULT_SETTINGS.socialLinks,
      ...(currentSettings.socialLinks ?? {}),
      ...(patch.socialLinks ?? {}),
    },
    monthlySalesTarget:
      patch.monthlySalesTarget === null || patch.monthlySalesTarget === undefined
        ? patch.monthlySalesTarget === null
          ? null
          : currentSettings.monthlySalesTarget
        : Math.max(0, Number(patch.monthlySalesTarget)),
    heroBanner: nextHeroSlides[0],
    heroSlides: nextHeroSlides,
    flashSale: {
      ...DEFAULT_FLASH_SALE,
      ...(currentSettings.flashSale ?? {}),
      ...(patch.flashSale ?? {}),
    },
    taxonomy: normalizeTaxonomy(patch.taxonomy ?? currentSettings.taxonomy, local.products),
    stories: normalizeStories(patch.stories ?? currentSettings.stories),
    facebookPixel: normalizeFacebookPixel(
      patch.facebookPixel !== undefined ? patch.facebookPixel : currentSettings.facebookPixel,
    ),
    courier: normalizeCourier(
      patch.courier !== undefined ? patch.courier : currentSettings.courier,
    ),
    manualPayment: normalizeManualPayment(
      patch.manualPayment !== undefined
        ? {
            ...(currentSettings.manualPayment ?? DEFAULT_MANUAL_PAYMENT),
            ...patch.manualPayment,
            bkash: {
              ...(currentSettings.manualPayment?.bkash ?? DEFAULT_MANUAL_PAYMENT.bkash),
              ...(patch.manualPayment.bkash ?? {}),
            },
            nagad: {
              ...(currentSettings.manualPayment?.nagad ?? DEFAULT_MANUAL_PAYMENT.nagad),
              ...(patch.manualPayment.nagad ?? {}),
            },
          }
        : currentSettings.manualPayment,
    ),
    emailSettings:
      patch.emailSettings !== undefined
        ? {
            fromEmail:
              patch.emailSettings.fromEmail !== undefined
                ? patch.emailSettings.fromEmail.trim()
                : currentSettings.emailSettings?.fromEmail?.trim() || "",
            fromName:
              patch.emailSettings.fromName !== undefined
                ? patch.emailSettings.fromName.trim() || "HayaNest BD"
                : currentSettings.emailSettings?.fromName?.trim() || "HayaNest BD",
          }
        : currentSettings.emailSettings,
  };

  local.settings = nextSettings;

  const config = getBackendConfig();
  if (config.supabaseWriteConfigured) {
    try {
      const saved = await writeStoreSettingsDoc(STORE_SETTINGS_DEFAULT_ID, nextSettings);
      if (!saved) {
        await fetch(`${config.supabaseUrl}/rest/v1/coupons?on_conflict=id`, {
          method: "POST",
          headers: {
            ...supabaseHeaders(true),
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify([
            {
              id: SYSTEM_SETTINGS_ROW_ID,
              code: SYSTEM_SETTINGS_CODE,
              description: JSON.stringify(nextSettings),
              discount_type: "fixed",
              discount_value: 0,
              min_order_amount: 0,
              active: false,
              usage_count: 0,
            },
          ]),
        });
      }
    } catch {
      // Keep local settings
    }
  }

  appendActivity(local, {
    type: "settings",
    title: patch.stories
      ? "Homepage Stories updated"
      : patch.taxonomy
        ? "Catalog categories, fabrics & colours updated"
        : patch.heroBanner || patch.heroSlides
          ? "Homepage Hero Carousel (3 Slides) updated"
          : patch.flashSale
            ? "Flash Sale timer & expiry settings updated"
            : patch.manualPayment
              ? "Manual bKash / Nagad payment settings updated"
              : patch.emailSettings
                ? "Transactional email sender (SMTP_FROM) updated"
                : "Store settings updated",
    detail: patch.stories
      ? `${nextSettings.stories.length} active stories on Homepage`
      : patch.taxonomy
        ? `${nextSettings.taxonomy.categories.length} categories · ${nextSettings.taxonomy.fabrics.length} fabrics · ${nextSettings.taxonomy.colours.length} colours`
        : patch.heroBanner || patch.heroSlides
          ? `Slide 1: "${nextSettings.heroBanner.titleLine1} ${nextSettings.heroBanner.titleLine2}" (+2 more carousel slides)`
          : patch.flashSale
            ? `Flash Sale ${nextSettings.flashSale.enabled ? "Enabled" : "Disabled"} · Action on expiry: ${nextSettings.flashSale.expiredBehavior}`
            : patch.manualPayment
              ? `bKash (${nextSettings.manualPayment?.bkash.enabled ? nextSettings.manualPayment.bkash.accountNumber || "On" : "Off"}) · Nagad (${nextSettings.manualPayment?.nagad.enabled ? nextSettings.manualPayment.nagad.accountNumber || "On" : "Off"})`
              : patch.emailSettings
                ? `Sender: ${nextSettings.emailSettings?.fromEmail || "Default (.env SMTP_FROM)"}`
                : `Shipping: Inside Dhaka ৳${nextSettings.insideDhakaShippingFee}, Outside ৳${nextSettings.outsideDhakaShippingFee} · Low stock threshold: ${nextSettings.lowStockThreshold}`,
  });
  await writeLocalStore(local);
  await persistActivitiesToSupabase(local.activities);
  memCache.cachedSettings = {
    data: nextSettings,
    expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
  };

  // Smart Auto-Cleanup: Delete any replaced/removed Hero Banner image, Story Video/Poster/Avatar, or Category image from Cloudinary / local uploads if no longer referenced
  void cleanupUnusedMediaUrls(previousSettingsMediaUrls);

  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/checkout");
  revalidatePath("/cart");
  revalidatePath("/contact");
  revalidatePath("/admin");

  return nextSettings;
}

export async function getStoreActivities(): Promise<AdminActivityRecord[]> {
  const remoteDoc = await readStoreSettingsDoc<{ items?: AdminActivityRecord[] }>(
    STORE_SETTINGS_ACTIVITIES_ID,
  );
  if (remoteDoc && Array.isArray(remoteDoc.items)) {
    return remoteDoc.items;
  }
  const local = await readLocalStore();
  return local.activities;
}

export async function applyStoreCoupon(
  code: string,
  subtotal: number,
): Promise<{ ok: boolean; discountAmount: number; couponCode: string; message: string }> {
  const normalized = code.trim().toUpperCase().replace(/\s+/g, "");
  const coupons = await getStoreCoupons();
  const found = coupons.find((c) => c.code === normalized && c.active);

  if (!found) {
    return { ok: false, discountAmount: 0, couponCode: "", message: "Invalid or expired coupon code." };
  }

  if (subtotal < found.minOrderAmount) {
    return {
      ok: false,
      discountAmount: 0,
      couponCode: "",
      message: `Minimum order amount of ৳${found.minOrderAmount} required for this coupon.`,
    };
  }

  let discount = 0;
  if (found.discountType === "percentage") {
    discount = Math.round((subtotal * found.discountValue) / 100);
  } else {
    discount = Math.min(subtotal, Math.round(found.discountValue));
  }

  return {
    ok: true,
    discountAmount: discount,
    couponCode: found.code,
    message: `Coupon ${found.code} applied! You saved ৳${discount}.`,
  };
}

async function saveReviewsToSupabase(reviews: AdminReviewRecord[]): Promise<void> {
  const config = getBackendConfig();
  if (!config.supabaseWriteConfigured) return;
  try {
    const saved = await writeStoreSettingsDoc(STORE_SETTINGS_REVIEWS_ID, { items: reviews });
    if (!saved) {
      await fetch(`${config.supabaseUrl}/rest/v1/coupons?on_conflict=id`, {
        method: "POST",
        headers: {
          ...supabaseHeaders(true),
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify([
          {
            id: SYSTEM_REVIEWS_ROW_ID,
            code: SYSTEM_REVIEWS_CODE,
            description: JSON.stringify(reviews),
            discount_type: "fixed",
            discount_value: 0,
            min_order_amount: 0,
            active: false,
            usage_count: reviews.length,
          },
        ]),
      });
    }
  } catch {
    // Keep local reviews
  }
}

async function fetchReviewsFromSource(options?: {
  productId?: string;
  status?: "all" | "approved" | "pending" | "rejected";
}): Promise<AdminReviewRecord[]> {
  const config = getBackendConfig();
  const isPublicApprovedRead = options?.status === "approved";

  if (config.supabaseConfigured) {
    try {
      let endpoint = `${config.supabaseUrl}/rest/v1/reviews?select=*&order=created_at.desc`;
      if (options?.productId) {
        endpoint += `&product_id=eq.${encodeURIComponent(options.productId)}`;
      }
      if (options?.status && options.status !== "all") {
        endpoint += `&status=eq.${encodeURIComponent(options.status)}`;
      }
      const res = await fetch(
        endpoint,
        isPublicApprovedRead
          ? { headers: supabaseHeaders(true), next: { revalidate: 60 }, signal: AbortSignal.timeout(3000) }
          : { headers: supabaseHeaders(true), cache: "no-store", signal: AbortSignal.timeout(3000) },
      );
      if (res.ok) {
        const rows = (await res.json()) as Array<{
          id: string;
          product_id: string;
          order_id?: string | null;
          customer_name: string;
          customer_phone?: string | null;
          rating: number;
          title?: string;
          comment: string;
          status: "pending" | "approved" | "rejected";
          verified_purchase: boolean;
          created_at: string;
        }>;
        if (Array.isArray(rows) && rows.length > 0) {
          const products = await getAllStoreProducts({ includeInactive: true });
          const prodMap = new Map(products.map((p) => [p.id, p.name]));
          return rows.map((r) => ({
            id: r.id,
            productId: r.product_id,
            productName: prodMap.get(r.product_id) || "Hijab Product",
            orderId: r.order_id,
            customerName: r.customer_name,
            customerPhone: r.customer_phone,
            rating: r.rating,
            title: r.title,
            comment: r.comment,
            status: r.status,
            verifiedPurchase: r.verified_purchase,
            createdAt: r.created_at,
          }));
        }
      } else {
        // Fallback: If public.reviews table does not exist in Supabase (404), read from store_settings or legacy coupons row
        let parsed: AdminReviewRecord[] | null = null;
        const doc = await readStoreSettingsDoc<{ items?: AdminReviewRecord[] }>(
          STORE_SETTINGS_REVIEWS_ID,
          isPublicApprovedRead ? { revalidate: 60, timeoutMs: 3000 } : { timeoutMs: 3000 },
        );
        if (doc && Array.isArray(doc.items)) {
          parsed = doc.items;
        } else {
          const sysRes = await fetch(
            `${config.supabaseUrl}/rest/v1/coupons?select=description&id=eq.${encodeURIComponent(SYSTEM_REVIEWS_ROW_ID)}&limit=1`,
            {
              headers: supabaseHeaders(true),
              cache: "no-store",
              signal: AbortSignal.timeout(3000),
            },
          );
          if (sysRes.ok) {
            const rows = (await sysRes.json()) as Array<{ description?: string }>;
            if (rows[0]?.description) {
              const rawParsed = JSON.parse(rows[0].description) as AdminReviewRecord[];
              if (Array.isArray(rawParsed)) {
                parsed = rawParsed;
              }
            }
          }
        }

        if (Array.isArray(parsed)) {
          const products = await getAllStoreProducts({ includeInactive: true });
          const prodMap = new Map(products.map((p) => [p.id, p.name]));
          let list = parsed.map((r) => ({
            ...r,
            productName: r.productName || prodMap.get(r.productId) || "Hijab Product",
          }));
          if (options?.productId) {
            list = list.filter((r) => r.productId === options.productId);
          }
          if (options?.status && options.status !== "all") {
            list = list.filter((r) => r.status === options.status);
          }
          return list;
        }
      }
    } catch {
      // Fallback
    }
  }

  const local = await readLocalStore();
  const products = await getAllStoreProducts({ includeInactive: true });
  const prodMap = new Map(products.map((p) => [p.id, p.name]));

  let list = (local.reviews ?? []).map((r) => ({
    ...r,
    productName: r.productName || prodMap.get(r.productId) || "Hijab Product",
  }));

  if (options?.productId) {
    list = list.filter((r) => r.productId === options.productId);
  }
  if (options?.status && options.status !== "all") {
    list = list.filter((r) => r.status === options.status);
  }
  return list;
}

export async function getAllStoreReviews(options?: {
  productId?: string;
  status?: "all" | "approved" | "pending" | "rejected";
}): Promise<AdminReviewRecord[]> {
  const isApproved = !options?.status || options.status === "approved";

  if (isApproved) {
    const memCache = getMemoryCache();
    let list: AdminReviewRecord[];
    if (memCache.cachedApprovedReviews) {
      list = memCache.cachedApprovedReviews.data;
      // SWR: Return cached reviews in 0ms, refresh in background if expired
      if (
        Date.now() >= memCache.cachedApprovedReviews.expiresAt &&
        !memCache.inFlightApprovedReviewsPromise
      ) {
        memCache.inFlightApprovedReviewsPromise = fetchReviewsFromSource({ status: "approved" })
          .then((res) => {
            memCache.cachedApprovedReviews = {
              data: res,
              expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
            };
            memCache.inFlightApprovedReviewsPromise = null;
            return res;
          })
          .catch(() => {
            memCache.inFlightApprovedReviewsPromise = null;
            return memCache.cachedApprovedReviews?.data ?? [];
          });
      }
    } else {
      if (!memCache.inFlightApprovedReviewsPromise) {
        memCache.inFlightApprovedReviewsPromise = fetchReviewsFromSource({ status: "approved" })
          .then((res) => {
            memCache.cachedApprovedReviews = {
              data: res,
              expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
            };
            memCache.inFlightApprovedReviewsPromise = null;
            return res;
          })
          .catch((err) => {
            memCache.inFlightApprovedReviewsPromise = null;
            throw err;
          });
      }
      list = await memCache.inFlightApprovedReviewsPromise;
    }

    if (options?.productId) {
      return list.filter((r) => r.productId === options.productId);
    }
    return list;
  }

  return fetchReviewsFromSource(options);
}

export async function createCustomerReview(input: {
  productId: string;
  orderId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  rating: number;
  title?: string;
  comment: string;
  status?: "pending" | "approved" | "rejected";
}): Promise<AdminReviewRecord> {
  const [local, currentReviews] = await Promise.all([
    readLocalStore(),
    fetchReviewsFromSource({ status: "all" }),
  ]);
  const normalizedOrderId = input.orderId?.trim() || null;

  // Enforce 1 review per product per order
  if (normalizedOrderId) {
    const existingReview = currentReviews.find(
      (r) => r.orderId === normalizedOrderId && r.productId === input.productId,
    );
    if (existingReview) {
      throw new Error("এই প্রোডাক্টটির রিভিউ আপনি ইতিমধ্যে জমা দিয়েছেন। একটি প্রোডাক্টে একবারের বেশি রিভিউ দেওয়া যাবে না।");
    }

    const config = getBackendConfig();
    if (config.supabaseConfigured) {
      try {
        const checkRes = await fetch(
          `${config.supabaseUrl}/rest/v1/reviews?select=id&order_id=eq.${encodeURIComponent(normalizedOrderId)}&product_id=eq.${encodeURIComponent(input.productId)}&limit=1`,
          {
            headers: supabaseHeaders(true),
            cache: "no-store",
          },
        );
        if (checkRes.ok) {
          const rows = (await checkRes.json()) as Array<{ id: string }>;
          if (Array.isArray(rows) && rows.length > 0) {
            throw new Error("এই প্রোডাক্টটির রিভিউ আপনি ইতিমধ্যে জমা দিয়েছেন। একটি প্রোডাক্টে একবারের বেশি রিভিউ দেওয়া যাবে না।");
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("রিভিউ")) {
          throw err;
        }
      }
    }
  }

  const id = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const products = await getAllStoreProducts({ includeInactive: true });
  const prod = products.find((p) => p.id === input.productId);

  const record: AdminReviewRecord = {
    id,
    productId: input.productId,
    productName: prod?.name || "Hijab Product",
    orderId: normalizedOrderId,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone?.trim() || null,
    rating: Math.max(1, Math.min(5, Math.round(Number(input.rating)))),
    title: input.title?.trim() || "",
    comment: input.comment.trim(),
    status: input.status ?? "pending",
    verifiedPurchase: Boolean(normalizedOrderId),
    createdAt: new Date().toISOString(),
  };

  const config = getBackendConfig();
  if (config.supabaseConfigured) {
    try {
      await fetch(`${config.supabaseUrl}/rest/v1/reviews`, {
        method: "POST",
        headers: supabaseHeaders(true),
        body: JSON.stringify({
          id: record.id,
          product_id: record.productId,
          order_id: record.orderId,
          customer_name: record.customerName,
          customer_phone: record.customerPhone,
          rating: record.rating,
          title: record.title,
          comment: record.comment,
          status: record.status,
          verified_purchase: record.verifiedPurchase,
          created_at: record.createdAt,
        }),
      });
    } catch {
      // Fallback
    }
  }

  const nextReviews = [record, ...currentReviews.filter((r) => r.id !== record.id)];
  local.reviews = nextReviews;
  appendActivity(local, {
    type: "product",
    title: `New review submitted for ${record.productName}`,
    detail: `${record.rating}★ by ${record.customerName} (Order: ${record.orderId || "Direct"})`,
  });
  await writeLocalStore(local);
  await Promise.all([
    saveReviewsToSupabase(nextReviews),
    persistActivitiesToSupabase(local.activities),
  ]);
  return record;
}

export async function updateStoreReview(
  id: string,
  status: "pending" | "approved" | "rejected",
): Promise<{ ok: boolean }> {
  const config = getBackendConfig();
  if (config.supabaseConfigured) {
    try {
      await fetch(`${config.supabaseUrl}/rest/v1/reviews?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: supabaseHeaders(true),
        body: JSON.stringify({ status }),
      });
    } catch {
      // Fallback
    }
  }

  const [local, currentReviews] = await Promise.all([
    readLocalStore(),
    fetchReviewsFromSource({ status: "all" }),
  ]);
  const nextReviews = [...currentReviews];
  const target = nextReviews.find((r) => r.id === id);
  if (target) {
    target.status = status;
    local.reviews = nextReviews;
    appendActivity(local, {
      type: "product",
      title: `Review status changed to ${status}`,
      detail: `Review by ${target.customerName} for ${target.productName || "Product"}`,
    });
    await writeLocalStore(local);
    await Promise.all([
      saveReviewsToSupabase(nextReviews),
      persistActivitiesToSupabase(local.activities),
    ]);
  }
  return { ok: true };
}

export async function deleteStoreReview(id: string): Promise<{ ok: boolean }> {
  const config = getBackendConfig();
  if (config.supabaseConfigured) {
    try {
      await fetch(`${config.supabaseUrl}/rest/v1/reviews?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: supabaseHeaders(true),
      });
    } catch {
      // Fallback
    }
  }

  const [local, currentReviews] = await Promise.all([
    readLocalStore(),
    fetchReviewsFromSource({ status: "all" }),
  ]);
  const nextReviews = currentReviews.filter((r) => r.id !== id);
  local.reviews = nextReviews;
  await writeLocalStore(local);
  await saveReviewsToSupabase(nextReviews);
  return { ok: true };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SYNTHETIC_PHONE_EMAIL_SUFFIX = "@phone.hayanestbd.local";

function ensureCustomerUuid(rawId?: string): string {
  const trimmed = rawId?.trim();
  if (!trimmed) return randomUUID();
  if (UUID_RE.test(trimmed)) return trimmed.toLowerCase();
  const hex = createHash("sha256").update(`customer-uuid:${trimmed}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function toDbCustomerEmail(account: CustomerAccountRecord): string {
  const clean = account.email?.trim().toLowerCase();
  if (clean) return clean;
  const digits = normalizePhoneForMatch(account.phone);
  return `${digits || account.id}${SYNTHETIC_PHONE_EMAIL_SUFFIX}`;
}

function fromDbCustomerEmail(email?: string | null): string | undefined {
  const clean = email?.trim().toLowerCase();
  if (!clean || clean.endsWith(SYNTHETIC_PHONE_EMAIL_SUFFIX)) return undefined;
  return clean;
}

type SupabaseCustomerRow = {
  id: string;
  email?: string | null;
  payload?: Record<string, unknown> | null;
  created_at?: string | null;
};

function supabaseRowToCustomerAccount(row: SupabaseCustomerRow): CustomerAccountRecord {
  const p = row.payload && typeof row.payload === "object" ? row.payload : {};
  const rawEmail =
    typeof p.email === "string" && p.email.trim()
      ? p.email
      : typeof row.email === "string"
        ? row.email
        : undefined;
  return {
    id: String(row.id || p.id || randomUUID()),
    name: String(p.name || "Customer"),
    phone: String(p.phone || ""),
    email: fromDbCustomerEmail(rawEmail),
    address: typeof p.address === "string" && p.address.trim() ? p.address : undefined,
    city: typeof p.city === "string" && p.city.trim() ? p.city : undefined,
    password: String(p.password || p.passwordHash || ""),
    resetToken: typeof p.resetToken === "string" ? p.resetToken : null,
    resetCode: typeof p.resetCode === "string" ? p.resetCode : null,
    resetExpiresAt: typeof p.resetExpiresAt === "string" ? p.resetExpiresAt : null,
    createdAt: String(p.createdAt || row.created_at || new Date().toISOString()),
  };
}

function customerAccountToSupabaseRow(account: CustomerAccountRecord) {
  const id = ensureCustomerUuid(account.id);
  const dbEmail = toDbCustomerEmail({ ...account, id });
  const payload = {
    id,
    name: account.name,
    phone: account.phone,
    ...(account.email ? { email: account.email } : {}),
    ...(account.address ? { address: account.address } : {}),
    ...(account.city ? { city: account.city } : {}),
    passwordHash: account.password,
    ...(account.resetToken !== undefined ? { resetToken: account.resetToken } : {}),
    ...(account.resetCode !== undefined ? { resetCode: account.resetCode } : {}),
    ...(account.resetExpiresAt !== undefined ? { resetExpiresAt: account.resetExpiresAt } : {}),
    createdAt: account.createdAt,
  };
  return {
    id,
    email: dbEmail,
    payload,
    created_at: account.createdAt,
  };
}

export async function getCustomerAccounts(): Promise<CustomerAccountRecord[]> {
  const local = await readLocalStore();
  const config = getBackendConfig();

  if (config.supabaseConfigured) {
    try {
      const custRes = await fetch(
        `${config.supabaseUrl}/rest/v1/customers?select=*&order=created_at.desc`,
        {
          headers: supabaseHeaders(true),
          cache: "no-store",
        },
      );
      if (custRes.ok) {
        const rows = (await custRes.json()) as SupabaseCustomerRow[];
        if (Array.isArray(rows)) {
          return rows.map(supabaseRowToCustomerAccount);
        }
      }

      const settingsDoc = await readStoreSettingsDoc<{ items?: CustomerAccountRecord[] }>(
        STORE_SETTINGS_CUSTOMERS_ID,
      );
      if (settingsDoc && Array.isArray(settingsDoc.items)) {
        return settingsDoc.items;
      }

      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/coupons?select=description&id=eq.${encodeURIComponent(SYSTEM_CUSTOMERS_ROW_ID)}&limit=1`,
        {
          headers: supabaseHeaders(true),
          cache: "no-store",
        },
      );
      if (res.ok) {
        const rows = (await res.json()) as Array<{ description?: string }>;
        if (rows[0]?.description) {
          const parsed = JSON.parse(rows[0].description) as CustomerAccountRecord[];
          if (Array.isArray(parsed)) {
            return parsed;
          }
        }
      }
    } catch {
      // Fallback to local
    }
  }

  return local.customers ?? [];
}

async function saveCustomerAccounts(
  local: LocalRuntimeStore,
  accounts: CustomerAccountRecord[],
  touchedAccount?: CustomerAccountRecord,
): Promise<void> {
  local.customers = accounts;
  const config = getBackendConfig();
  if (config.supabaseWriteConfigured) {
    try {
      const rows = (touchedAccount ? [touchedAccount] : accounts).map(
        customerAccountToSupabaseRow,
      );
      let persistedToCustomersTable = false;
      if (rows.length > 0) {
        const custRes = await fetch(
          `${config.supabaseUrl}/rest/v1/customers?on_conflict=id`,
          {
            method: "POST",
            headers: {
              ...supabaseHeaders(true),
              Prefer: "resolution=merge-duplicates,return=representation",
            },
            body: JSON.stringify(rows),
          },
        );
        persistedToCustomersTable = custRes.ok;
      }

      if (!persistedToCustomersTable) {
        const saved = await writeStoreSettingsDoc(STORE_SETTINGS_CUSTOMERS_ID, {
          items: accounts,
        });
        if (!saved) {
          await fetch(`${config.supabaseUrl}/rest/v1/coupons?on_conflict=id`, {
            method: "POST",
            headers: {
              ...supabaseHeaders(true),
              Prefer: "resolution=merge-duplicates,return=representation",
            },
            body: JSON.stringify([
              {
                id: SYSTEM_CUSTOMERS_ROW_ID,
                code: SYSTEM_CUSTOMERS_CODE,
                description: JSON.stringify(accounts),
                discount_type: "fixed",
                discount_value: 0,
                min_order_amount: 0,
                active: false,
                usage_count: accounts.length,
              },
            ]),
          });
        }
      }
    } catch {
      // Keep local accounts
    }
  }
  await writeLocalStore(local);
}

function hashCustomerPassword(raw: string): string {
  if (raw.startsWith("sha256:")) return raw;
  const digest = createHash("sha256").update(`noor-salt-v1:${raw}`).digest("hex");
  return `sha256:${digest}`;
}

function verifyCustomerPassword(stored: string, candidate: string): boolean {
  if (!stored) return false;
  if (stored.startsWith("sha256:")) {
    const expected = Buffer.from(stored);
    const actual = Buffer.from(hashCustomerPassword(candidate));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
  const scryptParts = stored.split(":");
  if (
    scryptParts.length === 2 &&
    /^[0-9a-f]+$/i.test(scryptParts[0]) &&
    /^[0-9a-f]+$/i.test(scryptParts[1])
  ) {
    try {
      const [salt, keyHex] = scryptParts;
      const expectedKey = Buffer.from(keyHex, "hex");
      if (expectedKey.length > 0) {
        const derivedKey = scryptSync(candidate, salt, expectedKey.length);
        return (
          derivedKey.length === expectedKey.length &&
          timingSafeEqual(derivedKey, expectedKey)
        );
      }
    } catch {
      return false;
    }
  }
  return stored === candidate;
}

export async function registerCustomerAccount(input: {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  password: string;
}): Promise<
  | { ok: true; user: Omit<CustomerAccountRecord, "password"> }
  | { ok: false; code: "ACCOUNT_EXISTS"; error: string }
> {
  const local = await readLocalStore();
  const accounts = await getCustomerAccounts();
  const cleanPhone = normalizePhoneForMatch(input.phone);
  const cleanEmail = input.email?.trim().toLowerCase() || undefined;

  const existingIdx = accounts.findIndex(
    (u) =>
      (input.id && (u.id === input.id || u.id === ensureCustomerUuid(input.id))) ||
      (cleanPhone && normalizePhoneForMatch(u.phone) === cleanPhone) ||
      (cleanEmail && u.email?.toLowerCase() === cleanEmail),
  );

  // Never overwrite an existing account's password/credentials through signup (prevents stale clients or duplicate signups from clobbering reset passwords).
  if (existingIdx >= 0 && accounts[existingIdx].password) {
    return {
      ok: false,
      code: "ACCOUNT_EXISTS",
      error:
        "An account with this phone number or email already exists. Please sign in or use Forgot Password.",
    };
  }

  const record: CustomerAccountRecord = {
    id:
      existingIdx >= 0
        ? ensureCustomerUuid(accounts[existingIdx].id)
        : ensureCustomerUuid(input.id),
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: cleanEmail,
    address: input.address?.trim() || undefined,
    city: input.city?.trim() || undefined,
    password: hashCustomerPassword(input.password),
    resetToken: null,
    resetCode: null,
    resetExpiresAt: null,
    createdAt: existingIdx >= 0 ? accounts[existingIdx].createdAt : new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    accounts[existingIdx] = record;
  } else {
    accounts.unshift(record);
  }

  await saveCustomerAccounts(local, accounts, record);
  const { password: _pw, ...profile } = record;
  void _pw;
  return { ok: true, user: profile };
}

export async function upsertCustomerAccount(input: {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  password: string;
}): Promise<Omit<CustomerAccountRecord, "password">> {
  const result = await registerCustomerAccount(input);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.user;
}

export async function verifyCustomerAccount(
  identifier: string,
  password: string,
): Promise<
  | { ok: true; user: Omit<CustomerAccountRecord, "password"> }
  | { ok: false; code: "ACCOUNT_NOT_FOUND" | "INVALID_PASSWORD"; error: string }
> {
  const cleanId = identifier.trim().toLowerCase();
  const cleanPhone = normalizePhoneForMatch(identifier);
  const accounts = await getCustomerAccounts();

  const match = accounts.find(
    (u) =>
      u.phone.toLowerCase() === cleanId ||
      (cleanPhone && normalizePhoneForMatch(u.phone) === cleanPhone) ||
      (u.email && u.email.toLowerCase() === cleanId),
  );

  if (!match) {
    return {
      ok: false,
      code: "ACCOUNT_NOT_FOUND",
      error:
        "No account found with this phone or email. Please sign up first or continue as a guest.",
    };
  }
  if (!verifyCustomerPassword(match.password, password)) {
    return {
      ok: false,
      code: "INVALID_PASSWORD",
      error: "Incorrect password. Please try again.",
    };
  }

  const { password: _pw, ...profile } = match;
  void _pw;
  return { ok: true, user: profile };
}

export async function changeCustomerAccountPassword(input: {
  id: string;
  phone?: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const local = await readLocalStore();
  const accounts = await getCustomerAccounts();
  const idx = accounts.findIndex(
    (u) =>
      u.id === input.id ||
      u.id === ensureCustomerUuid(input.id) ||
      (input.phone && normalizePhoneForMatch(u.phone) === normalizePhoneForMatch(input.phone)),
  );
  if (idx < 0) {
    return { ok: false, error: "Customer account not found." };
  }
  const current = accounts[idx];
  if (!verifyCustomerPassword(current.password, input.currentPassword)) {
    return { ok: false, error: "Your current password is incorrect." };
  }
  if (!input.newPassword || input.newPassword.length < 4) {
    return { ok: false, error: "New password must be at least 4 characters." };
  }
  accounts[idx] = {
    ...current,
    password: hashCustomerPassword(input.newPassword),
  };
  await saveCustomerAccounts(local, accounts, accounts[idx]);
  return { ok: true };
}

export async function createPasswordResetRequest(rawEmail: string): Promise<
  | { ok: true; token: string; code: string; email: string; name: string }
  | { ok: false; error: string }
> {
  const cleanEmail = rawEmail.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const local = await readLocalStore();
  const accounts = await getCustomerAccounts();
  const idx = accounts.findIndex((u) => u.email && u.email.toLowerCase() === cleanEmail);

  if (idx < 0) {
    return {
      ok: false,
      error: "No account found with this email address. Please check your spelling or sign up.",
    };
  }

  const account = accounts[idx];
  const token = randomBytes(32).toString("hex");
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  accounts[idx] = {
    ...account,
    resetToken: token,
    resetCode: code,
    resetExpiresAt: expiresAt,
  };

  await saveCustomerAccounts(local, accounts, accounts[idx]);

  return {
    ok: true,
    token,
    code,
    email: account.email || cleanEmail,
    name: account.name,
  };
}

export async function verifyPasswordResetTokenOrCode(tokenOrCode: string): Promise<
  | { ok: true; email: string; name: string }
  | { ok: false; error: string }
> {
  const clean = tokenOrCode.replace(/\s+/g, "").trim();
  if (!clean) return { ok: false, error: "Reset token or code is required." };

  const accounts = await getCustomerAccounts();
  const now = Date.now();

  const match = accounts.find(
    (u) =>
      (u.resetToken === clean || u.resetCode === clean) &&
      u.resetExpiresAt &&
      new Date(u.resetExpiresAt).getTime() > now,
  );

  if (!match) {
    return {
      ok: false,
      error: "This reset link or verification code is invalid or has expired.",
    };
  }

  return {
    ok: true,
    email: match.email || "",
    name: match.name,
  };
}

export async function resetCustomerPassword(
  tokenOrCode: string,
  newPassword: string,
): Promise<{ ok: true; email: string; phone: string; name: string } | { ok: false; error: string }> {
  const clean = tokenOrCode.replace(/\s+/g, "").trim();
  if (!clean) return { ok: false, error: "Reset token or code is required." };
  if (!newPassword || newPassword.length < 4) {
    return { ok: false, error: "New password must be at least 4 characters long." };
  }

  const local = await readLocalStore();
  const accounts = await getCustomerAccounts();
  const now = Date.now();

  const idx = accounts.findIndex(
    (u) =>
      (u.resetToken === clean || u.resetCode === clean) &&
      u.resetExpiresAt &&
      new Date(u.resetExpiresAt).getTime() > now,
  );

  if (idx < 0) {
    return {
      ok: false,
      error: "This reset link or verification code has expired. Please request a new one.",
    };
  }

  const account = accounts[idx];
  accounts[idx] = {
    ...account,
    password: hashCustomerPassword(newPassword),
    resetToken: null,
    resetCode: null,
    resetExpiresAt: null,
  };

  await saveCustomerAccounts(local, accounts, accounts[idx]);

  return {
    ok: true,
    email: account.email || "",
    phone: account.phone || "",
    name: account.name,
  };
}

export async function updateCustomerAccountProfile(input: {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
}): Promise<Omit<CustomerAccountRecord, "password"> | null> {
  const local = await readLocalStore();
  const accounts = await getCustomerAccounts();
  const idx = accounts.findIndex(
    (u) =>
      u.id === input.id ||
      u.id === ensureCustomerUuid(input.id) ||
      (input.phone && normalizePhoneForMatch(u.phone) === normalizePhoneForMatch(input.phone)),
  );
  if (idx < 0) return null;

  const current = accounts[idx];
  const updated: CustomerAccountRecord = {
    ...current,
    name: input.name !== undefined ? input.name.trim() || current.name : current.name,
    phone: input.phone !== undefined ? input.phone.trim() || current.phone : current.phone,
    email: input.email !== undefined ? input.email.trim().toLowerCase() || undefined : current.email,
    address: input.address !== undefined ? input.address.trim() || undefined : current.address,
    city: input.city !== undefined ? input.city.trim() || undefined : current.city,
  };

  accounts[idx] = updated;
  await saveCustomerAccounts(local, accounts, updated);
  const { password: _pw, ...profile } = updated;
  void _pw;
  return profile;
}

export async function getCustomerAccountsPublic(): Promise<
  Array<Omit<CustomerAccountRecord, "password">>
> {
  const accounts = await getCustomerAccounts();
  return accounts.map(({ password: _pw, ...rest }) => {
    void _pw;
    return rest;
  });
}

export async function adminResetCustomerPassword(input: {
  id: string;
  phone?: string;
  newPassword: string;
}): Promise<{ ok: true; user: Omit<CustomerAccountRecord, "password"> } | { ok: false; error: string }> {
  if (!input.newPassword || input.newPassword.trim().length < 4) {
    return { ok: false, error: "New password must be at least 4 characters." };
  }
  const local = await readLocalStore();
  const accounts = await getCustomerAccounts();
  const idx = accounts.findIndex(
    (u) =>
      u.id === input.id ||
      u.id === ensureCustomerUuid(input.id) ||
      (input.phone && normalizePhoneForMatch(u.phone) === normalizePhoneForMatch(input.phone)),
  );
  if (idx < 0) {
    return { ok: false, error: "Customer account not found." };
  }
  const current = accounts[idx];
  const updated: CustomerAccountRecord = {
    ...current,
    password: hashCustomerPassword(input.newPassword.trim()),
  };
  accounts[idx] = updated;
  appendActivity(local, {
    type: "settings",
    title: `Customer password reset: ${updated.name}`,
    detail: `Account ${updated.id} (${updated.phone}) password was reset by Admin`,
  });
  await saveCustomerAccounts(local, accounts, updated);
  await persistActivitiesToSupabase(local.activities);
  const { password: _pw, ...profile } = updated;
  void _pw;
  return { ok: true, user: profile };
}

export async function getContactMessages(): Promise<ContactMessageRecord[]> {
  const local = await readLocalStore();
  const config = getBackendConfig();

  if (config.supabaseConfigured) {
    try {
      const settingsDoc = await readStoreSettingsDoc<{ items?: ContactMessageRecord[] }>(
        STORE_SETTINGS_MESSAGES_ID,
      );
      if (settingsDoc && Array.isArray(settingsDoc.items)) {
        return settingsDoc.items;
      }

      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/coupons?select=description&id=eq.${encodeURIComponent(SYSTEM_CONTACT_MESSAGES_ROW_ID)}&limit=1`,
        {
          headers: supabaseHeaders(true),
          cache: "no-store",
        },
      );
      if (res.ok) {
        const rows = (await res.json()) as Array<{ description?: string }>;
        if (rows[0]?.description) {
          const parsed = JSON.parse(rows[0].description) as ContactMessageRecord[];
          if (Array.isArray(parsed)) {
            return parsed;
          }
        }
      }
    } catch {
      // Fallback to local
    }
  }

  return local.contactMessages ?? [];
}

async function saveContactMessages(
  local: LocalRuntimeStore,
  messages: ContactMessageRecord[],
): Promise<void> {
  local.contactMessages = messages;
  const config = getBackendConfig();
  if (config.supabaseWriteConfigured) {
    try {
      const saved = await writeStoreSettingsDoc(STORE_SETTINGS_MESSAGES_ID, {
        items: messages,
      });
      if (!saved) {
        await fetch(`${config.supabaseUrl}/rest/v1/coupons?on_conflict=id`, {
          method: "POST",
          headers: {
            ...supabaseHeaders(true),
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify([
            {
              id: SYSTEM_CONTACT_MESSAGES_ROW_ID,
              code: SYSTEM_CONTACT_MESSAGES_CODE,
              description: JSON.stringify(messages),
              discount_type: "fixed",
              discount_value: 0,
              min_order_amount: 0,
              active: false,
              usage_count: messages.length,
            },
          ]),
        });
      }
    } catch {
      // Keep local
    }
  }
  await writeLocalStore(local);
}

export async function createContactMessage(input: {
  name: string;
  contact: string;
  topic?: string;
  message: string;
}): Promise<ContactMessageRecord> {
  const local = await readLocalStore();
  const messages = await getContactMessages();
  const record: ContactMessageRecord = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim(),
    contact: input.contact.trim(),
    topic: input.topic?.trim() || "Order Inquiry",
    message: input.message.trim(),
    status: "unread",
    createdAt: new Date().toISOString(),
  };

  messages.unshift(record);
  appendActivity(local, {
    type: "settings",
    title: `New Contact Inquiry: ${record.topic}`,
    detail: `From ${record.name} (${record.contact})`,
  });
  await saveContactMessages(local, messages);
  await persistActivitiesToSupabase(local.activities);
  return record;
}

export async function updateContactMessageStatus(
  id: string,
  status: "unread" | "resolved",
): Promise<boolean> {
  const local = await readLocalStore();
  const messages = await getContactMessages();
  const idx = messages.findIndex((m) => m.id === id);
  if (idx < 0) return false;
  messages[idx] = { ...messages[idx], status };
  await saveContactMessages(local, messages);
  return true;
}

export async function deleteContactMessage(id: string): Promise<boolean> {
  const local = await readLocalStore();
  const messages = await getContactMessages();
  const next = messages.filter((m) => m.id !== id);
  await saveContactMessages(local, next);
  return true;
}

