"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Award,
  BarChart3,
  Bell,
  Blocks,
  Box,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Copy,
  CreditCard,
  Database,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FolderKanban,
  Image as ImageIcon,
  ImagePlus,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  Package,
  Plus,
  Printer,
  Radio,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Star,
  Tag,
  Trash2,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { photos } from "@/data/photos";
import {
  DEFAULT_CATALOG_TAXONOMY,
  resolveColourMeta,
  type CatalogTaxonomy,
} from "@/data/shop-options";
import { formatPrice, stories as defaultStories } from "@/data/store";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ProductCard } from "@/components/product/product-card";
import { ProductPhoto } from "@/components/product/product-photo";
import { printOrderInvoice } from "@/lib/invoice-printer";
import {
  CategoryPerformanceChart,
  CustomerAnalyticsChart,
  OrderStatusDonutChart,
  PaymentAnalyticsChart,
  RevenueAnalyticsChart,
  SalesAnalyticsChart,
} from "./admin-charts";
import { AdminKpiGrid } from "./admin-kpi-grid";
import { trackTestPing } from "@/lib/fpixel";
import type {
  DashboardAnalyticsResponse,
  DateRangePreset,
  VariantInventoryRow,
} from "@/lib/server/analytics-engine";
import type {
  AdminDeliveryStatus,
  AdminOrderRecord,
  AdminOrderStatus,
  AdminPaymentStatus,
  AdminProductInput,
  AdminProductRecord,
  AdminReviewRecord,
  ContactMessageRecord,
  CustomerAccountRecord,
  HeroBannerConfig,
  ProductSectionKey,
  ProductStatus,
} from "@/lib/server/store-repository";
import {
  buildOrderShipments,
  getCourierTrackingUrl,
  getDefaultPickupHubs,
  hasMixedFulfillmentItems,
  resolvePickupHubForSource,
} from "@/lib/fulfillment";
import type { OrderShipment } from "@/lib/orders";
import type {
  CourierProvider,
  Fabric,
  FraudCheckResult,
  FulfillmentSource,
  PathaoStoreSummary,
  Photo,
  PickupHubConfig,
  ProductCategory,
  ProductColour,
  Story,
} from "@/types/store";

type PublicCustomerAccount = Omit<CustomerAccountRecord, "password">;

type BackendStatus = {
  supabaseConfigured: boolean;
  supabaseWriteConfigured: boolean;
  supabaseUrl?: string;
  cloudinaryConfigured: boolean;
  cloudinaryCloudName?: string;
  emailConfigured?: boolean;
  emailSenderReady?: boolean;
  emailProvider?: string;
  emailUser?: string;
  emailFrom?: string;
  emailFromEmail?: string;
  emailFromName?: string;
  defaultAdminEmail: string;
};

export type AdminSectionId =
  | "dashboard"
  | "products"
  | "categories"
  | "orders"
  | "customers"
  | "inventory"
  | "coupons"
  | "analytics"
  | "reviews"
  | "banners"
  | "shipping"
  | "payments"
  | "users"
  | "integrations"
  | "settings";

export const ADMIN_SECTION_IDS = new Set<AdminSectionId>([
  "dashboard",
  "products",
  "categories",
  "orders",
  "customers",
  "inventory",
  "coupons",
  "analytics",
  "reviews",
  "banners",
  "shipping",
  "payments",
  "users",
  "integrations",
  "settings",
]);

const SIDEBAR_ITEMS: { id: AdminSectionId; label: string; group: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", group: "Core", icon: LayoutDashboard },
  { id: "products", label: "Products", group: "Catalog", icon: Package },
  { id: "categories", label: "Categories", group: "Catalog", icon: FolderKanban },
  { id: "inventory", label: "Inventory", group: "Catalog", icon: Box },
  { id: "orders", label: "Orders", group: "Sales", icon: ShoppingCart },
  { id: "customers", label: "Customers", group: "Sales", icon: Users },
  { id: "coupons", label: "Coupons & Discounts", group: "Sales", icon: Tag },
  { id: "analytics", label: "Analytics & Reports", group: "Insights", icon: BarChart3 },
  { id: "payments", label: "Payments", group: "Operations", icon: CreditCard },
  { id: "shipping", label: "Shipping", group: "Operations", icon: Truck },
  { id: "reviews", label: "Reviews", group: "Content", icon: MessageSquare },
  { id: "banners", label: "Banners & Content", group: "Content", icon: ImageIcon },
  { id: "users", label: "Admin Users & Roles", group: "System", icon: ShieldCheck },
  { id: "integrations", label: "Integrations", group: "System", icon: Blocks },
  { id: "settings", label: "Settings", group: "System", icon: Settings },
];

const DATE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

const SECTION_OPTIONS: { key: ProductSectionKey; label: string }[] = [
  { key: "new-items", label: "New Items" },
  { key: "flash-sale", label: "Flash Sale" },
  { key: "most-popular", label: "Most Popular" },
  { key: "just-for-you", label: "Just For You" },
  { key: "top-products", label: "Top Products Slider" },
];

const ORDER_STATUSES: AdminOrderStatus[] = [
  "Pending",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
  "Returned",
  "Refunded",
];

const PAYMENT_STATUSES: AdminPaymentStatus[] = [
  "Paid",
  "Pending",
  "Failed",
  "Refunded",
  "Partially Refunded",
];

const DELIVERY_STATUSES: AdminDeliveryStatus[] = [
  "Pending Dispatch",
  "In Transit",
  "Out for Delivery",
  "Delivered",
  "Returned",
  "Cancelled",
];

function formatAdminOrderStatusOption(st: AdminOrderStatus): string {
  if (st === "Confirmed") return "Confirmed (Ready to Ship)";
  if (st === "Processing") return "Processing (Preparing)";
  return st;
}

function formatAdminDeliveryOption(ds: AdminDeliveryStatus): string {
  if (ds === "Pending Dispatch") return "Ready to Ship (Pending Dispatch)";
  if (ds === "In Transit") return "Shipped (In Transit)";
  return ds;
}

function getAdminDeliveryPillMeta(order: Pick<AdminOrderRecord, "status" | "deliveryStatus">): {
  label: string;
  pillClass: string;
} {
  switch (order.deliveryStatus) {
    case "Delivered":
      return { label: "Delivered ✓", pillClass: "is-success" };
    case "Out for Delivery":
      return { label: "Out for Delivery", pillClass: "is-info" };
    case "In Transit":
      return { label: "Shipped (In Transit)", pillClass: "is-info" };
    case "Returned":
      return { label: "Returned", pillClass: "is-danger" };
    case "Cancelled":
      return { label: "Cancelled", pillClass: "is-danger" };
    case "Pending Dispatch":
    default:
      if (order.status === "Confirmed" || order.status === "Processing") {
        return { label: "Ready to Ship", pillClass: "is-ready" };
      }
      if (order.status === "Pending") {
        return { label: "Awaiting Confirm", pillClass: "is-warning" };
      }
      return { label: "Pending Dispatch", pillClass: "is-warning" };
  }
}

function getCustomerFacingStatusMeta(order: Pick<AdminOrderRecord, "status">): {
  label: string;
  pillClass: string;
} {
  if (order.status === "Pending") {
    return { label: "Pending Verification", pillClass: "is-warning" };
  }
  if (order.status === "Confirmed" || order.status === "Processing") {
    return { label: "Confirmed · Ready to Ship", pillClass: "is-ready" };
  }
  if (order.status === "Shipped") {
    return { label: "Order Shipped", pillClass: "is-info" };
  }
  if (order.status === "Delivered") {
    return { label: "Delivered ✓", pillClass: "is-success" };
  }
  return { label: order.status, pillClass: "is-danger" };
}

const PRESET_PHOTOS = [
  { label: "Rose Modal", photo: photos.rose },
  { label: "Olive Jersey", photo: photos.olive },
  { label: "Black Drape", photo: photos.black },
  { label: "Sand Chiffon", photo: photos.sand },
  { label: "Mocha Silk", photo: photos.mocha },
  { label: "Mauve Silk", photo: photos.mauve },
  { label: "Burgundy", photo: photos.burgundy },
  { label: "Accessories", photo: photos.accessories },
];

function formatOrderDate(iso: string, includeTime = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", hour12: true } : {}),
  }).format(d);
}

function computePresetDatetimeLocal(hoursFromNow: number): string {
  const target = new Date();
  target.setTime(target.getTime() + hoursFromNow * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
}

const DEFAULT_ADMIN_HERO_SLIDES: [HeroBannerConfig, HeroBannerConfig, HeroBannerConfig] = [
  {
    titleLine1: "Everyday",
    titleLine2: "Elegance",
    subtitle: "Premium hijabs crafted for comfort and confidence",
    ctaLabel: "Explore Collection",
    ctaHref: "#new-items",
    imageSrc: photos.hero.src,
    imageAlt: photos.hero.alt,
    imagePosition: photos.hero.position || "74% 18%",
  },
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

function buildHeroSlidesState(
  rawSlides?: HeroBannerConfig[] | null,
  primaryBanner?: HeroBannerConfig | null,
): [HeroBannerConfig, HeroBannerConfig, HeroBannerConfig] {
  const input = Array.isArray(rawSlides) ? rawSlides : [];
  return [0, 1, 2].map((idx) => {
    const fallback = DEFAULT_ADMIN_HERO_SLIDES[idx];
    const candidate =
      idx === 0 ? (input[0] ?? primaryBanner ?? fallback) : (input[idx] ?? fallback);
    const rawSrc = candidate?.imageSrc?.trim();
    const resolvedSrc =
      !rawSrc || rawSrc === "/images/hijab-black-banner.png"
        ? fallback.imageSrc
        : rawSrc;
    return {
      titleLine1: candidate?.titleLine1 || fallback.titleLine1,
      titleLine2: candidate?.titleLine2 || fallback.titleLine2,
      subtitle: candidate?.subtitle || fallback.subtitle,
      ctaLabel: candidate?.ctaLabel || fallback.ctaLabel,
      ctaHref: candidate?.ctaHref || fallback.ctaHref,
      imageSrc: resolvedSrc,
      imageAlt: candidate?.imageAlt || fallback.imageAlt,
      imagePosition: candidate?.imagePosition || fallback.imagePosition,
    };
  }) as [HeroBannerConfig, HeroBannerConfig, HeroBannerConfig];
}

const subscribeNoop = () => () => {};
const getOriginSnapshot = () => (typeof window !== "undefined" ? window.location.origin : "");
const getEmptyOrigin = () => "";

function createRandomSecret(prefix: string): string {
  const bytes = new Uint8Array(12);
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}

export function AdminDashboard({
  initialAuthenticated,
  initialStatus,
  initialAnalytics,
  initialProducts,
  initialOrders,
  initialReviews = [],
  initialRegisteredCustomers = [],
  initialContactMessages = [],
  initialSection = "dashboard",
}: {
  initialAuthenticated: boolean;
  initialStatus: BackendStatus;
  initialAnalytics: DashboardAnalyticsResponse;
  initialProducts: AdminProductRecord[];
  initialOrders: AdminOrderRecord[];
  initialReviews?: AdminReviewRecord[];
  initialRegisteredCustomers?: PublicCustomerAccount[];
  initialContactMessages?: ContactMessageRecord[];
  initialSection?: AdminSectionId;
}) {
  const siteOrigin = useSyncExternalStore(subscribeNoop, getOriginSnapshot, getEmptyOrigin);
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [status] = useState<BackendStatus>(initialStatus);

  // Navigation & Layout State
  const [activeSection, _setActiveSection] = useState<AdminSectionId>(initialSection);

  const setActiveSection = useCallback((section: AdminSectionId) => {
    _setActiveSection(section);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (section === "dashboard") {
        url.searchParams.delete("section");
      } else {
        url.searchParams.set("section", section);
      }
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const sec = params.get("section") as AdminSectionId | null;
      if (sec && ADMIN_SECTION_IDS.has(sec)) {
        _setActiveSection(sec);
      } else {
        _setActiveSection("dashboard");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Global Date Filter & Search
  const [datePreset, setDatePreset] = useState<DateRangePreset>(
    initialAnalytics.meta.preset || "last_30_days",
  );
  const [customStart, setCustomStart] = useState(initialAnalytics.meta.startDate);
  const [customEnd, setCustomEnd] = useState(initialAnalytics.meta.endDate);
  const [globalSearch, setGlobalSearch] = useState("");

  // Core Data State
  const [analytics, setAnalytics] = useState<DashboardAnalyticsResponse>(initialAnalytics);
  const [products, setProducts] = useState<AdminProductRecord[]>(initialProducts);
  const [orders, setOrders] = useState<AdminOrderRecord[]>(initialOrders);
  const [reviews, setReviews] = useState<AdminReviewRecord[]>(initialReviews);
  const [registeredCustomers, setRegisteredCustomers] = useState<PublicCustomerAccount[]>(
    initialRegisteredCustomers,
  );
  const [contactMessages, setContactMessages] = useState<ContactMessageRecord[]>(
    initialContactMessages,
  );
  const [resettingCustomerId, setResettingCustomerId] = useState<string | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [savingCustomerReset, setSavingCustomerReset] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewProcessingId, setReviewProcessingId] = useState<string | null>(null);

  const pendingReviewsCount = useMemo(
    () => reviews.filter((r) => r.status === "pending").length,
    [reviews],
  );
  const unreadContactMessagesCount = useMemo(
    () => contactMessages.filter((m) => m.status === "unread").length,
    [contactMessages],
  );

  const [loadingData, setLoadingData] = useState(false);
  const [apiError, setApiError] = useState("");
  const [feedback, setFeedback] = useState("");

  // Login State
  const [loginEmail, setLoginEmail] = useState(
    initialStatus.defaultAdminEmail || "admin@hayanestbd.com",
  );
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  // Orders Table Filters, Sort, Pagination & Detail Modal
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<string>("all");
  const [orderSort, setOrderSort] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const [orderPage, setOrderPage] = useState(1);
  const [selectedOrderSnapshot, setSelectedOrder] = useState<AdminOrderRecord | null>(null);
  const selectedOrder = useMemo(
    () =>
      selectedOrderSnapshot
        ? (orders.find((o) => o.id === selectedOrderSnapshot.id) ?? selectedOrderSnapshot)
        : null,
    [orders, selectedOrderSnapshot],
  );
  const [showManualOrderModal, setShowManualOrderModal] = useState(false);

  // Manual Order Form State
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualCustomerPhone, setManualCustomerPhone] = useState("");
  const [manualCustomerCity, setManualCustomerCity] = useState("Dhaka");
  const [manualCustomerAddress, setManualCustomerAddress] = useState("");
  const [manualZone, setManualZone] = useState<"inside-dhaka" | "outside-dhaka">("inside-dhaka");
  const [manualPaymentMethod, setManualPaymentMethod] = useState<"cod" | "bkash" | "nagad">("cod");
  const [manualPaymentPhone, setManualPaymentPhone] = useState("");
  const [manualPaymentTrxId, setManualPaymentTrxId] = useState("");
  const [manualProductId, setManualProductId] = useState(
    initialProducts[0]?.id || "premium-modal-rose",
  );
  const [manualQty, setManualQty] = useState("1");
  const [creatingManualOrder, setCreatingManualOrder] = useState(false);

  // Best Sellers Sort State
  const [bestSellerSort, setBestSellerSort] = useState<"units" | "revenue">("units");

  // Inventory Filter & Inline Edit State
  const [inventoryFilter, setInventoryFilter] = useState<"all" | "low_stock" | "out_of_stock">(
    "all",
  );
  const [inventorySearch, setInventorySearch] = useState("");
  const [variantDrafts, setVariantDrafts] = useState<
    Record<string, { stock: string; costPrice: string }>
  >({});
  const [savingVariantKey, setSavingVariantKey] = useState<string | null>(null);

  // Reviews Moderation State & Handlers
  const filteredReviews = useMemo(() => {
    let list = reviews;
    if (reviewFilter !== "all") {
      list = list.filter((r) => r.status === reviewFilter);
    }
    if (reviewSearch.trim()) {
      const q = reviewSearch.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.customerName.toLowerCase().includes(q) ||
          (r.productName && r.productName.toLowerCase().includes(q)) ||
          r.comment.toLowerCase().includes(q) ||
          (r.orderId && r.orderId.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [reviews, reviewFilter, reviewSearch]);

  const approvedReviewsCount = useMemo(
    () => reviews.filter((r) => r.status === "approved").length,
    [reviews],
  );
  const rejectedReviewsCount = useMemo(
    () => reviews.filter((r) => r.status === "rejected").length,
    [reviews],
  );
  const reviewsAverageRating = useMemo(() => {
    if (!reviews.length) return "0.0";
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  async function handleUpdateReviewStatus(
    id: string,
    nextStatus: "pending" | "approved" | "rejected",
  ) {
    setReviewProcessingId(id);
    const prevReviews = [...reviews];
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)));
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      if (!res.ok) {
        setReviews(prevReviews);
        alert("Failed to update review status.");
      }
    } catch {
      setReviews(prevReviews);
      alert("Network error updating review status.");
    } finally {
      setReviewProcessingId(null);
    }
  }

  async function handleDeleteReview(id: string) {
    if (!window.confirm("Are you sure you want to permanently delete this customer review?")) {
      return;
    }
    setReviewProcessingId(id);
    const prevReviews = [...reviews];
    setReviews((prev) => prev.filter((r) => r.id !== id));
    try {
      const res = await fetch(`/api/admin/reviews?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setReviews(prevReviews);
        alert("Failed to delete review.");
      }
    } catch {
      setReviews(prevReviews);
      alert("Network error deleting review.");
    } finally {
      setReviewProcessingId(null);
    }
  }

  async function handleAdminResetCustomerPassword(customer: PublicCustomerAccount) {
    const cleanNewPassword = resetPasswordInput.trim();
    if (cleanNewPassword.length < 4) {
      alert("New password must be at least 4 characters.");
      return;
    }
    setSavingCustomerReset(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: customer.id,
          phone: customer.phone,
          newPassword: cleanNewPassword,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        alert(data.error || "Could not reset customer password.");
        return;
      }
      setFeedback(
        `Password for ${customer.name} (${customer.phone}) has been reset to "${cleanNewPassword}".`,
      );
      setResettingCustomerId(null);
      setResetPasswordInput("");
    } catch {
      alert("Network error while resetting customer password.");
    } finally {
      setSavingCustomerReset(false);
    }
  }

  async function handleToggleContactMessageStatus(msg: ContactMessageRecord) {
    const nextStatus: "unread" | "resolved" = msg.status === "unread" ? "resolved" : "unread";
    const prev = [...contactMessages];
    setContactMessages((list) =>
      list.map((m) => (m.id === msg.id ? { ...m, status: nextStatus } : m)),
    );
    try {
      const res = await fetch("/api/contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: msg.id, status: nextStatus }),
      });
      if (!res.ok) {
        setContactMessages(prev);
      }
    } catch {
      setContactMessages(prev);
    }
  }

  async function handleDeleteContactMessage(id: string) {
    if (!window.confirm("Delete this customer contact message?")) return;
    const prev = [...contactMessages];
    setContactMessages((list) => list.filter((m) => m.id !== id));
    try {
      const res = await fetch(`/api/contact?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setContactMessages(prev);
      }
    } catch {
      setContactMessages(prev);
    }
  }

  // Product Form State
  const [showProductFormModal, setShowProductFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string>("");
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("650");
  const [originalPrice, setOriginalPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [productStatus, setProductStatus] = useState<ProductStatus>("active");
  const [description, setDescription] = useState(
    "A soft, fluid drape for everyday styling. Breathable comfort from morning to evening.",
  );
  const [category, setCategory] = useState<ProductCategory>("hijabs");
  const [fabric, setFabric] = useState<Fabric>("modal");
  const [colour, setColour] = useState<ProductColour>("rose");
  const [stock, setStock] = useState("12");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [material, setMaterial] = useState("Modal");
  const [size, setSize] = useState("180 × 70 cm");
  const [imageSrc, setImageSrc] = useState(photos.rose.src);
  const [imageAlt, setImageAlt] = useState(photos.rose.alt);
  const [galleryPhotos, setGalleryPhotos] = useState<Photo[]>([
    { src: photos.rose.src, alt: photos.rose.alt },
  ]);
  const [sections, setSections] = useState<ProductSectionKey[]>(["new-items"]);
  const [productFulfillmentSource, setProductFulfillmentSource] =
    useState<FulfillmentSource>("in-house");
  const [productPickupHubId, setProductPickupHubId] = useState<string>("own-main");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [seedingSupabase, setSeedingSupabase] = useState(false);
  const [productCatalogSearch, setProductCatalogSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>("all");

  // Coupon Form State
  const [couponCode, setCouponCode] = useState("");
  const [couponDesc, setCouponDesc] = useState("");
  const [couponType, setCouponType] = useState<"percentage" | "fixed">("percentage");
  const [couponValue, setCouponValue] = useState("10");
  const [couponMinOrder, setCouponMinOrder] = useState("500");
  const [savingCoupon, setSavingCoupon] = useState(false);

  // Store Settings Form State
  const [storeNameInput, setStoreNameInput] = useState(analytics.settings.storeName);
  const [timezoneInput, setTimezoneInput] = useState(analytics.settings.timezone);
  const [thresholdInput, setThresholdInput] = useState(
    String(analytics.settings.lowStockThreshold),
  );
  const [targetInput, setTargetInput] = useState(
    analytics.settings.monthlySalesTarget !== null
      ? String(analytics.settings.monthlySalesTarget)
      : "",
  );
  const [insideDhakaFeeInput, setInsideDhakaFeeInput] = useState(
    String(analytics.settings.insideDhakaShippingFee),
  );
  const [outsideDhakaFeeInput, setOutsideDhakaFeeInput] = useState(
    String(analytics.settings.outsideDhakaShippingFee),
  );
  const [contactEmailInput, setContactEmailInput] = useState(
    analytics.settings.contactEmail ?? "support@hayanestbd.com",
  );
  const [contactPhoneInput, setContactPhoneInput] = useState(
    analytics.settings.contactPhone ?? "+880 1700-000000",
  );
  const [contactLocationInput, setContactLocationInput] = useState(
    analytics.settings.contactLocation ?? "Dhaka, Bangladesh",
  );
  const [facebookUrlInput, setFacebookUrlInput] = useState(
    analytics.settings.socialLinks?.facebook ?? "",
  );
  const [instagramUrlInput, setInstagramUrlInput] = useState(
    analytics.settings.socialLinks?.instagram ?? "",
  );
  const [youtubeUrlInput, setYoutubeUrlInput] = useState(
    analytics.settings.socialLinks?.youtube ?? "",
  );
  const [tiktokUrlInput, setTiktokUrlInput] = useState(
    analytics.settings.socialLinks?.tiktok ?? "",
  );
  const [savingSettings, setSavingSettings] = useState(false);

  // Admin Password Change State
  const [adminCurrentPassword, setAdminCurrentPassword] = useState("");
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");
  const [adminPwLoading, setAdminPwLoading] = useState(false);
  const [adminPwMessage, setAdminPwMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Courier & Fraud Check Configuration State
  const [courierProvider, setCourierProvider] = useState<CourierProvider>(
    analytics.settings.courier?.provider ?? "steadfast",
  );
  const [steadfastEnabled, setSteadfastEnabled] = useState(
    analytics.settings.courier?.steadfastEnabled ??
      Boolean(analytics.settings.courier?.steadfastApiKey?.trim()),
  );
  const [steadfastApiKey, setSteadfastApiKey] = useState(
    analytics.settings.courier?.steadfastApiKey ?? "",
  );
  const [steadfastSecretKey, setSteadfastSecretKey] = useState(
    analytics.settings.courier?.steadfastSecretKey ?? "",
  );
  const [steadfastWebhookToken, setSteadfastWebhookToken] = useState(
    analytics.settings.courier?.steadfastWebhookToken ?? "",
  );
  const [pathaoEnabled, setPathaoEnabled] = useState(
    analytics.settings.courier?.pathaoEnabled ??
      Boolean(analytics.settings.courier?.pathaoClientId?.trim()),
  );
  const [pathaoClientId, setPathaoClientId] = useState(
    analytics.settings.courier?.pathaoClientId ?? "",
  );
  const [pathaoClientSecret, setPathaoClientSecret] = useState(
    analytics.settings.courier?.pathaoClientSecret ?? "",
  );
  const [pathaoUsername, setPathaoUsername] = useState(
    analytics.settings.courier?.pathaoUsername ?? "",
  );
  const [pathaoPassword, setPathaoPassword] = useState(
    analytics.settings.courier?.pathaoPassword ?? "",
  );
  const [pathaoStoreId, setPathaoStoreId] = useState(
    analytics.settings.courier?.pathaoStoreId ?? "",
  );
  const [pathaoWebhookSecret, setPathaoWebhookSecret] = useState(
    analytics.settings.courier?.pathaoWebhookSecret ?? "",
  );
  const [defaultInHouseCourier, setDefaultInHouseCourier] = useState<CourierProvider>(
    analytics.settings.courier?.defaultInHouseCourier ?? "steadfast",
  );
  const [defaultSupplierCourier, setDefaultSupplierCourier] = useState<CourierProvider>(
    analytics.settings.courier?.defaultSupplierCourier ?? "pathao",
  );
  const [pickupHubs, setPickupHubs] = useState<PickupHubConfig[]>(() =>
    Array.isArray(analytics.settings.courier?.pickupHubs) &&
    analytics.settings.courier.pickupHubs.length > 0
      ? analytics.settings.courier.pickupHubs
      : getDefaultPickupHubs({
          contactLocation: analytics.settings.contactLocation,
          contactPhone: analytics.settings.contactPhone,
          pathaoStoreId: analytics.settings.courier?.pathaoStoreId,
          defaultInHouseCourier: analytics.settings.courier?.defaultInHouseCourier,
          defaultSupplierCourier: analytics.settings.courier?.defaultSupplierCourier,
        }),
  );
  const [pathaoStores, setPathaoStores] = useState<PathaoStoreSummary[]>([]);
  const [loadingPathaoStores, setLoadingPathaoStores] = useState(false);
  const [pathaoStoreMessage, setPathaoStoreMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [autoFraudCheck, setAutoFraudCheck] = useState(
    analytics.settings.courier?.autoFraudCheck ?? true,
  );
  const [courierTestMode, setCourierTestMode] = useState(
    analytics.settings.courier?.testMode ?? false,
  );

  // Manual bKash & Nagad Payment Settings State
  const [bkashEnabled, setBkashEnabled] = useState(
    analytics.settings.manualPayment?.bkash.enabled ?? true,
  );
  const [bkashNumber, setBkashNumber] = useState(
    analytics.settings.manualPayment?.bkash.accountNumber ?? "01700-000000",
  );
  const [bkashType, setBkashType] = useState<"Personal" | "Merchant" | "Agent">(
    analytics.settings.manualPayment?.bkash.accountType ?? "Personal",
  );
  const [bkashInstruction, setBkashInstruction] = useState(
    analytics.settings.manualPayment?.bkash.instruction ??
      "bKash অ্যাপ থেকে 'Send Money' অপশনে গিয়ে মোট টাকা পাঠান এবং আপনার প্রেরক নম্বর ও Transaction ID (TrxID) নিচে দিন।",
  );
  const [nagadEnabled, setNagadEnabled] = useState(
    analytics.settings.manualPayment?.nagad.enabled ?? true,
  );
  const [nagadNumber, setNagadNumber] = useState(
    analytics.settings.manualPayment?.nagad.accountNumber ?? "01700-000000",
  );
  const [nagadType, setNagadType] = useState<"Personal" | "Merchant" | "Agent">(
    analytics.settings.manualPayment?.nagad.accountType ?? "Personal",
  );
  const [nagadInstruction, setNagadInstruction] = useState(
    analytics.settings.manualPayment?.nagad.instruction ??
      "Nagad অ্যাপ থেকে 'Send Money' অপশনে গিয়ে মোট টাকা পাঠান এবং আপনার প্রেরক নম্বর ও Transaction ID (TrxID) নিচে দিন।",
  );
  const [manualPaymentNote, setManualPaymentNote] = useState(
    analytics.settings.manualPayment?.verificationNote ??
      "অ্যাডমিন আপনার Transaction ID (TrxID) যাচাই করার পর পেমেন্ট ও অর্ডার কনফার্ম হবে।",
  );
  const [savingManualPayment, setSavingManualPayment] = useState(false);
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);

  // SMTP Health Check & Verified Sender State
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpVerifyResult, setSmtpVerifyResult] = useState<{
    ok: boolean;
    message: string;
    usesBrevoLoginFrom?: boolean;
  } | null>(null);
  const [emailFromNameInput, setEmailFromNameInput] = useState(
    analytics.settings.emailSettings?.fromName || initialStatus.emailFromName || "HayaNest BD",
  );
  const [emailFromEmailInput, setEmailFromEmailInput] = useState(
    analytics.settings.emailSettings?.fromEmail ||
      (initialStatus.emailFromEmail &&
      !initialStatus.emailFromEmail.toLowerCase().includes("@smtp-brevo.com")
        ? initialStatus.emailFromEmail
        : ""),
  );
  const [savingEmailSender, setSavingEmailSender] = useState(false);
  const [testEmailToInput, setTestEmailToInput] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // Live Fraud Check & Courier Dispatch State
  const [fraudCheckingPhone, setFraudCheckingPhone] = useState<string | null>(null);
  const [fraudResults, setFraudResults] = useState<{ [phone: string]: FraudCheckResult }>({});
  const [dispatchingOrderId, setDispatchingOrderId] = useState<string | null>(null);
  const [dispatchingTargetKey, setDispatchingTargetKey] = useState<string | null>(null);
  const [syncingCourierOrderId, setSyncingCourierOrderId] = useState<string | null>(null);
  const [rebuildingShipmentsOrderId, setRebuildingShipmentsOrderId] = useState<string | null>(null);
  const [shipmentDrafts, setShipmentDrafts] = useState<
    Record<
      string,
      {
        courierProvider?: CourierProvider | "manual";
        pickupHubId?: string;
        pathaoStoreId?: string;
        codAmount?: string;
        note?: string;
        manualTrackingCode?: string;
      }
    >
  >({});
  const [courierFeedback, setCourierFeedback] = useState<{ [orderId: string]: string }>({});

  // Facebook / Meta Pixel Configuration State
  const [fbPixelId, setFbPixelId] = useState(
    analytics.settings.facebookPixel?.pixelId ?? "",
  );
  const [fbPixelEnabled, setFbPixelEnabled] = useState(
    analytics.settings.facebookPixel?.enabled ?? true,
  );
  const [fbPixelTestMode, setFbPixelTestMode] = useState(
    analytics.settings.facebookPixel?.testMode ?? false,
  );
  const [fbPixelVerifiedAt, setFbPixelVerifiedAt] = useState<string | null>(
    analytics.settings.facebookPixel?.lastVerifiedAt ?? null,
  );
  const [fbVerifying, setFbVerifying] = useState(false);
  const [fbVerifyResult, setFbVerifyResult] = useState<{
    ok: boolean;
    message: string;
    testEventsUrl?: string;
  } | null>(null);
  const [fbSendingTestPing, setFbSendingTestPing] = useState(false);
  const [fbTestPingSent, setFbTestPingSent] = useState(false);

  // Hero Banner Carousel Editor State (3 Slides)
  const [heroSlides, setHeroSlides] = useState<
    [HeroBannerConfig, HeroBannerConfig, HeroBannerConfig]
  >(() =>
    buildHeroSlidesState(analytics.settings.heroSlides, analytics.settings.heroBanner),
  );
  const [activeBannerSlideIdx, setActiveBannerSlideIdx] = useState<0 | 1 | 2>(0);
  const currentBannerSlide = heroSlides[activeBannerSlideIdx] ?? heroSlides[0];
  const bannerTitle1 = currentBannerSlide.titleLine1;
  const bannerTitle2 = currentBannerSlide.titleLine2;
  const bannerSubtitle = currentBannerSlide.subtitle;
  const bannerCtaLabel = currentBannerSlide.ctaLabel;
  const bannerCtaHref = currentBannerSlide.ctaHref;
  const bannerImageSrc = currentBannerSlide.imageSrc;
  const bannerImageAlt = currentBannerSlide.imageAlt;
  const bannerImagePosition = currentBannerSlide.imagePosition;

  const updateCurrentBannerSlide = useCallback(
    (patch: Partial<HeroBannerConfig>) => {
      setHeroSlides(
        (prev) =>
          prev.map((slide, idx) =>
            idx === activeBannerSlideIdx ? { ...slide, ...patch } : slide,
          ) as [HeroBannerConfig, HeroBannerConfig, HeroBannerConfig],
      );
    },
    [activeBannerSlideIdx],
  );
  const setBannerTitle1 = (v: string) => updateCurrentBannerSlide({ titleLine1: v });
  const setBannerTitle2 = (v: string) => updateCurrentBannerSlide({ titleLine2: v });
  const setBannerSubtitle = (v: string) => updateCurrentBannerSlide({ subtitle: v });
  const setBannerCtaLabel = (v: string) => updateCurrentBannerSlide({ ctaLabel: v });
  const setBannerCtaHref = (v: string) => updateCurrentBannerSlide({ ctaHref: v });
  const setBannerImageSrc = (v: string) => updateCurrentBannerSlide({ imageSrc: v });
  const setBannerImageAlt = (v: string) => updateCurrentBannerSlide({ imageAlt: v });
  const setBannerImagePosition = (v: string) =>
    updateCurrentBannerSlide({ imagePosition: v });

  const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);

  // Flash Sale Timer & Expiry Control State
  const [flashSaleEnabled, setFlashSaleEnabled] = useState<boolean>(
    analytics.settings.flashSale?.enabled ?? true,
  );
  const [flashSaleEndsAtInput, setFlashSaleEndsAtInput] = useState<string>(() => {
    const raw = analytics.settings.flashSale?.endsAt;
    if (!raw) return "";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [flashSaleExpiredBehavior, setFlashSaleExpiredBehavior] = useState<
    "revert-prices" | "hide-section"
  >(analytics.settings.flashSale?.expiredBehavior ?? "revert-prices");
  const [flashSaleTitle, setFlashSaleTitle] = useState<string>(
    analytics.settings.flashSale?.title || "Flash Sale",
  );
  const [flashSaleBadge, setFlashSaleBadge] = useState<string>(
    analytics.settings.flashSale?.badge || "Limited Time Offer",
  );
  const [flashSaleSubtitle, setFlashSaleSubtitle] = useState<string>(
    analytics.settings.flashSale?.subtitle ||
      "Exclusive markdowns on signature drapes before the timer runs out.",
  );
  const [savingFlashSale, setSavingFlashSale] = useState(false);

  // Dynamic Catalog Taxonomy State (Categories, Fabrics & Colours with Color Picker)
  const [taxonomy, setTaxonomy] = useState<CatalogTaxonomy>(
    analytics.settings.taxonomy ?? DEFAULT_CATALOG_TAXONOMY,
  );
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [newCategoryHasFabric, setNewCategoryHasFabric] = useState(true);
  const [newCategoryImageSrc, setNewCategoryImageSrc] = useState("");
  const [newFabricLabel, setNewFabricLabel] = useState("");
  const [newColourLabel, setNewColourLabel] = useState("");
  const [newColourSwatch, setNewColourSwatch] = useState("#0f766e");
  const [savingTaxonomy, setSavingTaxonomy] = useState(false);
  const [uploadingTaxonomyKey, setUploadingTaxonomyKey] = useState<string | null>(null);

  // Dynamic Homepage Stories State
  const [storeStories, setStoreStories] = useState<Story[]>(
    analytics.settings.stories ?? defaultStories,
  );
  const [editingStoryId, setEditingStoryId] = useState("");
  const [storyLabel, setStoryLabel] = useState("");
  const [storyVideoSrc, setStoryVideoSrc] = useState<string>("");
  const [storyPhotoSrc, setStoryPhotoSrc] = useState<string>(photos.rose.src);
  const [storyAvatarSrc, setStoryAvatarSrc] = useState<string>("");
  const [storyHref, setStoryHref] = useState<string>("");
  const [savingStories, setSavingStories] = useState(false);

  const fetchAnalyticsData = useCallback(
    async (
      presetOverride?: DateRangePreset,
      startOverride?: string,
      endOverride?: string,
      forceFetch?: boolean,
    ) => {
      if (!authenticated && !forceFetch) return;
      setLoadingData(true);
      setApiError("");
      try {
        const activePreset = presetOverride ?? datePreset;
        const params = new URLSearchParams({ preset: activePreset });
        if (activePreset === "custom") {
          params.set("startDate", startOverride ?? customStart);
          params.set("endDate", endOverride ?? customEnd);
        }
        const res = await fetch(`/api/admin/analytics?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("Could not load dashboard analytics.");
        }
        const data = (await res.json()) as {
          analytics: DashboardAnalyticsResponse;
          products: AdminProductRecord[];
          orders: AdminOrderRecord[];
          reviews?: AdminReviewRecord[];
          registeredCustomers?: PublicCustomerAccount[];
          contactMessages?: ContactMessageRecord[];
        };
        setAnalytics(data.analytics);
        if (data.analytics?.settings) {
          const s = data.analytics.settings;
          setStoreNameInput(s.storeName);
          setTimezoneInput(s.timezone);
          setThresholdInput(String(s.lowStockThreshold));
          setTargetInput(s.monthlySalesTarget !== null ? String(s.monthlySalesTarget) : "");
          setInsideDhakaFeeInput(String(s.insideDhakaShippingFee));
          setOutsideDhakaFeeInput(String(s.outsideDhakaShippingFee));
          if (s.contactEmail !== undefined) setContactEmailInput(s.contactEmail);
          if (s.contactPhone !== undefined) setContactPhoneInput(s.contactPhone);
          if (s.contactLocation !== undefined) setContactLocationInput(s.contactLocation);
          if (s.socialLinks) {
            setFacebookUrlInput(s.socialLinks.facebook ?? "");
            setInstagramUrlInput(s.socialLinks.instagram ?? "");
            setYoutubeUrlInput(s.socialLinks.youtube ?? "");
            setTiktokUrlInput(s.socialLinks.tiktok ?? "");
          }
          if (s.facebookPixel) {
            setFbPixelId(s.facebookPixel.pixelId ?? "");
            setFbPixelEnabled(s.facebookPixel.enabled ?? true);
            setFbPixelTestMode(s.facebookPixel.testMode ?? false);
            setFbPixelVerifiedAt(s.facebookPixel.lastVerifiedAt ?? null);
          }
          if (s.courier) {
            setCourierProvider(s.courier.provider ?? "steadfast");
            setSteadfastEnabled(
              s.courier.steadfastEnabled ??
                Boolean(s.courier.steadfastApiKey?.trim() && s.courier.steadfastSecretKey?.trim()),
            );
            setSteadfastApiKey(s.courier.steadfastApiKey ?? "");
            setSteadfastSecretKey(s.courier.steadfastSecretKey ?? "");
            setSteadfastWebhookToken(s.courier.steadfastWebhookToken ?? "");
            setPathaoEnabled(
              s.courier.pathaoEnabled ??
                Boolean(s.courier.pathaoClientId?.trim() && s.courier.pathaoClientSecret?.trim()),
            );
            setPathaoClientId(s.courier.pathaoClientId ?? "");
            setPathaoClientSecret(s.courier.pathaoClientSecret ?? "");
            setPathaoUsername(s.courier.pathaoUsername ?? "");
            setPathaoPassword(s.courier.pathaoPassword ?? "");
            setPathaoStoreId(s.courier.pathaoStoreId ?? "");
            setPathaoWebhookSecret(s.courier.pathaoWebhookSecret ?? "");
            setDefaultInHouseCourier(s.courier.defaultInHouseCourier ?? "steadfast");
            setDefaultSupplierCourier(s.courier.defaultSupplierCourier ?? "pathao");
            setPickupHubs(
              Array.isArray(s.courier.pickupHubs) && s.courier.pickupHubs.length > 0
                ? s.courier.pickupHubs
                : getDefaultPickupHubs({
                    contactLocation: s.contactLocation,
                    contactPhone: s.contactPhone,
                    pathaoStoreId: s.courier.pathaoStoreId,
                    defaultInHouseCourier: s.courier.defaultInHouseCourier,
                    defaultSupplierCourier: s.courier.defaultSupplierCourier,
                  }),
            );
            setAutoFraudCheck(s.courier.autoFraudCheck ?? true);
            setCourierTestMode(s.courier.testMode ?? false);
          }
          if (s.manualPayment) {
            setBkashEnabled(s.manualPayment.bkash.enabled);
            setBkashNumber(s.manualPayment.bkash.accountNumber);
            setBkashType(s.manualPayment.bkash.accountType);
            setBkashInstruction(s.manualPayment.bkash.instruction ?? "");
            setNagadEnabled(s.manualPayment.nagad.enabled);
            setNagadNumber(s.manualPayment.nagad.accountNumber);
            setNagadType(s.manualPayment.nagad.accountType);
            setNagadInstruction(s.manualPayment.nagad.instruction ?? "");
            setManualPaymentNote(s.manualPayment.verificationNote ?? "");
          }
          if (s.emailSettings) {
            if (s.emailSettings.fromName !== undefined) {
              setEmailFromNameInput(s.emailSettings.fromName || "HayaNest BD");
            }
            if (s.emailSettings.fromEmail !== undefined && s.emailSettings.fromEmail.trim()) {
              setEmailFromEmailInput(s.emailSettings.fromEmail.trim());
            }
          }
          if (s.heroSlides || s.heroBanner) {
            setHeroSlides(buildHeroSlidesState(s.heroSlides, s.heroBanner));
          }
          if (s.flashSale) {
            setFlashSaleEnabled(s.flashSale.enabled);
            if (s.flashSale.endsAt) {
              const d = new Date(s.flashSale.endsAt);
              if (!Number.isNaN(d.getTime())) {
                const pad = (n: number) => String(n).padStart(2, "0");
                setFlashSaleEndsAtInput(
                  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
                );
              } else {
                setFlashSaleEndsAtInput("");
              }
            } else {
              setFlashSaleEndsAtInput("");
            }
            setFlashSaleExpiredBehavior(s.flashSale.expiredBehavior || "revert-prices");
            setFlashSaleTitle(s.flashSale.title || "Flash Sale");
            setFlashSaleBadge(s.flashSale.badge || "Limited Time Offer");
            setFlashSaleSubtitle(
              s.flashSale.subtitle ||
                "Exclusive markdowns on signature drapes before the timer runs out.",
            );
          }
          if (s.taxonomy) {
            setTaxonomy(s.taxonomy);
          }
          if (Array.isArray(s.stories) && s.stories.length > 0) {
            setStoreStories(s.stories);
          }
        }
        setProducts(data.products);
        setOrders(data.orders);
        if (Array.isArray(data.reviews)) {
          setReviews(data.reviews);
        }
        if (Array.isArray(data.registeredCustomers)) {
          setRegisteredCustomers(data.registeredCustomers);
        }
        if (Array.isArray(data.contactMessages)) {
          setContactMessages(data.contactMessages);
        }
      } catch (err) {
        setApiError(err instanceof Error ? err.message : "Failed to fetch analytics.");
      } finally {
        setLoadingData(false);
      }
    },
    [authenticated, datePreset, customStart, customEnd],
  );

  function handlePrintInvoice(order: AdminOrderRecord) {
    printOrderInvoice(order, {
      storeName: analytics.settings.storeName,
      contactEmail: analytics.settings.contactEmail,
      contactPhone: analytics.settings.contactPhone,
      contactLocation: analytics.settings.contactLocation,
    });
  }

  async function copyTextValue(keyId: string, text: string, label?: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeyId(keyId);
      if (label) {
        setFeedback(`${label} copied to clipboard!`);
      }
      window.setTimeout(() => {
        setCopiedKeyId((prev) => (prev === keyId ? null : prev));
      }, 2200);
    } catch {
      setFeedback("Clipboard access denied; please copy manually.");
    }
  }

  function getShipmentDraftKey(orderId: string, shipmentId: string) {
    return `${orderId}::${shipmentId}`;
  }

  function updateShipmentDraft(
    orderId: string,
    shipmentId: string,
    patch: {
      courierProvider?: CourierProvider | "manual";
      pickupHubId?: string;
      pathaoStoreId?: string;
      codAmount?: string;
      note?: string;
      manualTrackingCode?: string;
    },
  ) {
    const key = getShipmentDraftKey(orderId, shipmentId);
    setShipmentDrafts((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? {}),
        ...patch,
      },
    }));
  }

  async function handleDispatchCourier(
    order: AdminOrderRecord,
    options?: {
      shipment?: OrderShipment;
      dispatchAllPending?: boolean;
    },
  ) {
    const targetShipment = options?.shipment;
    const draft = targetShipment
      ? shipmentDrafts[getShipmentDraftKey(order.id, targetShipment.id)]
      : undefined;

    const targetKey = targetShipment ? `${order.id}::${targetShipment.id}` : order.id;
    setDispatchingOrderId(order.id);
    setDispatchingTargetKey(targetKey);

    try {
      const codNum =
        draft?.codAmount !== undefined && draft.codAmount.trim() !== ""
          ? Number(draft.codAmount)
          : undefined;

      const res = await fetch("/api/admin/courier/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          ...(targetShipment ? { shipmentId: targetShipment.id } : {}),
          ...(options?.dispatchAllPending ? { dispatchAllPending: true } : {}),
          ...(draft?.courierProvider ? { courierProvider: draft.courierProvider } : {}),
          ...(draft?.pickupHubId ? { pickupHubId: draft.pickupHubId } : {}),
          ...(draft?.pathaoStoreId ? { pathaoStoreId: draft.pathaoStoreId } : {}),
          ...(codNum !== undefined && !Number.isNaN(codNum) ? { codAmountOverride: codNum } : {}),
          ...(draft?.note?.trim() ? { noteOverride: draft.note.trim() } : {}),
          ...(draft?.manualTrackingCode?.trim()
            ? { manualTrackingCode: draft.manualTrackingCode.trim() }
            : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        success?: boolean;
        trackingCode?: string;
        consignmentId?: string;
        order?: AdminOrderRecord | null;
        message?: string;
        error?: string;
      };

      if (res.ok && (data.ok || data.success)) {
        const msg =
          data.message ||
          `Dispatched! Tracking: ${data.trackingCode || data.consignmentId || "Generated"}`;
        if (data.order) {
          const updated = data.order;
          setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
          setSelectedOrder((prev) => (prev && prev.id === order.id ? updated : prev));
        }
        setCourierFeedback((prev) => ({ ...prev, [order.id]: msg }));
        setFeedback(`Order ${order.id}: ${msg}`);
        await fetchAnalyticsData();
      } else {
        const errMsg = data.error || data.message || "Failed to dispatch parcel.";
        setCourierFeedback((prev) => ({ ...prev, [order.id]: errMsg }));
        setFeedback(errMsg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error dispatching to courier.";
      setCourierFeedback((prev) => ({ ...prev, [order.id]: msg }));
      setFeedback(msg);
    } finally {
      setDispatchingOrderId(null);
      setDispatchingTargetKey(null);
    }
  }

  async function handleRebuildShipments(
    order: AdminOrderRecord,
    action: "split-auto" | "combine-single",
  ) {
    setRebuildingShipmentsOrderId(order.id);
    try {
      const res = await fetch("/api/admin/courier/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, action }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        order?: AdminOrderRecord | null;
        message?: string;
        error?: string;
      };
      if (res.ok && data.ok) {
        if (data.order) {
          const updated = data.order;
          setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
          setSelectedOrder((prev) => (prev && prev.id === order.id ? updated : prev));
        }
        setCourierFeedback((prev) => ({
          ...prev,
          [order.id]: data.message || "Shipments reorganized.",
        }));
        setFeedback(data.message || "Order parcels updated.");
        await fetchAnalyticsData();
      } else {
        const errMsg = data.error || data.message || "Could not update order split layout.";
        setCourierFeedback((prev) => ({ ...prev, [order.id]: errMsg }));
        setFeedback(errMsg);
      }
    } catch {
      setFeedback("Network error while updating order shipments.");
    } finally {
      setRebuildingShipmentsOrderId(null);
    }
  }

  async function handleSyncCourierStatus(order: AdminOrderRecord, shipmentId?: string) {
    setSyncingCourierOrderId(order.id);
    try {
      const res = await fetch("/api/admin/courier/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, ...(shipmentId ? { shipmentId } : {}) }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        updatedCount?: number;
        order?: AdminOrderRecord | null;
        message?: string;
      };
      if (res.ok && data.ok) {
        if (data.order) {
          const updated = data.order;
          setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
          setSelectedOrder((prev) => (prev && prev.id === order.id ? updated : prev));
        }
        const msg = data.message || "Courier status synced.";
        setCourierFeedback((prev) => ({ ...prev, [order.id]: msg }));
        setFeedback(`Order ${order.id}: ${msg}`);
        if ((data.updatedCount ?? 0) > 0) {
          await fetchAnalyticsData();
        }
      } else {
        const errMsg = data.message || "Could not sync courier status.";
        setCourierFeedback((prev) => ({ ...prev, [order.id]: errMsg }));
        setFeedback(errMsg);
      }
    } catch {
      setFeedback("Network error syncing courier status.");
    } finally {
      setSyncingCourierOrderId(null);
    }
  }

  function formatSupplierPickupSlip(order: AdminOrderRecord, pkg: OrderShipment): string {
    const itemLines = pkg.items
      .map((it) => `- ${it.quantity}x ${it.name}${it.colour ? ` (${it.colour})` : ""}`)
      .join("\n");
    const courierTitle =
      pkg.courierProvider === "pathao"
        ? "Pathao Courier"
        : pkg.courierProvider === "manual"
          ? "Local Courier"
          : "Steadfast Courier";
    return [
      `📦 HayaNest BD — Supplier Pickup / Dispatch Slip`,
      `Order Ref: #${pkg.invoiceRef || order.id}`,
      `Courier: ${courierTitle}`,
      `Consignment / Tracking: ${pkg.trackingCode || pkg.consignmentId || "Pending booking"}`,
      `Pickup Hub: ${pkg.pickupHubName || "Supplier Hub"}${pkg.pickupAddress ? ` (${pkg.pickupAddress})` : ""}`,
      `Items to Pack:`,
      itemLines,
      `Customer: ${order.customer.name} · ${order.customer.phone}`,
      `Delivery Address: ${order.customer.address}, ${order.customer.city}`,
      `COD Amount: ৳${pkg.codAmount}`,
    ].join("\n");
  }

  async function handleFetchPathaoStores() {
    setLoadingPathaoStores(true);
    setPathaoStoreMessage(null);
    try {
      const res = await fetch("/api/admin/courier/pathao/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathaoClientId: pathaoClientId.trim(),
          pathaoClientSecret: pathaoClientSecret.trim(),
          pathaoUsername: pathaoUsername.trim(),
          pathaoPassword: pathaoPassword.trim(),
          testMode: courierTestMode,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        stores?: PathaoStoreSummary[];
        message?: string;
      };
      if (res.ok && data.ok) {
        const list = Array.isArray(data.stores) ? data.stores : [];
        setPathaoStores(list);
        const defaultStore = list.find((st) => st.isDefaultStore) ?? list[0];
        if (!pathaoStoreId.trim() && defaultStore) {
          setPathaoStoreId(String(defaultStore.storeId));
        }
        setPathaoStoreMessage({
          ok: true,
          text: data.message || `Loaded ${list.length} approved Pathao pickup store(s).`,
        });
      } else {
        setPathaoStoreMessage({
          ok: false,
          text: data.message || "Could not connect to Pathao API. Verify credentials.",
        });
      }
    } catch {
      setPathaoStoreMessage({
        ok: false,
        text: "Network error while verifying Pathao credentials.",
      });
    } finally {
      setLoadingPathaoStores(false);
    }
  }

  function handleAddPickupHub(source: FulfillmentSource) {
    const countOfSource = pickupHubs.filter((h) => h.source === source).length + 1;
    const newHub: PickupHubConfig = {
      id: `${source === "supplier" ? "supplier" : "own"}-${Date.now().toString(36)}`,
      name:
        source === "supplier"
          ? `Supplier Partner Hub #${countOfSource}`
          : `Own Warehouse Hub #${countOfSource}`,
      source,
      contactName: "",
      phone: "",
      address: "",
      preferredCourier: source === "supplier" ? defaultSupplierCourier : defaultInHouseCourier,
      pathaoStoreId: source === "in-house" ? pathaoStoreId.trim() : "",
      steadfastPickupNote: source === "supplier" ? "Pickup directly from Supplier Shop" : "",
      isDefault: pickupHubs.filter((h) => h.source === source).length === 0,
    };
    setPickupHubs((prev) => [...prev, newHub]);
  }

  function handleUpdatePickupHub(hubId: string, patch: Partial<PickupHubConfig>) {
    setPickupHubs((prev) => {
      const target = prev.find((h) => h.id === hubId);
      const nextSource = patch.source ?? target?.source ?? "in-house";
      return prev.map((hub) => {
        if (hub.id === hubId) {
          return { ...hub, ...patch };
        }
        if (patch.isDefault && hub.source === nextSource) {
          return { ...hub, isDefault: false };
        }
        return hub;
      });
    });
  }

  function handleRemovePickupHub(hubId: string) {
    setPickupHubs((prev) => (prev.length <= 1 ? prev : prev.filter((h) => h.id !== hubId)));
  }

  async function handleCheckFraud(phone: string) {
    if (!phone) return;
    setFraudCheckingPhone(phone);
    try {
      const res = await fetch(`/api/admin/courier/fraud-check?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (res.ok && data.result) {
        setFraudResults((prev) => ({ ...prev, [phone]: data.result }));
      }
    } catch (err) {
      console.error("Fraud check failed:", err);
    } finally {
      setFraudCheckingPhone(null);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setLoginBusy(true);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setLoginError(data.error || "Invalid admin credentials.");
        return;
      }
      setAuthenticated(true);
      setLoginPassword("");
      void fetchAnalyticsData(datePreset, customStart, customEnd, true);
    } catch {
      setLoginError("Could not connect to server.");
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthenticated(false);
  }

  function handleSetPrimaryPhoto(index: number) {
    if (index <= 0 || index >= galleryPhotos.length) return;
    const target = galleryPhotos[index];
    const rest = galleryPhotos.filter((_, idx) => idx !== index);
    const updated = [target, ...rest];
    setGalleryPhotos(updated);
    setImageSrc(target.src);
    setImageAlt(target.alt || name || "Product photo");
    if (target.colour) {
      setColour(target.colour);
    }
  }

  function handleSetPhotoColour(index: number, newColour: ProductColour) {
    setGalleryPhotos((prev) =>
      prev.map((p, idx) => (idx === index ? { ...p, colour: newColour } : p)),
    );
    if (index === 0) {
      setColour(newColour);
    }
  }

  function handleRemovePhoto(index: number) {
    const updated = galleryPhotos.filter((_, idx) => idx !== index);
    if (updated.length === 0) {
      setGalleryPhotos([{ src: photos.rose.src, alt: photos.rose.alt, colour: colour || "rose" }]);
      setImageSrc(photos.rose.src);
      setImageAlt(photos.rose.alt);
    } else {
      setGalleryPhotos(updated);
      if (index === 0) {
        setImageSrc(updated[0].src);
        setImageAlt(updated[0].alt || name || "Product photo");
        if (updated[0].colour) {
          setColour(updated[0].colour);
        }
      }
    }
  }

  async function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setUploadingImage(true);
    setFeedback("");
    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("file", file);
      }
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as {
        url?: string;
        urls?: string[];
        photos?: Photo[];
        mode?: string;
        error?: string;
      };
      if (!res.ok || (!data.url && (!data.urls || data.urls.length === 0))) {
        setFeedback(`Upload error: ${data.error || "Failed to upload image(s)"}`);
        return;
      }

      const availableColours = taxonomy.colours.map((c) => c.value);
      const isInitialDefault =
        galleryPhotos.length === 1 && galleryPhotos[0].src === photos.rose.src;
      const alreadyAssigned = new Set<string>(
        isInitialDefault ? [] : galleryPhotos.map((p) => p.colour || colour),
      );

      let unusedIndex = 0;
      function pickColourForFile(fname: string, fallback: ProductColour): ProductColour {
        const lower = fname.toLowerCase();
        for (const c of taxonomy.colours) {
          if (
            lower.includes(c.value.toLowerCase()) ||
            lower.includes(c.label.toLowerCase())
          ) {
            alreadyAssigned.add(c.value);
            return c.value;
          }
        }
        while (unusedIndex < availableColours.length) {
          const candidate = availableColours[unusedIndex];
          unusedIndex++;
          if (!alreadyAssigned.has(candidate)) {
            alreadyAssigned.add(candidate);
            return candidate;
          }
        }
        return fallback;
      }

      const uploadedPhotos: Photo[] = [];
      if (Array.isArray(data.photos) && data.photos.length > 0) {
        for (let i = 0; i < data.photos.length; i++) {
          const p = data.photos[i];
          if (p?.src) {
            const fname = files[i]?.name || "";
            const assignedColour = i === 0 && isInitialDefault
              ? colour
              : pickColourForFile(fname, colour);
            uploadedPhotos.push({
              ...p,
              colour: assignedColour,
            });
          }
        }
      } else if (Array.isArray(data.urls) && data.urls.length > 0) {
        for (let i = 0; i < data.urls.length; i++) {
          const u = data.urls[i];
          const fname =
            files[i]?.name?.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") ||
            (name ? `${name} photo ${i + 1}` : "Product photo");
          const assignedColour = i === 0 && isInitialDefault
            ? colour
            : pickColourForFile(files[i]?.name || "", colour);
          uploadedPhotos.push({
            src: u,
            alt: fname,
            colour: assignedColour,
          });
        }
      } else if (data.url) {
        const fname =
          files[0]?.name?.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") ||
          (name ? `${name} studio product photo` : "Product photo");
        uploadedPhotos.push({
          src: data.url,
          alt: fname,
          colour: pickColourForFile(files[0]?.name || "", colour),
        });
      }

      if (uploadedPhotos.length > 0) {
        setGalleryPhotos((prev) => {
          const nextGallery = isInitialDefault
            ? uploadedPhotos
            : [...prev, ...uploadedPhotos];
          if (nextGallery[0]) {
            setImageSrc(nextGallery[0].src);
            setImageAlt(nextGallery[0].alt || name || "Product photo");
            if (nextGallery[0].colour) {
              setColour(nextGallery[0].colour);
            }
          }
          return nextGallery;
        });

        setFeedback(
          uploadedPhotos.length > 1
            ? `${uploadedPhotos.length} product photos uploaded and mapped to color variants!`
            : data.mode === "cloudinary"
            ? "Picture uploaded & optimized on Cloudinary CDN (WebP/AVIF)!"
            : "Picture uploaded to local storage (/uploads)!",
        );
      }
    } catch {
      setFeedback("Failed to upload image file(s).");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  }

  function resetProductForm() {
    setEditingId("");
    setSku("");
    setName("");
    setPrice("650");
    setOriginalPrice("");
    setCostPrice("");
    setProductStatus("active");
    setDescription(
      "A soft, fluid drape for everyday styling. Breathable comfort from morning to evening.",
    );
    setCategory("hijabs");
    setFabric("modal");
    setColour("rose");
    setStock("12");
    setLowStockThreshold(String(analytics.settings.lowStockThreshold || 5));
    setMaterial("Modal");
    setSize("180 × 70 cm");
    setImageSrc(photos.rose.src);
    setImageAlt(photos.rose.alt);
    setGalleryPhotos([{ src: photos.rose.src, alt: photos.rose.alt, colour: "rose" }]);
    setSections(["new-items"]);
    setProductFulfillmentSource("in-house");
    setProductPickupHubId(
      resolvePickupHubForSource(pickupHubs, "in-house", undefined, analytics.settings.courier).id,
    );
  }

  function openEditProduct(product: AdminProductRecord) {
    const resolvedSource: FulfillmentSource =
      product.fulfillmentSource === "supplier" ? "supplier" : "in-house";
    const resolvedHubId =
      product.pickupHubId?.trim() ||
      resolvePickupHubForSource(pickupHubs, resolvedSource, undefined, analytics.settings.courier).id;
    setEditingId(product.id);
    setSku(product.sku);
    setName(product.name);
    setPrice(String(product.price));
    setOriginalPrice(product.originalPrice ? String(product.originalPrice) : "");
    setCostPrice(product.costPrice !== null ? String(product.costPrice) : "");
    setProductStatus(product.status);
    setDescription(product.description ?? product.details.description);
    setCategory(product.category);
    setFabric(product.fabric ?? "modal");
    setColour(product.colour);
    setStock(String(product.stock));
    setLowStockThreshold(String(product.lowStockThreshold ?? 5));
    setMaterial(product.details.material);
    setSize(product.details.size);
    setImageSrc(product.photo.src);
    setImageAlt(product.photo.alt);

    const existingGallery: Photo[] = [];
    for (const v of product.details?.variants ?? []) {
      for (const p of v.gallery ?? []) {
        if (p?.src && !existingGallery.some((item) => item.src === p.src)) {
          existingGallery.push({
            ...p,
            colour: p.colour || v.colour,
          });
        }
      }
    }
    if (product.photo?.src && !existingGallery.some((item) => item.src === product.photo.src)) {
      existingGallery.unshift({
        ...product.photo,
        colour: product.colour,
      });
    }

    setGalleryPhotos(
      existingGallery.length > 0
        ? existingGallery
        : [{ src: product.photo.src, alt: product.photo.alt, colour: product.colour }],
    );

    setSections(product.sections);
    setProductFulfillmentSource(resolvedSource);
    setProductPickupHubId(resolvedHubId);
    setActiveSection("products");
    setShowProductFormModal(true);
  }

  async function handleSaveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProduct(true);
    setFeedback("");

    let resolvedColour = colour;
    const pendingColourLabel = newColourLabel.trim();
    if (pendingColourLabel) {
      const pendingColourValue = toSlugKey(pendingColourLabel);
      if (pendingColourValue) {
        resolvedColour = pendingColourValue;
        const swatch = newColourSwatch.trim() || "#0f766e";
        const existingIdx = taxonomy.colours.findIndex((c) => c.value === pendingColourValue);
        const nextColours =
          existingIdx >= 0
            ? taxonomy.colours.map((c, idx) =>
                idx === existingIdx ? { value: pendingColourValue, label: pendingColourLabel, swatch } : c,
              )
            : [...taxonomy.colours, { value: pendingColourValue, label: pendingColourLabel, swatch }];
        setNewColourLabel("");
        setColour(pendingColourValue);
        setTaxonomy({ ...taxonomy, colours: nextColours });
        try {
          await fetch("/api/admin/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taxonomy: { ...taxonomy, colours: nextColours } }),
          });
        } catch {
          // upsertStoreProduct also auto-registers custom colour
        }
      }
    }

    const selectedCatMeta = taxonomy.categories.find((c) => c.value === category);
    const categoryUsesFabric = selectedCatMeta
      ? selectedCatMeta.hasFabric !== false
      : category !== "accessories";

    const payload: AdminProductInput = {
      ...(editingId ? { id: editingId } : {}),
      ...(sku.trim() ? { sku: sku.trim() } : {}),
      name: name.trim(),
      description: description.trim(),
      price: Number(price) || 0,
      originalPrice: originalPrice ? Number(originalPrice) : null,
      costPrice: costPrice.trim() !== "" ? Number(costPrice) : null,
      status: productStatus,
      category,
      fabric: !categoryUsesFabric || !fabric ? null : fabric,
      colour: resolvedColour,
      stock: Number(stock) || 0,
      lowStockThreshold: Number(lowStockThreshold) || 5,
      material: material.trim(),
      size: size.trim(),
      imageSrc: imageSrc.trim(),
      imageAlt: imageAlt.trim() || name.trim(),
      galleryImages: galleryPhotos.filter((p) => p.src.trim().length > 0),
      sections,
      fulfillmentSource: productFulfillmentSource,
      pickupHubId: productPickupHubId.trim() || undefined,
    };

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        product?: AdminProductRecord;
        storage?: "supabase" | "local";
        error?: string;
      };
      if (!res.ok || !data.product) {
        setFeedback(`Error: ${data.error || "Could not save product."}`);
        return;
      }
      await fetchAnalyticsData();
      setFeedback(
        `Product "${data.product.name}" saved to ${
          data.storage === "supabase" ? "Supabase PostgreSQL" : "Store"
        }!`,
      );
      setShowProductFormModal(false);
      resetProductForm();
    } catch {
      setFeedback("Network error while saving product.");
    } finally {
      setSavingProduct(false);
    }
  }

  async function handleDeleteProduct(id: string, title: string) {
    if (!window.confirm(`Delete "${title}" from the catalog?`)) return;
    setFeedback("");
    try {
      const res = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchAnalyticsData();
        setFeedback(`Deleted "${title}".`);
      }
    } catch {
      setFeedback("Failed to delete product.");
    }
  }

  async function handleSeedSupabase() {
    setSeedingSupabase(true);
    setFeedback("");
    try {
      const res = await fetch("/api/admin/products", { method: "PUT" });
      const data = (await res.json()) as { count?: number; error?: string };
      if (!res.ok) {
        setFeedback(`Supabase Sync Note: ${data.error}`);
        return;
      }
      await fetchAnalyticsData();
      setFeedback(`Synced ${data.count} products to Supabase PostgreSQL!`);
    } catch {
      setFeedback("Could not sync to Supabase.");
    } finally {
      setSeedingSupabase(false);
    }
  }

  async function handleUpdateOrder(patch: {
    id: string;
    status?: AdminOrderStatus;
    paymentStatus?: AdminPaymentStatus;
    deliveryStatus?: AdminDeliveryStatus;
    refundAmount?: number;
  }) {
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json().catch(() => ({}))) as {
        order?: AdminOrderRecord;
        error?: string;
      };
      if (res.ok) {
        if (data.order) {
          const updatedOrder = data.order;
          setOrders((prev) => prev.map((o) => (o.id === patch.id ? updatedOrder : o)));
          setSelectedOrder((prev) => (prev && prev.id === patch.id ? updatedOrder : prev));
          const customerMeta = getCustomerFacingStatusMeta(updatedOrder);
          const deliveryMeta = getAdminDeliveryPillMeta(updatedOrder);
          await fetchAnalyticsData();
          setFeedback(
            `Order ${patch.id} updated → ${customerMeta.label} (${deliveryMeta.label}).`,
          );
          return;
        }
        await fetchAnalyticsData();
        setFeedback(`Order ${patch.id} updated.`);
      } else {
        setFeedback(data.error || `Failed to update order ${patch.id}.`);
      }
    } catch {
      setFeedback("Failed to update order.");
    }
  }

  async function handleVerifyManualPayment(orderId: string, confirmOrder = true) {
    setVerifyingOrderId(orderId);
    try {
      await handleUpdateOrder({
        id: orderId,
        paymentStatus: "Paid",
        ...(confirmOrder ? { status: "Confirmed" } : {}),
      });
      setFeedback(
        confirmOrder
          ? `Payment verified (Paid) & Order ${orderId} confirmed!`
          : `Order ${orderId} payment marked Paid.`,
      );
    } finally {
      setVerifyingOrderId(null);
    }
  }

  async function handleSaveManualPaymentSettings(event?: FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();
    setSavingManualPayment(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manualPayment: {
            bkash: {
              enabled: bkashEnabled,
              accountNumber: bkashNumber.trim(),
              accountType: bkashType,
              instruction: bkashInstruction.trim(),
            },
            nagad: {
              enabled: nagadEnabled,
              accountNumber: nagadNumber.trim(),
              accountType: nagadType,
              instruction: nagadInstruction.trim(),
            },
            verificationNote: manualPaymentNote.trim(),
          },
        }),
      });
      if (res.ok) {
        await fetchAnalyticsData();
        setFeedback("Manual bKash & Nagad payment numbers and instructions saved live to Checkout!");
      } else {
        setFeedback("Failed to save manual payment settings.");
      }
    } catch {
      setFeedback("Network error while saving manual payment settings.");
    } finally {
      setSavingManualPayment(false);
    }
  }

  async function handleTestSmtpConnection() {
    setSmtpTesting(true);
    setSmtpVerifyResult(null);
    try {
      const res = await fetch("/api/admin/integrations/smtp-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        usesBrevoLoginFrom?: boolean;
      };
      setSmtpVerifyResult({
        ok: Boolean(res.ok && data.ok),
        message: data.message || "Could not verify SMTP connection.",
        usesBrevoLoginFrom: data.usesBrevoLoginFrom,
      });
    } catch {
      setSmtpVerifyResult({
        ok: false,
        message: "Network error while checking SMTP connection.",
      });
    } finally {
      setSmtpTesting(false);
    }
  }

  async function handleSaveEmailSender(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = emailFromEmailInput.trim().toLowerCase();
    if (cleanEmail && cleanEmail.endsWith("@smtp-brevo.com")) {
      setSmtpVerifyResult({
        ok: false,
        usesBrevoLoginFrom: true,
        message:
          "Do not use @smtp-brevo.com as Sender (From). Enter your real verified Gmail or domain email added in Brevo -> Senders, Domains & IPs.",
      });
      return;
    }
    if (cleanEmail && (!cleanEmail.includes("@") || !cleanEmail.includes("."))) {
      setSmtpVerifyResult({
        ok: false,
        message: "Please enter a valid sender email address (e.g. yourname@gmail.com or no-reply@yourdomain.com).",
      });
      return;
    }
    setSavingEmailSender(true);
    setSmtpVerifyResult(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailSettings: {
            fromName: emailFromNameInput.trim() || "HayaNest BD",
            fromEmail: cleanEmail,
          },
        }),
      });
      if (!res.ok) {
        setSmtpVerifyResult({ ok: false, message: "Could not save sender email settings." });
        return;
      }
      await fetchAnalyticsData();
      const verifyRes = await fetch("/api/admin/integrations/smtp-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      });
      const verifyData = (await verifyRes.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        usesBrevoLoginFrom?: boolean;
      };
      setSmtpVerifyResult({
        ok: Boolean(verifyRes.ok && verifyData.ok),
        message:
          verifyData.message ||
          (cleanEmail
            ? `Saved Verified Sender <${cleanEmail}> live! Make sure this address is verified in Brevo.`
            : "Cleared custom sender override; using .env.local SMTP_FROM."),
        usesBrevoLoginFrom: verifyData.usesBrevoLoginFrom,
      });
      setFeedback("Transactional email sender saved live!");
    } catch {
      setSmtpVerifyResult({ ok: false, message: "Network error while saving sender email." });
    } finally {
      setSavingEmailSender(false);
    }
  }

  async function handleSendTestEmail() {
    const cleanTo = testEmailToInput.trim().toLowerCase();
    if (!cleanTo || !cleanTo.includes("@") || !cleanTo.includes(".")) {
      setSmtpVerifyResult({
        ok: false,
        message: "Enter a valid recipient email address to send a test email.",
      });
      return;
    }
    setSendingTestEmail(true);
    setSmtpVerifyResult(null);
    try {
      const res = await fetch("/api/admin/integrations/smtp-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send-test", to: cleanTo }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      setSmtpVerifyResult({
        ok: Boolean(res.ok && data.ok),
        message: data.message || "Failed to send test email.",
      });
    } catch {
      setSmtpVerifyResult({
        ok: false,
        message: "Network error while sending test email.",
      });
    } finally {
      setSendingTestEmail(false);
    }
  }

  async function handleCreateManualOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetProduct = products.find((p) => p.id === manualProductId);
    if (!targetProduct) return;

    setCreatingManualOrder(true);
    try {
      const qty = Math.max(1, Math.round(Number(manualQty) || 1));
      const subtotal = targetProduct.price * qty;
      const shippingFee =
        manualZone === "inside-dhaka"
          ? analytics.settings.insideDhakaShippingFee
          : analytics.settings.outsideDhakaShippingFee;
      const orderPayload = {
        id: `HN-${String(Date.now()).slice(-6)}`,
        createdAt: new Date().toISOString(),
        customer: {
          name: manualCustomerName.trim(),
          phone: manualCustomerPhone.trim(),
          address: manualCustomerAddress.trim(),
          city: manualCustomerCity.trim() || "Dhaka",
        },
        deliveryZone: manualZone,
        paymentMethod: manualPaymentMethod,
        ...(manualPaymentMethod !== "cod" && manualPaymentPhone.trim()
          ? { paymentPhone: manualPaymentPhone.trim() }
          : {}),
        ...(manualPaymentMethod !== "cod" && manualPaymentTrxId.trim()
          ? { paymentTrxId: manualPaymentTrxId.trim().toUpperCase() }
          : {}),
        items: [
          {
            id: targetProduct.id,
            slug: targetProduct.slug,
            name: targetProduct.name,
            price: targetProduct.price,
            quantity: qty,
            photo: { src: targetProduct.photo.src, alt: targetProduct.photo.alt },
          },
        ],
        subtotal,
        shippingFee,
        total: subtotal + shippingFee,
        status: "Confirmed" as const,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setShowManualOrderModal(false);
        setManualCustomerName("");
        setManualCustomerPhone("");
        setManualCustomerAddress("");
        setManualPaymentPhone("");
        setManualPaymentTrxId("");
        setManualQty("1");
        await fetchAnalyticsData();
        setFeedback(`Order ${orderPayload.id} recorded and metrics updated!`);
      } else {
        setFeedback(data.error || "Could not record order.");
      }
    } catch {
      setFeedback("Could not record order.");
    } finally {
      setCreatingManualOrder(false);
    }
  }

  async function handleSaveVariantStock(row: VariantInventoryRow) {
    const draft = variantDrafts[row.variantKey];
    const nextStock = draft?.stock !== undefined ? Number(draft.stock) : row.stock;
    const nextCost =
      draft?.costPrice !== undefined
        ? draft.costPrice.trim() === ""
          ? null
          : Number(draft.costPrice)
        : row.costPrice;

    setSavingVariantKey(row.variantKey);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: row.productId,
          colour: row.colour,
          stock: nextStock,
          costPrice: nextCost,
        }),
      });
      if (res.ok) {
        await fetchAnalyticsData();
        setFeedback(`Updated inventory for ${row.productName} (${row.colour}).`);
      }
    } catch {
      setFeedback("Failed to update variant inventory.");
    } finally {
      setSavingVariantKey(null);
    }
  }

  async function handleCreateCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!couponCode.trim()) return;
    setSavingCoupon(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode,
          description: couponDesc,
          discountType: couponType,
          discountValue: Number(couponValue),
          minOrderAmount: Number(couponMinOrder),
          active: true,
        }),
      });
      if (res.ok) {
        setCouponCode("");
        setCouponDesc("");
        await fetchAnalyticsData();
        setFeedback("Discount coupon saved!");
      }
    } finally {
      setSavingCoupon(false);
    }
  }

  async function handleToggleCoupon(coupon: DashboardAnalyticsResponse["coupons"][number]) {
    await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...coupon,
        active: !coupon.active,
      }),
    });
    await fetchAnalyticsData();
  }

  async function handleDeleteCoupon(id: string) {
    await fetch(`/api/admin/coupons?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await fetchAnalyticsData();
  }

  function buildCourierPayload() {
    const sfReady = Boolean(steadfastApiKey.trim() && steadfastSecretKey.trim());
    const pathaoReady = Boolean(
      pathaoClientId.trim() &&
        pathaoClientSecret.trim() &&
        pathaoUsername.trim() &&
        pathaoPassword.trim(),
    );
    const effectiveSteadfastEnabled = steadfastEnabled || sfReady;
    const effectivePathaoEnabled = pathaoEnabled || pathaoReady;
    return {
      provider: courierProvider,
      enabled: Boolean(effectiveSteadfastEnabled || effectivePathaoEnabled),
      steadfastEnabled: effectiveSteadfastEnabled,
      steadfastApiKey: steadfastApiKey.trim(),
      steadfastSecretKey: steadfastSecretKey.trim(),
      steadfastWebhookToken: steadfastWebhookToken.trim(),
      pathaoEnabled: effectivePathaoEnabled,
      pathaoClientId: pathaoClientId.trim(),
      pathaoClientSecret: pathaoClientSecret.trim(),
      pathaoUsername: pathaoUsername.trim(),
      pathaoPassword: pathaoPassword.trim(),
      pathaoStoreId: pathaoStoreId.trim(),
      pathaoWebhookSecret: pathaoWebhookSecret.trim(),
      defaultInHouseCourier,
      defaultSupplierCourier,
      pickupHubs: pickupHubs.map((hub, idx) => ({
        ...hub,
        id:
          hub.id.trim() ||
          `${hub.source === "supplier" ? "supplier" : "own"}-${idx + 1}`,
        name: hub.name.trim() || (hub.source === "supplier" ? "Supplier Hub" : "Own Stock"),
        address: hub.address.trim() || "Dhaka, Bangladesh",
        phone: hub.phone?.trim() || "",
        contactName: hub.contactName?.trim() || "",
        pathaoStoreId: hub.pathaoStoreId?.trim() || "",
        steadfastPickupNote: hub.steadfastPickupNote?.trim() || "",
      })),
      autoFraudCheck,
      testMode: courierTestMode,
    };
  }

  async function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName: storeNameInput.trim() || "HayaNest BD",
          timezone: timezoneInput.trim() || "Asia/Dhaka",
          lowStockThreshold: Number(thresholdInput) || 5,
          monthlySalesTarget: targetInput.trim() !== "" ? Number(targetInput) : null,
          insideDhakaShippingFee: Number(insideDhakaFeeInput) || 70,
          outsideDhakaShippingFee: Number(outsideDhakaFeeInput) || 130,
          contactEmail: contactEmailInput.trim(),
          contactPhone: contactPhoneInput.trim(),
          contactLocation: contactLocationInput.trim(),
          socialLinks: {
            facebook: facebookUrlInput.trim(),
            instagram: instagramUrlInput.trim(),
            youtube: youtubeUrlInput.trim(),
            tiktok: tiktokUrlInput.trim(),
          },
          facebookPixel: {
            pixelId: fbPixelId.trim().replace(/[^\d]/g, ""),
            enabled: fbPixelEnabled,
            testMode: fbPixelTestMode,
            lastVerifiedAt: fbPixelVerifiedAt,
          },
          courier: buildCourierPayload(),
        }),
      });
      if (res.ok) {
        await fetchAnalyticsData();
        setFeedback("Store settings, Courier & Meta Pixel configuration saved!");
      }
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleAdminPasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminPwMessage(null);

    if (adminNewPassword !== adminConfirmPassword) {
      setAdminPwMessage({ text: "New password and confirmation do not match.", type: "error" });
      return;
    }

    if (adminNewPassword.length < 6) {
      setAdminPwMessage({ text: "New password must be at least 6 characters long.", type: "error" });
      return;
    }

    setAdminPwLoading(true);
    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: adminCurrentPassword,
          newPassword: adminNewPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setAdminPwMessage({ text: data.error || "Failed to update password.", type: "error" });
      } else {
        setAdminPwMessage({ text: "Admin password updated successfully!", type: "success" });
        setAdminCurrentPassword("");
        setAdminNewPassword("");
        setAdminConfirmPassword("");
        setFeedback("Master admin password updated successfully!");
      }
    } catch {
      setAdminPwMessage({ text: "Network connection error. Please try again.", type: "error" });
    } finally {
      setAdminPwLoading(false);
    }
  }

  async function handleSaveCourierSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courier: buildCourierPayload(),
        }),
      });
      if (res.ok) {
        await fetchAnalyticsData();
        setFeedback("Steadfast, Pathao, Webhook & Pickup Hub settings saved successfully!");
      } else {
        setFeedback("Failed to save courier settings.");
      }
    } catch {
      setFeedback("Failed to save courier settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSaveMetaPixel() {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facebookPixel: {
            pixelId: fbPixelId.trim().replace(/[^\d]/g, ""),
            enabled: fbPixelEnabled,
            testMode: fbPixelTestMode,
            lastVerifiedAt: fbPixelVerifiedAt,
          },
        }),
      });
      if (res.ok) {
        await fetchAnalyticsData();
        setFeedback("Meta Pixel configuration saved successfully!");
      }
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleVerifyFacebookPixel() {
    const cleanId = fbPixelId.trim().replace(/[^\d]/g, "");
    if (!cleanId) {
      setFbVerifyResult({
        ok: false,
        message: "Please enter your 14–17 digit Meta Pixel ID before verifying.",
      });
      return;
    }
    setFbVerifying(true);
    setFbVerifyResult(null);
    try {
      const res = await fetch("/api/admin/pixel/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pixelId: cleanId,
          enabled: fbPixelEnabled,
          testMode: fbPixelTestMode,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setFbPixelId(data.pixelId);
        setFbPixelVerifiedAt(data.verifiedAt);
        setFbVerifyResult({
          ok: true,
          message: data.message || "Meta Pixel ID verified successfully!",
          testEventsUrl: data.testEventsUrl,
        });
        await fetchAnalyticsData();
      } else {
        setFbVerifyResult({
          ok: false,
          message: data.error || "Failed to verify Meta Pixel ID.",
        });
      }
    } catch {
      setFbVerifyResult({
        ok: false,
        message: "Network error while connecting to Meta verification API.",
      });
    } finally {
      setFbVerifying(false);
    }
  }

  function handleSendTestPing() {
    if (!fbPixelId.trim()) return;
    setFbSendingTestPing(true);
    trackTestPing(fbPixelId.trim());
    setTimeout(() => {
      setFbSendingTestPing(false);
      setFbTestPingSent(true);
      setTimeout(() => setFbTestPingSent(false), 5000);
    }, 400);
  }

  async function persistHeroSlidesToServer(
    slidesToSave: [HeroBannerConfig, HeroBannerConfig, HeroBannerConfig],
    successMessage: string,
  ) {
    const cleanedSlides = slidesToSave.map((slide, idx) => {
      const fallback = DEFAULT_ADMIN_HERO_SLIDES[idx];
      const rawSrc = slide.imageSrc.trim();
      return {
        titleLine1: slide.titleLine1.trim() || fallback.titleLine1,
        titleLine2: slide.titleLine2.trim() || fallback.titleLine2,
        subtitle: slide.subtitle.trim() || fallback.subtitle,
        ctaLabel: slide.ctaLabel.trim() || fallback.ctaLabel,
        ctaHref: slide.ctaHref.trim() || fallback.ctaHref,
        imageSrc:
          !rawSrc || rawSrc === "/images/hijab-black-banner.png"
            ? fallback.imageSrc
            : rawSrc,
        imageAlt: slide.imageAlt.trim() || fallback.imageAlt,
        imagePosition: slide.imagePosition.trim() || fallback.imagePosition,
      };
    }) as [HeroBannerConfig, HeroBannerConfig, HeroBannerConfig];

    setHeroSlides(cleanedSlides);

    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        heroBanner: cleanedSlides[0],
        heroSlides: cleanedSlides,
      }),
    });
    if (res.ok) {
      await fetchAnalyticsData();
      setFeedback(successMessage);
    } else {
      setFeedback("Failed to save Hero Carousel settings.");
    }
  }

  async function handleBannerFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingBannerImage(true);
    setFeedback("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (bannerImageSrc.trim()) {
        formData.append("replaceUrl", bannerImageSrc.trim());
      }
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { url?: string; mode?: string; error?: string };
      if (!res.ok || !data.url) {
        setFeedback(`Banner upload error: ${data.error || "Failed to upload banner image"}`);
        return;
      }
      const nextAlt =
        !bannerImageAlt ||
        bannerImageAlt === DEFAULT_ADMIN_HERO_SLIDES[activeBannerSlideIdx].imageAlt ||
        bannerImageAlt === "Studio portrait of a woman wearing a black hijab"
          ? `${bannerTitle1} ${bannerTitle2} — HayaNest BD Hero Slide ${activeBannerSlideIdx + 1}`.trim()
          : bannerImageAlt;

      const nextSlides = heroSlides.map((slide, idx) =>
        idx === activeBannerSlideIdx
          ? { ...slide, imageSrc: data.url!, imageAlt: nextAlt }
          : slide,
      ) as [HeroBannerConfig, HeroBannerConfig, HeroBannerConfig];

      await persistHeroSlidesToServer(
        nextSlides,
        data.mode === "cloudinary"
          ? `Slide ${activeBannerSlideIdx + 1} photo uploaded to Cloudinary CDN and published live on Homepage!`
          : `Slide ${activeBannerSlideIdx + 1} photo uploaded and published live on Homepage!`,
      );
    } catch {
      setFeedback("Failed to upload banner image file.");
    } finally {
      setUploadingBannerImage(false);
      event.target.value = "";
    }
  }

  async function handleSaveHeroBanner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingBanner(true);
    setFeedback("");
    try {
      await persistHeroSlidesToServer(
        heroSlides,
        "All 3 Homepage Hero Carousel Slides updated and published live on storefront!",
      );
    } catch {
      setFeedback("Network error while saving Hero Carousel.");
    } finally {
      setSavingBanner(false);
    }
  }

  function handleResetHeroBanner() {
    const def = DEFAULT_ADMIN_HERO_SLIDES[activeBannerSlideIdx];
    const nextSlides = heroSlides.map((slide, idx) =>
      idx === activeBannerSlideIdx ? { ...def } : slide,
    ) as [HeroBannerConfig, HeroBannerConfig, HeroBannerConfig];
    void persistHeroSlidesToServer(
      nextSlides,
      `Slide ${activeBannerSlideIdx + 1} reset to HayaNest BD default and published live!`,
    );
  }

  function handleResetAllHeroSlides() {
    const defaultSlides: [HeroBannerConfig, HeroBannerConfig, HeroBannerConfig] = [
      { ...DEFAULT_ADMIN_HERO_SLIDES[0] },
      { ...DEFAULT_ADMIN_HERO_SLIDES[1] },
      { ...DEFAULT_ADMIN_HERO_SLIDES[2] },
    ];
    void persistHeroSlidesToServer(
      defaultSlides,
      "All 3 Hero Slides reset to HayaNest BD defaults and published live!",
    );
  }

  function applyFlashSalePresetHours(hoursFromNow: number | null) {
    if (hoursFromNow === null) {
      setFlashSaleEndsAtInput("");
      return;
    }
    setFlashSaleEndsAtInput(computePresetDatetimeLocal(hoursFromNow));
  }

  async function handleSaveFlashSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingFlashSale(true);
    setFeedback("");
    try {
      const parsedEnd = flashSaleEndsAtInput.trim()
        ? new Date(flashSaleEndsAtInput.trim())
        : null;
      const endsAtIso =
        parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd.toISOString() : null;

      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flashSale: {
            enabled: flashSaleEnabled,
            endsAt: endsAtIso,
            expiredBehavior: flashSaleExpiredBehavior,
            title: flashSaleTitle.trim() || "Flash Sale",
            badge: flashSaleBadge.trim() || "Limited Time Offer",
            subtitle:
              flashSaleSubtitle.trim() ||
              "Exclusive markdowns on signature drapes before the timer runs out.",
          },
        }),
      });
      if (res.ok) {
        await fetchAnalyticsData();
        setFeedback(
          "Flash Sale timer & expiry rules saved and published live across the storefront!",
        );
      } else {
        setFeedback("Failed to save Flash Sale settings.");
      }
    } catch {
      setFeedback("Network error while saving Flash Sale settings.");
    } finally {
      setSavingFlashSale(false);
    }
  }

  async function saveStoriesToServer(nextStories: Story[], message: string) {
    setStoreStories(nextStories);
    setSavingStories(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stories: nextStories }),
      });
      if (res.ok) {
        await fetchAnalyticsData();
        setFeedback(message);
      } else {
        setFeedback("Failed to save Homepage Stories.");
      }
    } catch {
      setFeedback("Network error while saving Homepage Stories.");
    } finally {
      setSavingStories(false);
    }
  }

  function resetStoryForm() {
    setEditingStoryId("");
    setStoryLabel("");
    setStoryVideoSrc("");
    setStoryPhotoSrc(photos.rose.src);
    setStoryAvatarSrc("");
    setStoryHref("");
  }

  function handleEditStory(story: Story) {
    setEditingStoryId(story.id);
    setStoryLabel(story.label);
    setStoryVideoSrc(story.videoSrc ?? "");
    setStoryPhotoSrc(story.photo.src);
    setStoryAvatarSrc(story.avatar.src === story.photo.src ? "" : story.avatar.src);
    setStoryHref(story.href ?? "");
  }

  async function handleSaveStory(e: FormEvent) {
    e.preventDefault();
    const label = storyLabel.trim();
    const videoSrc = storyVideoSrc.trim();
    const coverSrc = storyPhotoSrc.trim() || photos.rose.src;
    const avatarSrc = storyAvatarSrc.trim() || coverSrc;
    if (!label) return;

    const id =
      editingStoryId ||
      toSlugKey(label) ||
      `story-${storeStories.length + 1}`;
    const uniqueId =
      !editingStoryId && storeStories.some((s) => s.id === id)
        ? `${id}-${storeStories.length + 1}`
        : id;

    const newStory: Story = {
      id: uniqueId,
      label,
      photo: { src: coverSrc, alt: `${label} story` },
      avatar: { src: avatarSrc, alt: `${label} avatar` },
      ...(videoSrc ? { videoSrc } : {}),
      ...(storyHref.trim() ? { href: storyHref.trim() } : {}),
    };

    const nextStories = editingStoryId
      ? storeStories.map((s) => (s.id === editingStoryId ? newStory : s))
      : [...storeStories, newStory];

    resetStoryForm();
    await saveStoriesToServer(
      nextStories,
      editingStoryId
        ? `Updated video story "${label}" on Homepage!`
        : `Added new video story "${label}" to Homepage!`,
    );
  }

  async function handleDeleteStory(id: string) {
    if (storeStories.length <= 1) {
      setFeedback("At least 1 story must remain in the Stories section.");
      return;
    }
    const target = storeStories.find((s) => s.id === id);
    const nextStories = storeStories.filter((s) => s.id !== id);
    if (editingStoryId === id) {
      resetStoryForm();
    }
    await saveStoriesToServer(
      nextStories,
      `Deleted story "${target?.label ?? id}" from Homepage.`,
    );
  }

  async function handleMoveStory(index: number, direction: -1 | 1) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= storeStories.length) return;
    const nextStories = [...storeStories];
    const [moved] = nextStories.splice(index, 1);
    nextStories.splice(targetIdx, 0, moved);
    await saveStoriesToServer(nextStories, `Reordered story "${moved.label}".`);
  }

  async function handleResetDefaultStories() {
    resetStoryForm();
    await saveStoriesToServer(
      defaultStories,
      "Restored default HayaNest BD Homepage Stories!",
    );
  }

  async function extractVideoPosterFile(videoFile: File): Promise<File | null> {
    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(videoFile);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.src = objectUrl;

      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
      };

      const timeoutId = window.setTimeout(() => {
        cleanup();
        resolve(null);
      }, 6000);

      video.onloadedmetadata = () => {
        const targetTime = Math.min(0.4, Math.max(0.05, (video.duration || 1) * 0.1));
        video.currentTime = targetTime;
      };

      video.onseeked = () => {
        window.clearTimeout(timeoutId);
        try {
          const rawW = video.videoWidth || 480;
          const rawH = video.videoHeight || 854;
          const scale = Math.min(1, 480 / rawW);
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(rawW * scale));
          canvas.height = Math.max(1, Math.round(rawH * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            cleanup();
            resolve(null);
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              cleanup();
              if (!blob) {
                resolve(null);
                return;
              }
              const posterFile = new File([blob], "story-poster.webp", {
                type: "image/webp",
              });
              resolve(posterFile);
            },
            "image/webp",
            0.8,
          );
        } catch {
          cleanup();
          resolve(null);
        }
      };

      video.onerror = () => {
        window.clearTimeout(timeoutId);
        cleanup();
        resolve(null);
      };
    });
  }

  async function handleStoryFileUpload(
    event: ChangeEvent<HTMLInputElement>,
    target: "video" | "cover" | "avatar",
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const prevUrl =
      target === "video"
        ? storyVideoSrc
        : target === "cover"
          ? storyPhotoSrc
          : storyAvatarSrc;
    const uploadedUrl = await uploadTaxonomyImageFile(file, `story-${target}`, prevUrl);
    if (!uploadedUrl) return;
    if (target === "video") {
      setStoryVideoSrc(uploadedUrl);
      const posterFile = await extractVideoPosterFile(file);
      if (posterFile) {
        const posterUrl = await uploadTaxonomyImageFile(
          posterFile,
          "story-cover",
          storyPhotoSrc,
        );
        if (posterUrl) {
          setStoryPhotoSrc(posterUrl);
        }
      }
      setFeedback(
        "Story video uploaded (auto-compressed & poster thumbnail extracted for lazy loading)!",
      );
    } else if (target === "cover") {
      setStoryPhotoSrc(uploadedUrl);
      setFeedback("Story thumbnail poster uploaded!");
    } else {
      setStoryAvatarSrc(uploadedUrl);
      setFeedback("Story circular avatar photo uploaded!");
    }
  }

  function toSlugKey(raw: string): string {
    return raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function saveTaxonomyToServer(nextTaxonomy: CatalogTaxonomy, message: string) {
    setTaxonomy(nextTaxonomy);
    setSavingTaxonomy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxonomy: nextTaxonomy }),
      });
      if (res.ok) {
        await fetchAnalyticsData();
        setFeedback(message);
      } else {
        setFeedback("Failed to save catalog attributes.");
      }
    } catch {
      setFeedback("Network error while saving catalog attributes.");
    } finally {
      setSavingTaxonomy(false);
    }
  }

  async function uploadTaxonomyImageFile(
    file: File,
    uploadKey: string,
    replaceUrl?: string,
  ): Promise<string | null> {
    setUploadingTaxonomyKey(uploadKey);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (replaceUrl?.trim()) {
        formData.append("replaceUrl", replaceUrl.trim());
      }
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        setFeedback(`Upload error: ${data.error || "Could not upload image."}`);
        return null;
      }
      return data.url;
    } catch {
      setFeedback("Failed to upload image file.");
      return null;
    } finally {
      setUploadingTaxonomyKey(null);
    }
  }

  async function handleNewCategoryFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const uploadedUrl = await uploadTaxonomyImageFile(
      file,
      "new-category",
      newCategoryImageSrc,
    );
    if (uploadedUrl) {
      setNewCategoryImageSrc(uploadedUrl);
      setFeedback("Category thumbnail ready — click Add to save!");
    }
  }

  async function handleUpdateCategoryImage(
    categoryValue: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const uploadedUrl = await uploadTaxonomyImageFile(file, `cat:${categoryValue}`);
    if (!uploadedUrl) return;
    const target = taxonomy.categories.find((c) => c.value === categoryValue);
    const nextCategories = taxonomy.categories.map((c) =>
      c.value === categoryValue
        ? {
            ...c,
            imageSrc: uploadedUrl,
            imageAlt: `${c.label} collection`,
          }
        : c,
    );
    await saveTaxonomyToServer(
      { ...taxonomy, categories: nextCategories },
      `Updated Homepage category image for "${target?.label ?? categoryValue}"!`,
    );
  }

  async function handleAddCategory(e?: FormEvent) {
    if (e) e.preventDefault();
    const label = newCategoryLabel.trim();
    const value = toSlugKey(label);
    if (!label || !value) return;
    if (taxonomy.categories.some((c) => c.value === value)) {
      setFeedback(`Category "${label}" already exists.`);
      return;
    }
    const next: CatalogTaxonomy = {
      ...taxonomy,
      categories: [
        ...taxonomy.categories,
        {
          value,
          label,
          hasFabric: newCategoryHasFabric,
          ...(newCategoryImageSrc.trim()
            ? { imageSrc: newCategoryImageSrc.trim(), imageAlt: `${label} collection` }
            : {}),
        },
      ],
    };
    setNewCategoryLabel("");
    setNewCategoryImageSrc("");
    setCategory(value);
    await saveTaxonomyToServer(
      next,
      `Added category "${label}" — now live on Homepage Categories slider, Shop filters & Product Manager!`,
    );
  }

  async function handleDeleteCategory(value: string) {
    if (taxonomy.categories.length <= 1) {
      setFeedback("Cannot delete the last remaining category.");
      return;
    }
    const target = taxonomy.categories.find((c) => c.value === value);
    const nextCategories = taxonomy.categories.filter((c) => c.value !== value);
    if (category === value && nextCategories[0]) {
      setCategory(nextCategories[0].value);
    }
    await saveTaxonomyToServer(
      { ...taxonomy, categories: nextCategories },
      `Removed category "${target?.label ?? value}".`,
    );
  }

  async function handleAddFabric(e?: FormEvent) {
    if (e) e.preventDefault();
    const label = newFabricLabel.trim();
    const value = toSlugKey(label);
    if (!label || !value) return;
    if (taxonomy.fabrics.some((f) => f.value === value)) {
      setFeedback(`Fabric "${label}" already exists.`);
      return;
    }
    const next: CatalogTaxonomy = {
      ...taxonomy,
      fabrics: [...taxonomy.fabrics, { value, label }],
    };
    setNewFabricLabel("");
    setFabric(value);
    setMaterial(label);
    await saveTaxonomyToServer(
      next,
      `Added fabric "${label}" — now available in Product Manager & Shop filters!`,
    );
  }

  async function handleDeleteFabric(value: string) {
    if (taxonomy.fabrics.length <= 1) {
      setFeedback("Cannot delete the last remaining fabric.");
      return;
    }
    const target = taxonomy.fabrics.find((f) => f.value === value);
    const nextFabrics = taxonomy.fabrics.filter((f) => f.value !== value);
    if (fabric === value && nextFabrics[0]) {
      setFabric(nextFabrics[0].value);
    }
    await saveTaxonomyToServer(
      { ...taxonomy, fabrics: nextFabrics },
      `Removed fabric "${target?.label ?? value}".`,
    );
  }

  async function handleAddColour(e?: FormEvent) {
    if (e) e.preventDefault();
    const label = newColourLabel.trim();
    const value = toSlugKey(label);
    const swatch = newColourSwatch.trim() || "#1b365d";
    if (!label || !value) return;
    const existingIdx = taxonomy.colours.findIndex((c) => c.value === value);
    const nextColours =
      existingIdx >= 0
        ? taxonomy.colours.map((c, idx) =>
            idx === existingIdx ? { value, label, swatch } : c,
          )
        : [...taxonomy.colours, { value, label, swatch }];
    setNewColourLabel("");
    setColour(value);
    await saveTaxonomyToServer(
      { ...taxonomy, colours: nextColours },
      `Saved colour "${label}" (${swatch}) — now live in Product Manager, Shop & Product page!`,
    );
  }

  async function handleDeleteColour(value: string) {
    if (taxonomy.colours.length <= 1) {
      setFeedback("Cannot delete the last remaining colour.");
      return;
    }
    const target = taxonomy.colours.find((c) => c.value === value);
    const nextColours = taxonomy.colours.filter((c) => c.value !== value);
    if (colour === value && nextColours[0]) {
      setColour(nextColours[0].value);
    }
    await saveTaxonomyToServer(
      { ...taxonomy, colours: nextColours },
      `Removed colour "${target?.label ?? value}".`,
    );
  }

  function exportOrdersCsv() {
    const headers = [
      "Order ID",
      "Date",
      "Customer",
      "Phone",
      "City",
      "Payment Method",
      "Sender Number",
      "Transaction ID",
      "Payment Status",
      "Order Status",
      "Delivery Status",
      "Subtotal",
      "Shipping",
      "Refund",
      "Total",
    ];
    const rows = orders.map((o) => [
      o.id,
      o.createdAt,
      `"${o.customer.name.replace(/"/g, '""')}"`,
      o.customer.phone,
      `"${o.customer.city.replace(/"/g, '""')}"`,
      o.paymentMethod,
      o.paymentPhone ? `"${o.paymentPhone.replace(/"/g, '""')}"` : "",
      o.paymentTrxId ? `"${o.paymentTrxId.replace(/"/g, '""')}"` : "",
      o.paymentStatus,
      o.status,
      o.deliveryStatus,
      o.subtotal,
      o.shippingFee,
      o.refundAmount,
      o.total,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hayanest-orders-${analytics.meta.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const pendingPaymentVerifications = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.paymentMethod !== "cod" &&
          order.paymentStatus === "Pending" &&
          order.status !== "Cancelled" &&
          order.status !== "Returned" &&
          order.status !== "Refunded",
      ),
    [orders],
  );

  // Filtered & Sorted Orders for Recent / All Orders Table
  const filteredOrders = useMemo(() => {
    const q = (orderSearch || globalSearch).trim().toLowerCase();
    const list = orders.filter((order) => {
      if (orderStatusFilter !== "all" && order.status !== orderStatusFilter) return false;
      if (orderPaymentFilter !== "all" && order.paymentStatus !== orderPaymentFilter) return false;
      if (!q) return true;
      return (
        order.id.toLowerCase().includes(q) ||
        order.customer.name.toLowerCase().includes(q) ||
        order.customer.phone.toLowerCase().includes(q) ||
        order.customer.city.toLowerCase().includes(q) ||
        order.paymentMethod.toLowerCase().includes(q) ||
        (order.paymentPhone ?? "").toLowerCase().includes(q) ||
        (order.paymentTrxId ?? "").toLowerCase().includes(q) ||
        order.items.some((i) => i.name.toLowerCase().includes(q))
      );
    });

    return [...list].sort((a, b) => {
      if (orderSort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (orderSort === "highest") return b.total - a.total;
      if (orderSort === "lowest") return a.total - b.total;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [orders, orderSearch, globalSearch, orderStatusFilter, orderPaymentFilter, orderSort]);

  const ORDERS_PER_PAGE = 8;
  const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
  const paginatedOrders = filteredOrders.slice(
    (orderPage - 1) * ORDERS_PER_PAGE,
    orderPage * ORDERS_PER_PAGE,
  );

  // Sorted Best Selling Products
  const sortedBestSellers = useMemo(() => {
    const list = [...analytics.tables.bestSellingProducts];
    return list.sort((a, b) =>
      bestSellerSort === "revenue"
        ? b.revenue - a.revenue || b.unitsSold - a.unitsSold
        : b.unitsSold - a.unitsSold || b.revenue - a.revenue,
    );
  }, [analytics.tables.bestSellingProducts, bestSellerSort]);

  // Filtered Variant Inventory
  const filteredVariants = useMemo(() => {
    const q = (inventorySearch || globalSearch).trim().toLowerCase();
    return analytics.tables.variantInventory.filter((v) => {
      if (inventoryFilter !== "all" && v.stockState !== inventoryFilter) return false;
      if (!q) return true;
      return (
        v.productName.toLowerCase().includes(q) ||
        v.sku.toLowerCase().includes(q) ||
        v.colour.toLowerCase().includes(q) ||
        (v.fabric ?? "").toLowerCase().includes(q)
      );
    });
  }, [analytics.tables.variantInventory, inventoryFilter, inventorySearch, globalSearch]);

  // Filtered Catalog Products
  const filteredCatalogProducts = useMemo(() => {
    const q = (productCatalogSearch || globalSearch).trim().toLowerCase();
    return products.filter((p) => {
      if (productCategoryFilter !== "all") {
        const key = p.fabric ? `${p.category}:${p.fabric}` : p.category;
        if (key !== productCategoryFilter && p.category !== productCategoryFilter) return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.colour.toLowerCase().includes(q) ||
        (p.fabric ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, productCatalogSearch, productCategoryFilter, globalSearch]);

  const previewProduct = {
    id: editingId || "preview-item",
    slug: editingId || "preview-modal-rose",
    name: name.trim() || "Premium Modal Hijab",
    description:
      description.trim() ||
      "A soft, fluid drape for everyday styling. Breathable comfort from morning to evening.",
    price: Number(price) > 0 ? Number(price) : 650,
    ...(Number(originalPrice) > Number(price) ? { originalPrice: Number(originalPrice) } : {}),
    photo: {
      src: imageSrc || photos.rose.src,
      alt: imageAlt || name || "Preview Hijab",
    },
  };

  const totalAlertsCount =
    analytics.tables.pendingAttentionOrders.length +
    analytics.productsAndInventory.outOfStockVariantsCount +
    analytics.productsAndInventory.lowStockVariantsCount;

  const currentNavMeta =
    SIDEBAR_ITEMS.find((item) => item.id === activeSection) ?? SIDEBAR_ITEMS[0];

  const monthlyTarget = analytics.settings.monthlySalesTarget;
  const monthlyProgressPct =
    monthlyTarget && monthlyTarget > 0
      ? Math.min(100, Math.round((analytics.salesAndRevenue.thisMonthRevenue / monthlyTarget) * 100))
      : null;

  if (!authenticated) {
    return (
      <div className="adm-login-page">
        <div className="adm-login-card">
          <div className="adm-login-brand">
            <span className="adm-eyebrow">
              <Lock size={13} aria-hidden="true" /> ENTERPRISE COMMERCE SUITE
            </span>
            <h1>HayaNest BD Admin Portal</h1>
            <p>
              Sign in to access real-time sales analytics, variant inventory, Cloudinary image CDN,
              and order fulfillment.
            </p>
          </div>

          {loginError && (
            <div className="adm-alert is-error" role="alert">
              <AlertCircle size={16} />
              <span>{loginError}</span>
            </div>
          )}

          <form className="adm-form-stack" onSubmit={handleLogin}>
            <div className="adm-field">
              <label htmlFor="admin-email">Admin Email</label>
              <input
                id="admin-email"
                type="email"
                className="adm-input"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>
            <div className="adm-field">
              <label htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                type="password"
                className="adm-input"
                placeholder="Enter admin password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="adm-btn adm-btn-primary" disabled={loginBusy}>
              <ShieldCheck size={16} aria-hidden="true" />
              {loginBusy ? "Authenticating…" : "Sign In to Dashboard"}
            </button>
          </form>

          <div className="adm-login-footer">
            <Link href="/">← Return to HayaNest BD Storefront</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`adm-shell ${sidebarCollapsed ? "is-collapsed" : ""}`}>
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="adm-mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ================= SIDEBAR NAVIGATION ================= */}
      <aside
        className={`adm-sidebar ${mobileMenuOpen ? "is-mobile-open" : ""}`}
        aria-label="Admin sidebar navigation"
      >
        <div className="adm-sidebar-top">
          <Link href="/" className="adm-brand-link" title="HayaNest BD Storefront">
            <span className="adm-brand-mark">HN</span>
            {!sidebarCollapsed && (
              <div className="adm-brand-text">
                <strong>HayaNest BD</strong>
                <span>Admin Enterprise</span>
              </div>
            )}
          </Link>
          <button
            type="button"
            className="adm-icon-btn adm-collapse-btn"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button
            type="button"
            className="adm-icon-btn adm-mobile-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation drawer"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="adm-sidebar-nav">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            const badge =
              item.id === "orders" && analytics.ordersMetrics.pendingOrders > 0
                ? analytics.ordersMetrics.pendingOrders
                : item.id === "inventory" &&
                    analytics.productsAndInventory.lowStockVariantsCount +
                      analytics.productsAndInventory.outOfStockVariantsCount >
                      0
                  ? analytics.productsAndInventory.lowStockVariantsCount +
                    analytics.productsAndInventory.outOfStockVariantsCount
                  : item.id === "reviews" && pendingReviewsCount > 0
                    ? pendingReviewsCount
                    : item.id === "customers" && unreadContactMessagesCount > 0
                      ? unreadContactMessagesCount
                      : item.id === "payments" && pendingPaymentVerifications.length > 0
                        ? pendingPaymentVerifications.length
                        : null;
            return (
              <button
                key={item.id}
                type="button"
                className={`adm-nav-item ${active ? "is-active" : ""}`}
                onClick={() => {
                  setActiveSection(item.id);
                  setMobileMenuOpen(false);
                }}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                {!sidebarCollapsed && <span className="adm-nav-label">{item.label}</span>}
                {!sidebarCollapsed && badge !== null && (
                  <span className="adm-nav-badge">{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="adm-sidebar-bottom">
          <Link href="/shop" className="adm-nav-item" title="Live Shop Catalog">
            <ExternalLink size={17} aria-hidden="true" />
            {!sidebarCollapsed && <span className="adm-nav-label">Live Storefront</span>}
          </Link>
          <button
            type="button"
            className="adm-nav-item is-danger"
            onClick={handleLogout}
            title="Sign Out"
          >
            <LogOut size={17} aria-hidden="true" />
            {!sidebarCollapsed && <span className="adm-nav-label">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ================= MAIN WORKSPACE ================= */}
      <div className="adm-main">
        {/* TOP NAVIGATION BAR */}
        <header className="adm-topbar">
          <div className="adm-topbar-left">
            <button
              type="button"
              className="adm-icon-btn adm-mobile-trigger"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>
            <div className="adm-breadcrumbs">
              <span className="adm-crumb-muted">Admin</span>
              <ChevronRight size={13} aria-hidden="true" />
              <strong>{currentNavMeta.label}</strong>
            </div>
          </div>

          {/* Global Search */}
          <div className="adm-global-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search orders, SKUs, products, customers…"
              value={globalSearch}
              onChange={(e) => {
                setGlobalSearch(e.target.value);
                setOrderPage(1);
              }}
              aria-label="Global admin search"
            />
            {globalSearch && (
              <button
                type="button"
                className="adm-clear-search"
                onClick={() => setGlobalSearch("")}
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Date Range Filter & Actions */}
          <div className="adm-topbar-right">
            <div className="adm-date-bar">
              <Calendar size={14} aria-hidden="true" />
              <select
                className="adm-date-select"
                value={datePreset}
                onChange={(e) => {
                  const nextPreset = e.target.value as DateRangePreset;
                  setDatePreset(nextPreset);
                  if (nextPreset !== "custom") {
                    void fetchAnalyticsData(nextPreset);
                  }
                }}
                aria-label="Select analytics date range"
              >
                {DATE_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              {datePreset === "custom" && (
                <div className="adm-custom-dates">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    aria-label="Custom start date"
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    aria-label="Custom end date"
                  />
                  <button
                    type="button"
                    className="adm-btn adm-btn-sm adm-btn-primary"
                    onClick={() => void fetchAnalyticsData("custom", customStart, customEnd)}
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="adm-icon-btn"
              onClick={() => void fetchAnalyticsData()}
              aria-label="Refresh analytics"
              title="Refresh data"
            >
              <RefreshCw size={17} className={loadingData ? "adm-spin" : ""} />
            </button>

            <ThemeToggle />

            {/* Notification Center */}
            <div className="adm-popover-wrap">
              <button
                type="button"
                className="adm-icon-btn adm-notif-btn"
                onClick={() => {
                  setNotifOpen((o) => !o);
                  setProfileOpen(false);
                }}
                aria-label="Notifications and alerts"
              >
                <Bell size={18} />
                {totalAlertsCount > 0 && (
                  <span className="adm-notif-dot">{totalAlertsCount}</span>
                )}
              </button>
              {notifOpen && (
                <div className="adm-popover adm-notif-popover" role="dialog" aria-label="Notification center">
                  <div className="adm-popover-head">
                    <strong>Notification Center</strong>
                    <button
                      type="button"
                      className="adm-icon-btn"
                      onClick={() => setNotifOpen(false)}
                      aria-label="Close notifications"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="adm-notif-list">
                    {analytics.tables.pendingAttentionOrders.length > 0 && (
                      <button
                        type="button"
                        className="adm-notif-item is-warning"
                        onClick={() => {
                          setActiveSection("orders");
                          setNotifOpen(false);
                        }}
                      >
                        <ShoppingCart size={15} />
                        <div>
                          <strong>
                            {analytics.tables.pendingAttentionOrders.length} orders awaiting action
                          </strong>
                          <span>Pending, Confirmed, or Processing fulfillment</span>
                        </div>
                      </button>
                    )}
                    {analytics.productsAndInventory.outOfStockVariantsCount > 0 && (
                      <button
                        type="button"
                        className="adm-notif-item is-danger"
                        onClick={() => {
                          setActiveSection("inventory");
                          setInventoryFilter("out_of_stock");
                          setNotifOpen(false);
                        }}
                      >
                        <AlertCircle size={15} />
                        <div>
                          <strong>
                            {analytics.productsAndInventory.outOfStockVariantsCount} variants out of stock
                          </strong>
                          <span>Restock required to prevent lost sales</span>
                        </div>
                      </button>
                    )}
                    {analytics.productsAndInventory.lowStockVariantsCount > 0 && (
                      <button
                        type="button"
                        className="adm-notif-item is-warning"
                        onClick={() => {
                          setActiveSection("inventory");
                          setInventoryFilter("low_stock");
                          setNotifOpen(false);
                        }}
                      >
                        <AlertTriangle size={15} />
                        <div>
                          <strong>
                            {analytics.productsAndInventory.lowStockVariantsCount} variants low in stock
                          </strong>
                          <span>At or below threshold ({analytics.settings.lowStockThreshold} units)</span>
                        </div>
                      </button>
                    )}
                    {analytics.activities.slice(0, 4).map((act) => (
                      <div key={act.id} className="adm-notif-item">
                        <Activity size={15} />
                        <div>
                          <strong>{act.title}</strong>
                          <span>{act.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Admin Profile Dropdown */}
            <div className="adm-popover-wrap">
              <button
                type="button"
                className="adm-profile-trigger"
                onClick={() => {
                  setProfileOpen((o) => !o);
                  setNotifOpen(false);
                }}
                aria-label="Admin profile menu"
              >
                <span className="adm-avatar">A</span>
                <span className="adm-profile-name">Admin</span>
              </button>
              {profileOpen && (
                <div className="adm-popover adm-profile-popover" role="menu">
                  <div className="adm-popover-head">
                    <div>
                      <strong>{status.defaultAdminEmail}</strong>
                      <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
                        Super Admin · {analytics.meta.timezone}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="adm-menu-item"
                    onClick={() => {
                      setActiveSection("settings");
                      setProfileOpen(false);
                    }}
                  >
                    <Settings size={14} /> Store Settings
                  </button>
                  <button
                    type="button"
                    className="adm-menu-item"
                    onClick={() => {
                      setActiveSection("users");
                      setProfileOpen(false);
                    }}
                  >
                    <ShieldCheck size={14} /> Admin Users &amp; Roles
                  </button>
                  <button type="button" className="adm-menu-item is-danger" onClick={handleLogout}>
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* PAGE CONTENT AREA */}
        <div className="adm-content">
          {/* Page Header & Quick Actions */}
          <div className="adm-page-header">
            <div>
              <h1>{currentNavMeta.label}</h1>
              <p className="adm-page-sub">
                Period: <strong>{analytics.meta.startDate}</strong> to{" "}
                <strong>{analytics.meta.endDate}</strong> ({analytics.meta.timezone}) · Compared
                with {analytics.meta.previousStartDate} – {analytics.meta.previousEndDate}
              </p>
            </div>

            <div className="adm-quick-actions">
              <button
                type="button"
                className="adm-btn adm-btn-primary"
                onClick={() => {
                  resetProductForm();
                  setShowProductFormModal(true);
                }}
              >
                <Plus size={15} /> Add New Product
              </button>
              <button
                type="button"
                className="adm-btn adm-btn-secondary"
                onClick={() => setShowManualOrderModal(true)}
              >
                <ShoppingBag size={15} /> Record Order
              </button>
              <button
                type="button"
                className="adm-btn adm-btn-secondary"
                onClick={() => setActiveSection("inventory")}
              >
                <Box size={15} /> Manage Inventory
              </button>
              <button
                type="button"
                className="adm-btn adm-btn-secondary"
                onClick={() => setActiveSection("coupons")}
              >
                <Tag size={15} /> Create Coupon
              </button>
              <button
                type="button"
                className="adm-btn adm-btn-secondary"
                onClick={() => setActiveSection("categories")}
              >
                <FolderKanban size={15} /> Categories
              </button>
            </div>
          </div>

          {/* Alerts / Feedback / Error states */}
          {apiError && (
            <div className="adm-alert is-error" role="alert">
              <AlertCircle size={16} />
              <span>{apiError}</span>
              <button
                type="button"
                className="adm-btn adm-btn-sm adm-btn-secondary"
                onClick={() => void fetchAnalyticsData()}
              >
                Retry
              </button>
            </div>
          )}

          {feedback && (
            <div className="adm-alert is-success" role="status">
              <CheckCircle2 size={16} />
              <span>{feedback}</span>
              <button
                type="button"
                className="adm-icon-btn"
                onClick={() => setFeedback("")}
                aria-label="Dismiss message"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* ================= 1. DASHBOARD OVERVIEW ================= */}
          {activeSection === "dashboard" && (
            <div className="adm-section-stack">
              {/* All 43 Business KPIs with Group Filter */}
              <AdminKpiGrid
                analytics={analytics}
                onConfigureCosts={() => setActiveSection("inventory")}
              />

              {/* Primary Analytics Charts Row */}
              <div className="adm-grid-2">
                <RevenueAnalyticsChart charts={analytics.charts} />
                <SalesAnalyticsChart charts={analytics.charts} />
              </div>

              {/* Secondary Analytics Charts Row */}
              <div className="adm-grid-2">
                <OrderStatusDonutChart
                  distribution={analytics.charts.orderStatusDistribution}
                />
                <CategoryPerformanceChart
                  categories={analytics.charts.categoryPerformance}
                />
              </div>

              {/* Third Analytics Charts Row */}
              <div className="adm-grid-2">
                <PaymentAnalyticsChart
                  paymentStatuses={analytics.charts.paymentStatusBreakdown}
                  paymentMethods={analytics.charts.paymentMethodBreakdown}
                />
                <CustomerAnalyticsChart
                  customersMetrics={analytics.customersMetrics}
                  series={analytics.charts.dailySeries}
                />
              </div>

              {/* Recent Orders Table */}
              <section className="adm-panel" aria-labelledby="recent-orders-heading">
                <div className="adm-panel-head">
                  <div>
                    <h3 id="recent-orders-heading">Recent Orders</h3>
                    <p className="adm-panel-sub">
                      Real-time orders from database ({filteredOrders.length} total matching)
                    </p>
                  </div>
                  <div className="adm-table-controls">
                    <select
                      className="adm-select-sm"
                      value={orderStatusFilter}
                      onChange={(e) => {
                        setOrderStatusFilter(e.target.value);
                        setOrderPage(1);
                      }}
                      aria-label="Filter orders by status"
                    >
                      <option value="all">All Order Statuses</option>
                      {ORDER_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {formatAdminOrderStatusOption(st)}
                        </option>
                      ))}
                    </select>
                    <select
                      className="adm-select-sm"
                      value={orderSort}
                      onChange={(e) =>
                        setOrderSort(
                          e.target.value as "newest" | "oldest" | "highest" | "lowest",
                        )
                      }
                      aria-label="Sort orders"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="highest">Highest Total</option>
                      <option value="lowest">Lowest Total</option>
                    </select>
                    <button
                      type="button"
                      className="adm-btn adm-btn-sm adm-btn-secondary"
                      onClick={() => setActiveSection("orders")}
                    >
                      Full Order Manager →
                    </button>
                  </div>
                </div>

                {paginatedOrders.length === 0 ? (
                  <div className="adm-empty-state">
                    <ShoppingCart size={28} />
                    <h4>0 Orders Found</h4>
                    <p>
                      No orders match your current filter. Place an order on the storefront or click
                      &ldquo;Record Order&rdquo; above to test live analytics.
                    </p>
                    <button
                      type="button"
                      className="adm-btn adm-btn-primary"
                      onClick={() => setShowManualOrderModal(true)}
                    >
                      <Plus size={15} /> Record First Order
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="adm-table-scroll">
                      <table className="adm-table">
                        <thead>
                          <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Products</th>
                            <th>Date</th>
                            <th>Total</th>
                            <th>Payment</th>
                            <th>Order Status</th>
                            <th>Delivery</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedOrders.map((order) => (
                            <tr key={order.id}>
                              <td>
                                <strong>{order.id}</strong>
                              </td>
                              <td>
                                <div className="adm-cell-stack">
                                  <strong>{order.customer.name}</strong>
                                  <span>
                                    {order.customer.phone} · {order.customer.city}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <div className="adm-cell-stack">
                                  <strong>
                                    {order.items[0]?.name || "Hijab Item"}
                                    {order.items.length > 1
                                      ? ` +${order.items.length - 1} more`
                                      : ""}
                                  </strong>
                                  <span>
                                    {order.items.reduce((s, i) => s + i.quantity, 0)} unit(s)
                                  </span>
                                </div>
                              </td>
                              <td>{formatOrderDate(order.createdAt)}</td>
                              <td>
                                <strong>{formatPrice(order.total)}</strong>
                              </td>
                              <td>
                                <div className="adm-cell-stack">
                                  <span
                                    className={`adm-status-pill is-pay-${order.paymentStatus
                                      .toLowerCase()
                                      .replace(/\s+/g, "-")}`}
                                  >
                                    {order.paymentStatus} ({order.paymentMethod.toUpperCase()})
                                  </span>
                                  {order.paymentTrxId && (
                                    <span style={{ fontSize: 11, fontFamily: "monospace" }}>
                                      TrxID: <strong>{order.paymentTrxId}</strong>
                                    </span>
                                  )}
                                  {order.paymentPhone && (
                                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                                      From: {order.paymentPhone}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <select
                                  className="adm-select-sm"
                                  value={order.status}
                                  onChange={(e) =>
                                    void handleUpdateOrder({
                                      id: order.id,
                                      status: e.target.value as AdminOrderStatus,
                                    })
                                  }
                                  aria-label={`Order status for ${order.id}`}
                                >
                                  {ORDER_STATUSES.map((st) => (
                                    <option key={st} value={st}>
                                      {formatAdminOrderStatusOption(st)}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                {(() => {
                                  const dp = getAdminDeliveryPillMeta(order);
                                  return (
                                    <span className={`adm-status-pill ${dp.pillClass}`}>
                                      {dp.label}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-sm adm-btn-secondary"
                                  onClick={() => setSelectedOrder(order)}
                                >
                                  <Eye size={13} /> Details
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="adm-pagination">
                      <span>
                        Showing page {orderPage} of {totalOrderPages} ({filteredOrders.length}{" "}
                        orders)
                      </span>
                      <div className="adm-pagination-btns">
                        <button
                          type="button"
                          className="adm-btn adm-btn-sm adm-btn-secondary"
                          disabled={orderPage <= 1}
                          onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          className="adm-btn adm-btn-sm adm-btn-secondary"
                          disabled={orderPage >= totalOrderPages}
                          onClick={() => setOrderPage((p) => Math.min(totalOrderPages, p + 1))}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </section>

              {/* Best Selling Products & Low Stock Alerts Row */}
              <div className="adm-grid-2">
                {/* Best Selling Products */}
                <section className="adm-panel" aria-labelledby="best-sellers-heading">
                  <div className="adm-panel-head">
                    <div>
                      <h3 id="best-sellers-heading">Best Selling Products</h3>
                      <p className="adm-panel-sub">
                        Ranked dynamically from eligible orders in selected period
                      </p>
                    </div>
                    <div className="adm-seg-group">
                      <button
                        type="button"
                        className={`adm-seg-btn ${bestSellerSort === "units" ? "is-active" : ""}`}
                        onClick={() => setBestSellerSort("units")}
                      >
                        By Units
                      </button>
                      <button
                        type="button"
                        className={`adm-seg-btn ${bestSellerSort === "revenue" ? "is-active" : ""}`}
                        onClick={() => setBestSellerSort("revenue")}
                      >
                        By Revenue
                      </button>
                    </div>
                  </div>

                  {sortedBestSellers.length === 0 ? (
                    <div className="adm-empty-state">
                      <Award size={26} />
                      <h4>No Product Sales in Period</h4>
                      <p>
                        0 units sold between {analytics.meta.startDate} and{" "}
                        {analytics.meta.endDate}. Rankings populate automatically from real order
                        items.
                      </p>
                    </div>
                  ) : (
                    <div className="adm-bestseller-list">
                      {sortedBestSellers.slice(0, 6).map((item) => (
                        <div key={item.id} className="adm-bestseller-row">
                          <div className="adm-thumb-sm">
                            <ProductPhoto photo={item.photo} sizes="48px" />
                          </div>
                          <div className="adm-bestseller-info">
                            <strong>{item.name}</strong>
                            <span>
                              SKU: {item.sku} · {item.fabric || item.category} · Stock:{" "}
                              {item.currentStock}
                            </span>
                            <div className="adm-progress-track">
                              <div
                                className="adm-progress-fill"
                                style={{ width: `${Math.max(6, item.performancePercent)}%` }}
                              />
                            </div>
                          </div>
                          <div className="adm-bestseller-metrics">
                            <strong>{formatPrice(item.revenue)}</strong>
                            <span>{item.unitsSold} units sold</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Inventory & Variant Stock Alerts */}
                <section className="adm-panel" aria-labelledby="stock-alerts-heading">
                  <div className="adm-panel-head">
                    <div>
                      <h3 id="stock-alerts-heading">Inventory &amp; Stock Alerts</h3>
                      <p className="adm-panel-sub">
                        Variant-level threshold: ≤ {analytics.settings.lowStockThreshold} units
                      </p>
                    </div>
                    <button
                      type="button"
                      className="adm-btn adm-btn-sm adm-btn-secondary"
                      onClick={() => setActiveSection("inventory")}
                    >
                      All Variants →
                    </button>
                  </div>

                  <div className="adm-stock-alert-list">
                    {[
                      ...analytics.tables.outOfStockAlerts,
                      ...analytics.tables.lowStockAlerts,
                    ]
                      .slice(0, 6)
                      .map((v) => (
                        <div key={v.variantKey} className="adm-stock-alert-row">
                          <div className="adm-thumb-sm">
                            <ProductPhoto photo={v.photo} sizes="44px" />
                          </div>
                          <div className="adm-cell-stack" style={{ flex: 1 }}>
                            <strong>
                              {v.productName} ({v.colour.toUpperCase()})
                            </strong>
                            <span>
                              SKU: {v.sku} · {v.fabric || v.category} · {v.size}
                            </span>
                          </div>
                          <span
                            className={`adm-status-pill ${
                              v.stockState === "out_of_stock" ? "is-danger" : "is-warning"
                            }`}
                          >
                            {v.stock === 0 ? "Out of Stock (0)" : `Low Stock (${v.stock})`}
                          </span>
                        </div>
                      ))}
                  </div>
                </section>
              </div>

              {/* Additional Business Widgets: Top Customers, Sales Target, Recent Activity */}
              <div className="adm-grid-3">
                {/* Top Customers Widget */}
                <section className="adm-panel">
                  <div className="adm-panel-head">
                    <div>
                      <h3>Top Customers</h3>
                      <p className="adm-panel-sub">Ranked by net eligible spending</p>
                    </div>
                  </div>
                  {analytics.tables.topCustomers.length === 0 ? (
                    <p className="adm-muted-note">No customer records yet.</p>
                  ) : (
                    <div className="adm-mini-stat-list">
                      {analytics.tables.topCustomers.slice(0, 5).map((cust) => (
                        <div key={cust.customerKey} className="adm-mini-stat-row">
                          <div>
                            <strong>{cust.name}</strong>
                            <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
                              {cust.phoneMasked} · {cust.totalOrders} order(s)
                            </span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <strong>{formatPrice(cust.totalSpent)}</strong>
                            <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
                              Last: {cust.lastOrderDate}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Sales Target & Refund Summary Widget */}
                <section className="adm-panel">
                  <div className="adm-panel-head">
                    <div>
                      <h3>Monthly Target &amp; Refunds</h3>
                      <p className="adm-panel-sub">Revenue goal &amp; return reconciliation</p>
                    </div>
                  </div>

                  <div className="adm-target-box">
                    <div className="adm-cat-row-top">
                      <span>This Month&apos;s Revenue</span>
                      <strong>{formatPrice(analytics.salesAndRevenue.thisMonthRevenue)}</strong>
                    </div>
                    {monthlyTarget ? (
                      <>
                        <div className="adm-progress-track" style={{ marginBlock: 8 }}>
                          <div
                            className="adm-progress-fill"
                            style={{ width: `${monthlyProgressPct ?? 0}%` }}
                          />
                        </div>
                        <small className="adm-hint">
                          {monthlyProgressPct}% of {formatPrice(monthlyTarget)} monthly target
                        </small>
                      </>
                    ) : (
                      <div className="adm-unconfigured-note">
                        <span>Monthly sales target not configured yet.</span>
                        <button
                          type="button"
                          className="adm-link-btn"
                          onClick={() => setActiveSection("settings")}
                        >
                          Configure Target in Settings →
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="adm-mini-stat-list" style={{ marginTop: 14 }}>
                    <div className="adm-mini-stat-row">
                      <span>Net Revenue (After Refunds)</span>
                      <strong>{formatPrice(analytics.salesAndRevenue.periodNetRevenue)}</strong>
                    </div>
                    <div className="adm-mini-stat-row">
                      <span>Period Refunds Issued</span>
                      <strong>{formatPrice(analytics.salesAndRevenue.periodRefundAmount)}</strong>
                    </div>
                    <div className="adm-mini-stat-row">
                      <span>Discounts &amp; Markdowns</span>
                      <strong>{formatPrice(analytics.salesAndRevenue.periodDiscountsGiven)}</strong>
                    </div>
                  </div>
                </section>

                {/* Recent Activities Feed */}
                <section className="adm-panel">
                  <div className="adm-panel-head">
                    <div>
                      <h3>Recent Store Activity</h3>
                      <p className="adm-panel-sub">Live audit log of catalog &amp; order events</p>
                    </div>
                  </div>
                  {analytics.activities.length === 0 ? (
                    <p className="adm-muted-note">
                      No recent administrative changes logged yet. Any product, stock, or order
                      update will appear here.
                    </p>
                  ) : (
                    <div className="adm-activity-feed">
                      {analytics.activities.slice(0, 5).map((act) => (
                        <div key={act.id} className="adm-activity-item">
                          <span className="adm-activity-dot" />
                          <div>
                            <strong>{act.title}</strong>
                            <span>{act.detail}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {/* ================= 2. PRODUCTS SECTION ================= */}
          {activeSection === "products" && (
            <div className="adm-section-stack">
              {/* Dynamic Categories, Fabrics & Color Picker Manager */}
              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>Dynamic Categories, Fabrics &amp; Color Picker</h3>
                    <p className="adm-panel-sub">
                      Add or delete categories, fabrics, and custom colours with hex swatches —
                      automatically synced to Add Product, Shop filters, and Product pages
                    </p>
                  </div>
                  {savingTaxonomy && (
                    <span className="adm-status-pill is-warning">Syncing…</span>
                  )}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: 16,
                  }}
                >
                  {/* 1. Dynamic Categories */}
                  <div
                    style={{
                      background: "var(--surface-soft)",
                      border: "1px solid var(--line)",
                      borderRadius: 14,
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 10,
                        }}
                      >
                        <strong style={{ fontSize: 13 }}>
                          Categories ({taxonomy.categories.length})
                        </strong>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>
                          Homepage Slider &amp; Shop
                        </span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {taxonomy.categories.map((cat) => {
                          const fallbackPhoto =
                            cat.value === "accessories"
                              ? photos.accessories.src
                              : cat.value === "hijabs"
                                ? photos.rose.src
                                : photos.folded.src;
                          const previewSrc = cat.imageSrc?.trim() || fallbackPhoto;
                          const isUploadingThis = uploadingTaxonomyKey === `cat:${cat.value}`;
                          return (
                            <span
                              key={cat.value}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 10px 4px 5px",
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 600,
                                background: "var(--surface)",
                                border: "1px solid var(--line)",
                              }}
                            >
                              <span
                                aria-hidden="true"
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: "50%",
                                  backgroundImage: `url("${previewSrc}")`,
                                  backgroundSize: "cover",
                                  backgroundPosition: "center",
                                  border: "1px solid var(--line)",
                                  flexShrink: 0,
                                }}
                              />
                              {cat.label}
                              {cat.hasFabric !== false && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: "var(--muted)",
                                    fontWeight: 400,
                                  }}
                                >
                                  (fabric)
                                </span>
                              )}
                              <label
                                title={`Upload or change Homepage thumbnail for ${cat.label}`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  color: cat.imageSrc ? "var(--accent-strong)" : "var(--muted)",
                                  cursor: isUploadingThis ? "wait" : "pointer",
                                  padding: "0 2px",
                                }}
                              >
                                <ImagePlus size={13} />
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={isUploadingThis || savingTaxonomy}
                                  onChange={(e) => handleUpdateCategoryImage(cat.value, e)}
                                  style={{ display: "none" }}
                                />
                              </label>
                              {taxonomy.categories.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(cat.value)}
                                  aria-label={`Delete category ${cat.label}`}
                                  style={{
                                    border: "none",
                                    background: "transparent",
                                    color: "var(--muted)",
                                    padding: 0,
                                    display: "inline-flex",
                                    cursor: "pointer",
                                  }}
                                >
                                  <X size={13} />
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <form onSubmit={handleAddCategory} style={{ display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <label
                          title="Optional: Upload Homepage thumbnail photo for new category"
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            border: "1px dashed var(--line)",
                            background: "var(--surface)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            flexShrink: 0,
                            overflow: "hidden",
                          }}
                        >
                          {newCategoryImageSrc ? (
                            <span
                              aria-hidden="true"
                              style={{
                                width: "100%",
                                height: "100%",
                                backgroundImage: `url("${newCategoryImageSrc}")`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                              }}
                            />
                          ) : (
                            <ImagePlus size={15} style={{ color: "var(--muted)" }} />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingTaxonomyKey === "new-category"}
                            onChange={handleNewCategoryFileSelect}
                            style={{ display: "none" }}
                          />
                        </label>
                        <input
                          type="text"
                          className="adm-input-sm"
                          style={{ flex: 1 }}
                          placeholder="New category (e.g. Abayas, Khimars)…"
                          value={newCategoryLabel}
                          onChange={(e) => setNewCategoryLabel(e.target.value)}
                        />
                        <button
                          type="submit"
                          className="adm-btn adm-btn-sm adm-btn-primary"
                          disabled={savingTaxonomy || !newCategoryLabel.trim()}
                        >
                          <Plus size={13} /> Add
                        </button>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <label
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 11,
                            color: "var(--muted)",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={newCategoryHasFabric}
                            onChange={(e) => setNewCategoryHasFabric(e.target.checked)}
                          />
                          Uses fabric selection (e.g. Modal, Silk)
                        </label>
                        <span style={{ fontSize: 10, color: "var(--muted)" }}>
                          Photo optional (click icon to upload category thumbnail)
                        </span>
                      </div>
                    </form>
                  </div>

                  {/* 2. Dynamic Fabrics */}
                  <div
                    style={{
                      background: "var(--surface-soft)",
                      border: "1px solid var(--line)",
                      borderRadius: 14,
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 10,
                        }}
                      >
                        <strong style={{ fontSize: 13 }}>
                          Fabrics ({taxonomy.fabrics.length})
                        </strong>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>
                          Material Filter
                        </span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {taxonomy.fabrics.map((fab) => (
                          <span
                            key={fab.value}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "5px 10px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 600,
                              background: "var(--surface)",
                              border: "1px solid var(--line)",
                            }}
                          >
                            {fab.label}
                            {taxonomy.fabrics.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteFabric(fab.value)}
                                aria-label={`Delete fabric ${fab.label}`}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color: "var(--muted)",
                                  padding: 0,
                                  display: "inline-flex",
                                  cursor: "pointer",
                                }}
                              >
                                <X size={13} />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>

                    <form onSubmit={handleAddFabric} style={{ display: "flex", gap: 6 }}>
                      <input
                        type="text"
                        className="adm-input-sm"
                        style={{ flex: 1 }}
                        placeholder="New fabric (e.g. Georgette, Linen, Cotton)…"
                        value={newFabricLabel}
                        onChange={(e) => setNewFabricLabel(e.target.value)}
                      />
                      <button
                        type="submit"
                        className="adm-btn adm-btn-sm adm-btn-primary"
                        disabled={savingTaxonomy || !newFabricLabel.trim()}
                      >
                        <Plus size={13} /> Add
                      </button>
                    </form>
                  </div>

                  {/* 3. Dynamic Colours & Color Picker */}
                  <div
                    style={{
                      background: "var(--surface-soft)",
                      border: "1px solid var(--line)",
                      borderRadius: 14,
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 10,
                        }}
                      >
                        <strong style={{ fontSize: 13 }}>
                          Colours &amp; Swatches ({taxonomy.colours.length})
                        </strong>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>
                          Visual Color Picker
                        </span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {taxonomy.colours.map((col) => (
                          <span
                            key={col.value}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "5px 10px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 600,
                              background: "var(--surface)",
                              border: "1px solid var(--line)",
                            }}
                          >
                            <span
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                background: col.swatch,
                                border: "1px solid rgba(0,0,0,0.18)",
                                flexShrink: 0,
                              }}
                            />
                            {col.label}
                            {taxonomy.colours.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteColour(col.value)}
                                aria-label={`Delete colour ${col.label}`}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color: "var(--muted)",
                                  padding: 0,
                                  display: "inline-flex",
                                  cursor: "pointer",
                                }}
                              >
                                <X size={13} />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>

                    <form onSubmit={handleAddColour} style={{ display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          type="color"
                          aria-label="Pick colour hex swatch"
                          title="Choose colour from picker"
                          value={
                            newColourSwatch.startsWith("#") && newColourSwatch.length === 7
                              ? newColourSwatch
                              : "#0f766e"
                          }
                          onChange={(e) => setNewColourSwatch(e.target.value)}
                          style={{
                            width: 36,
                            height: 34,
                            padding: 2,
                            borderRadius: 8,
                            border: "1px solid var(--line)",
                            background: "var(--surface)",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        />
                        <input
                          type="text"
                          className="adm-input-sm"
                          style={{ width: 82, fontFamily: "monospace", fontSize: 12 }}
                          value={newColourSwatch}
                          onChange={(e) => setNewColourSwatch(e.target.value)}
                          placeholder="#0f766e"
                        />
                        <input
                          type="text"
                          className="adm-input-sm"
                          style={{ flex: 1 }}
                          placeholder="Colour name (e.g. Emerald, Navy)…"
                          value={newColourLabel}
                          onChange={(e) => setNewColourLabel(e.target.value)}
                        />
                        <button
                          type="submit"
                          className="adm-btn adm-btn-sm adm-btn-primary"
                          disabled={savingTaxonomy || !newColourLabel.trim()}
                        >
                          <Plus size={13} /> Add
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>

              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>Product Catalog ({filteredCatalogProducts.length})</h3>
                    <p className="adm-panel-sub">
                      Manage prices, cost of goods (COGS), SKUs, Cloudinary images, and homepage
                      placement
                    </p>
                  </div>
                  <div className="adm-table-controls">
                    <input
                      type="search"
                      className="adm-input-sm"
                      placeholder="Filter by title, SKU, colour…"
                      value={productCatalogSearch}
                      onChange={(e) => setProductCatalogSearch(e.target.value)}
                    />
                    <select
                      className="adm-select-sm"
                      value={productCategoryFilter}
                      onChange={(e) => setProductCategoryFilter(e.target.value)}
                    >
                      <option value="all">All Categories</option>
                      {taxonomy.categories.map((cat) => (
                        <option key={`cat-${cat.value}`} value={cat.value}>
                          Category: {cat.label}
                        </option>
                      ))}
                      {analytics.charts.categoryPerformance.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.name} ({c.productCount})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="adm-btn adm-btn-sm adm-btn-primary"
                      onClick={() => {
                        resetProductForm();
                        setShowProductFormModal(true);
                      }}
                    >
                      <Plus size={14} /> Add Product
                    </button>
                  </div>
                </div>

                <div className="adm-table-scroll">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Category / Fabric</th>
                        <th>Price</th>
                        <th>Cost (COGS)</th>
                        <th>Stock</th>
                        <th>Status</th>
                        <th>Sections</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCatalogProducts.map((product) => {
                        const colMeta = resolveColourMeta(product.colour, taxonomy.colours);
                        const catLabel =
                          taxonomy.categories.find((c) => c.value === product.category)?.label ??
                          product.category;
                        const fabLabel = product.fabric
                          ? (taxonomy.fabrics.find((f) => f.value === product.fabric)?.label ??
                            product.fabric)
                          : null;
                        return (
                          <tr key={product.id}>
                            <td>
                              <div className="adm-prod-cell">
                                <div className="adm-thumb-sm">
                                  <ProductPhoto photo={product.photo} sizes="48px" />
                                </div>
                                <div className="adm-cell-stack">
                                  <strong>{product.name}</strong>
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 5,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: "50%",
                                        background: colMeta.swatch,
                                        border: "1px solid rgba(0,0,0,0.2)",
                                        display: "inline-block",
                                      }}
                                    />
                                    {colMeta.label}
                                  </span>
                                  <span
                                    className={`adm-mini-tag ${product.fulfillmentSource === "supplier" ? "is-supplier" : ""}`}
                                    style={{ alignSelf: "flex-start", marginTop: 2 }}
                                  >
                                    {product.fulfillmentSource === "supplier"
                                      ? `🤝 Supplier Hub`
                                      : "📦 Own Stock"}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <code>{product.sku}</code>
                            </td>
                            <td>{fabLabel ? `${fabLabel} (${catLabel})` : catLabel}</td>
                            <td>
                              <strong>{formatPrice(product.price)}</strong>
                              {product.originalPrice && (
                                <del style={{ marginLeft: 5, fontSize: 11, color: "var(--muted)" }}>
                                  {formatPrice(product.originalPrice)}
                                </del>
                              )}
                            </td>
                            <td>
                              {product.costPrice !== null
                                ? formatPrice(product.costPrice)
                                : "Not set"}
                            </td>
                            <td>
                              <span
                                className={`adm-status-pill ${
                                  product.stock === 0
                                    ? "is-danger"
                                    : product.stock <= product.lowStockThreshold
                                      ? "is-warning"
                                      : "is-success"
                                }`}
                              >
                                {product.stock} units
                              </span>
                            </td>
                            <td>
                              <span
                                className={`adm-status-pill ${
                                  product.status === "active" ? "is-success" : ""
                                }`}
                              >
                                {product.status}
                              </span>
                            </td>
                            <td>
                              <div className="adm-tag-wrap">
                                {product.sections.map((sec) => (
                                  <span key={sec} className="adm-mini-tag">
                                    {sec}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <div className="adm-row-btns">
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-sm adm-btn-secondary"
                                  onClick={() => openEditProduct(product)}
                                >
                                  <Edit3 size={13} /> Edit
                                </button>
                                <Link
                                  href={`/products/${product.slug}`}
                                  className="adm-btn adm-btn-sm adm-btn-secondary"
                                >
                                  <ExternalLink size={13} />
                                </Link>
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-sm adm-btn-danger"
                                  onClick={() => handleDeleteProduct(product.id, product.name)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= 3. CATEGORIES SECTION ================= */}
          {activeSection === "categories" && (
            <div className="adm-section-stack">
              <CategoryPerformanceChart categories={analytics.charts.categoryPerformance} />

              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>Storefront Category &amp; Fabric Breakdown</h3>
                    <p className="adm-panel-sub">
                      Click any category to filter its products in the catalog manager
                    </p>
                  </div>
                  <button
                    type="button"
                    className="adm-btn adm-btn-sm adm-btn-primary"
                    onClick={() => setActiveSection("products")}
                  >
                    Manage Categories, Fabrics &amp; Colours →
                  </button>
                </div>
                <div className="adm-table-scroll">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>Category / Fabric Name</th>
                        <th>Active Products</th>
                        <th>Total Stock</th>
                        <th>Units Sold (Period)</th>
                        <th>Revenue Generated</th>
                        <th>Share %</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.charts.categoryPerformance.map((cat) => (
                        <tr key={cat.key}>
                          <td>
                            <strong>{cat.name}</strong>
                          </td>
                          <td>{cat.productCount}</td>
                          <td>{cat.stockQuantity} units</td>
                          <td>{cat.unitsSold}</td>
                          <td>
                            <strong>{formatPrice(cat.revenue)}</strong>
                          </td>
                          <td>{cat.sharePercent}%</td>
                          <td>
                            <button
                              type="button"
                              className="adm-btn adm-btn-sm adm-btn-secondary"
                              onClick={() => {
                                setProductCategoryFilter(cat.key);
                                setActiveSection("products");
                              }}
                            >
                              View Products →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= 4. ORDERS SECTION ================= */}
          {activeSection === "orders" && (
            <div className="adm-section-stack">
              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>Order Management ({filteredOrders.length})</h3>
                    <p className="adm-panel-sub">
                      Search, filter, update order/payment/delivery statuses, and process refunds
                    </p>
                  </div>
                  <div className="adm-table-controls">
                    <input
                      type="search"
                      className="adm-input-sm"
                      placeholder="Search ID, name, phone…"
                      value={orderSearch}
                      onChange={(e) => {
                        setOrderSearch(e.target.value);
                        setOrderPage(1);
                      }}
                    />
                    <select
                      className="adm-select-sm"
                      value={orderStatusFilter}
                      onChange={(e) => {
                        setOrderStatusFilter(e.target.value);
                        setOrderPage(1);
                      }}
                    >
                      <option value="all">All Order Statuses</option>
                      {ORDER_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {formatAdminOrderStatusOption(st)}
                        </option>
                      ))}
                    </select>
                    <select
                      className="adm-select-sm"
                      value={orderPaymentFilter}
                      onChange={(e) => {
                        setOrderPaymentFilter(e.target.value);
                        setOrderPage(1);
                      }}
                    >
                      <option value="all">All Payment Statuses</option>
                      {PAYMENT_STATUSES.map((ps) => (
                        <option key={ps} value={ps}>
                          {ps}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="adm-btn adm-btn-sm adm-btn-secondary"
                      onClick={exportOrdersCsv}
                    >
                      <Download size={14} /> Export CSV
                    </button>
                    <button
                      type="button"
                      className="adm-btn adm-btn-sm adm-btn-primary"
                      onClick={() => setShowManualOrderModal(true)}
                    >
                      <Plus size={14} /> Record Order
                    </button>
                  </div>
                </div>

                {filteredOrders.length === 0 ? (
                  <div className="adm-empty-state">
                    <ShoppingCart size={28} />
                    <h4>No Orders Found</h4>
                    <p>No orders match the current filters.</p>
                  </div>
                ) : (
                  <div className="adm-table-scroll">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>Customer</th>
                          <th>Items</th>
                          <th>Date</th>
                          <th>Total</th>
                          <th>Refunded</th>
                          <th>Payment Status</th>
                          <th>Order Status</th>
                          <th>Delivery Status</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((order) => (
                          <tr key={order.id}>
                            <td>
                              <strong>{order.id}</strong>
                            </td>
                            <td>
                              <div className="adm-cell-stack">
                                <strong>{order.customer.name}</strong>
                                <span>
                                  {order.customer.phone} · {order.customer.city}
                                </span>
                                <div style={{ marginTop: 2, display: "flex", gap: 6, alignItems: "center" }}>
                                  {(() => {
                                    const fraud = fraudResults[order.customer.phone];
                                    if (fraud) {
                                      const badgeClass =
                                        fraud.riskLevel === "safe"
                                          ? "is-success"
                                          : fraud.riskLevel === "moderate"
                                            ? "is-warning"
                                            : "is-danger";
                                      return (
                                        <span
                                          className={`adm-status-pill ${badgeClass}`}
                                          style={{ fontSize: 10, padding: "1px 6px" }}
                                          title={`Delivery Rate: ${fraud.successRate}%, Total Orders: ${fraud.totalOrders}, Returns: ${fraud.totalCancelled}`}
                                        >
                                          {fraud.riskLevel === "safe" ? "🟢 Safe" : fraud.riskLevel === "moderate" ? "🟡 Moderate" : "🔴 High Risk"} ({fraud.successRate}%)
                                        </span>
                                      );
                                    }
                                    return (
                                      <button
                                        type="button"
                                        className="adm-btn adm-btn-xs adm-btn-secondary"
                                        style={{ fontSize: 10, padding: "1px 6px", height: "auto" }}
                                        onClick={() => void handleCheckFraud(order.customer.phone)}
                                        disabled={fraudCheckingPhone === order.customer.phone}
                                        title="Check delivery fraud & Steadfast courier history"
                                      >
                                        {fraudCheckingPhone === order.customer.phone ? "Checking…" : "🛡️ Fraud Check"}
                                      </button>
                                    );
                                  })()}
                                </div>
                              </div>
                            </td>
                            <td>
                              {order.items.map((item, idx) => (
                                <div key={`${item.id || item.name}-${item.colour || ""}-${idx}`} style={{ fontSize: 12 }}>
                                  {item.name} × {item.quantity}
                                  {item.fulfillmentSource === "supplier" && (
                                    <span
                                      className="adm-mini-tag is-supplier"
                                      style={{ marginLeft: 5, fontSize: 9.5, padding: "1px 5px" }}
                                    >
                                      Supplier
                                    </span>
                                  )}
                                </div>
                              ))}
                              {(() => {
                                const orderShipments = buildOrderShipments(order, analytics.settings.courier);
                                if (orderShipments.length > 1) {
                                  return (
                                    <span
                                      className="adm-status-pill is-ready"
                                      style={{ fontSize: 10, padding: "1px 6px", marginTop: 4 }}
                                    >
                                      📦 {orderShipments.length} Split Parcels
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </td>
                            <td>{formatOrderDate(order.createdAt, true)}</td>
                            <td>
                              <strong>{formatPrice(order.total)}</strong>
                            </td>
                            <td>
                              {order.refundAmount > 0 ? formatPrice(order.refundAmount) : "৳0"}
                            </td>
                            <td>
                              <div className="adm-cell-stack">
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color:
                                      order.paymentMethod === "bkash"
                                        ? "#be123c"
                                        : order.paymentMethod === "nagad"
                                          ? "#c2410c"
                                          : "var(--muted)",
                                  }}
                                >
                                  {order.paymentMethod === "cod"
                                    ? "COD"
                                    : `${order.paymentMethod.toUpperCase()} (Manual)`}
                                </span>
                                <select
                                  className="adm-select-sm"
                                  value={order.paymentStatus}
                                  onChange={(e) =>
                                    void handleUpdateOrder({
                                      id: order.id,
                                      paymentStatus: e.target.value as AdminPaymentStatus,
                                    })
                                  }
                                >
                                  {PAYMENT_STATUSES.map((ps) => (
                                    <option key={ps} value={ps}>
                                      {ps}
                                    </option>
                                  ))}
                                </select>
                                {order.paymentTrxId && (
                                  <span style={{ fontSize: 11, fontFamily: "monospace" }}>
                                    TrxID: <strong>{order.paymentTrxId}</strong>
                                  </span>
                                )}
                                {order.paymentPhone && (
                                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                                    From: {order.paymentPhone}
                                  </span>
                                )}
                                {order.paymentMethod !== "cod" && order.paymentStatus === "Pending" && (
                                  <button
                                    type="button"
                                    className="adm-btn adm-btn-xs adm-btn-primary"
                                    style={{ marginTop: 2, fontSize: 11, padding: "3px 8px", height: "auto" }}
                                    disabled={verifyingOrderId === order.id}
                                    onClick={() => void handleVerifyManualPayment(order.id, true)}
                                  >
                                    <CheckCircle2 size={11} />{" "}
                                    {verifyingOrderId === order.id ? "Verifying…" : "Verify & Confirm"}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="adm-cell-stack">
                                <select
                                  className="adm-select-sm"
                                  value={order.status}
                                  onChange={(e) =>
                                    void handleUpdateOrder({
                                      id: order.id,
                                      status: e.target.value as AdminOrderStatus,
                                    })
                                  }
                                >
                                  {ORDER_STATUSES.map((st) => (
                                    <option key={st} value={st}>
                                      {formatAdminOrderStatusOption(st)}
                                    </option>
                                  ))}
                                </select>
                                {order.paymentMethod === "cod" && order.status === "Pending" && (
                                  <button
                                    type="button"
                                    className="adm-btn adm-btn-xs adm-btn-primary"
                                    style={{ marginTop: 2, fontSize: 11, padding: "3px 8px", height: "auto" }}
                                    onClick={() =>
                                      void handleUpdateOrder({
                                        id: order.id,
                                        status: "Confirmed",
                                      })
                                    }
                                  >
                                    <CheckCircle2 size={11} /> Confirm (Ready to Ship)
                                  </button>
                                )}
                              </div>
                            </td>
                            <td>
                              <select
                                className="adm-select-sm"
                                value={order.deliveryStatus}
                                onChange={(e) =>
                                  void handleUpdateOrder({
                                    id: order.id,
                                    deliveryStatus: e.target.value as AdminDeliveryStatus,
                                  })
                                }
                              >
                                {DELIVERY_STATUSES.map((ds) => (
                                  <option key={ds} value={ds}>
                                    {formatAdminDeliveryOption(ds)}
                                  </option>
                                ))}
                              </select>
                              {(() => {
                                const tracked = (order.shipments ?? []).filter(
                                  (s) => s.trackingCode || s.consignmentId,
                                );
                                if (tracked.length > 0) {
                                  return (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                                      {tracked.map((pkg) => {
                                        const code = pkg.trackingCode || pkg.consignmentId || "";
                                        const prefix =
                                          pkg.courierProvider === "pathao"
                                            ? "Pathao"
                                            : pkg.courierProvider === "manual"
                                              ? "Manual"
                                              : "SF";
                                        return (
                                          <span
                                            key={pkg.id}
                                            className="adm-status-pill is-info"
                                            style={{ fontSize: 10, padding: "1px 6px" }}
                                            title={`${pkg.label} · ${pkg.deliveryStatus}`}
                                          >
                                            🚚 {tracked.length > 1 ? `${pkg.id} ` : ""}
                                            {prefix}: {code}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  );
                                }
                                if (order.courierTrackingCode) {
                                  return (
                                    <div style={{ fontSize: 11, marginTop: 4 }}>
                                      <span className="adm-status-pill is-info" style={{ fontSize: 10, padding: "1px 6px" }}>
                                        🚚 {order.courierTrackingCode}
                                      </span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </td>
                            <td>
                              {(() => {
                                const orderShipments = buildOrderShipments(order, analytics.settings.courier);
                                const pendingParcels = orderShipments.filter(
                                  (s) => !s.trackingCode && !s.consignmentId,
                                );
                                const hasAnyTracked = orderShipments.some(
                                  (s) => s.trackingCode || s.consignmentId,
                                );
                                return (
                                  <div className="adm-row-actions">
                                    <button
                                      type="button"
                                      className="adm-btn adm-btn-sm adm-btn-secondary"
                                      onClick={() => setSelectedOrder(order)}
                                    >
                                      <Eye size={13} /> Inspect
                                    </button>
                                    <button
                                      type="button"
                                      className="adm-btn adm-btn-sm adm-btn-secondary"
                                      onClick={() => handlePrintInvoice(order)}
                                      title="Print Order Invoice & Packing Slip"
                                    >
                                      <Printer size={13} /> Invoice
                                    </button>
                                    {order.status !== "Cancelled" && pendingParcels.length === 1 && orderShipments.length === 1 && (
                                      <button
                                        type="button"
                                        className="adm-btn adm-btn-sm adm-btn-primary"
                                        onClick={() =>
                                          void handleDispatchCourier(order, {
                                            shipment: pendingParcels[0],
                                          })
                                        }
                                        disabled={dispatchingOrderId === order.id}
                                        title={`Dispatch via ${(pendingParcels[0].courierProvider || "steadfast").toUpperCase()}`}
                                      >
                                        <Truck size={13} />{" "}
                                        {dispatchingOrderId === order.id
                                          ? "…"
                                          : pendingParcels[0].courierProvider === "pathao"
                                            ? "Pathao"
                                            : "Steadfast"}
                                      </button>
                                    )}
                                    {order.status !== "Cancelled" &&
                                      (orderShipments.length > 1 && pendingParcels.length > 0) && (
                                        <button
                                          type="button"
                                          className="adm-btn adm-btn-sm adm-btn-primary"
                                          onClick={() => setSelectedOrder(order)}
                                          title="Open split-shipment dispatch controls"
                                        >
                                          <Truck size={13} /> Dispatch ({pendingParcels.length})
                                        </button>
                                      )}
                                    {hasAnyTracked && (
                                      <button
                                        type="button"
                                        className="adm-btn adm-btn-sm adm-btn-secondary"
                                        onClick={() => void handleSyncCourierStatus(order)}
                                        disabled={syncingCourierOrderId === order.id}
                                        title="Sync live parcel status from Steadfast / Pathao"
                                      >
                                        <RefreshCw
                                          size={13}
                                          className={syncingCourierOrderId === order.id ? "adm-spin" : ""}
                                        />
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= 5. CUSTOMERS SECTION ================= */}
          {activeSection === "customers" && (
            <div className="adm-section-stack">
              <CustomerAnalyticsChart
                customersMetrics={analytics.customersMetrics}
                series={analytics.charts.dailySeries}
              />

              {/* Registered Customer Accounts & Password Reset */}
              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>
                      Registered Customer Accounts &amp; Password Reset (
                      {registeredCustomers.length})
                    </h3>
                    <p className="adm-panel-sub">
                      Manage registered storefront accounts and reset passwords when a customer
                      forgets theirs
                    </p>
                  </div>
                </div>

                {registeredCustomers.length === 0 ? (
                  <div className="adm-empty-state">
                    <Users size={28} />
                    <h4>No Registered Customer Accounts Yet</h4>
                    <p>
                      Customers who sign up on the `/account` page will appear here for account
                      support and password resets.
                    </p>
                  </div>
                ) : (
                  <div className="adm-table-scroll">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>Account ID</th>
                          <th>Customer Name</th>
                          <th>Phone</th>
                          <th>Email</th>
                          <th>Address &amp; City</th>
                          <th>Joined</th>
                          <th>Password Reset</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registeredCustomers.map((acct) => {
                          const isResetting = resettingCustomerId === acct.id;
                          return (
                            <tr key={acct.id}>
                              <td>
                                <code>{acct.id}</code>
                              </td>
                              <td>
                                <strong>{acct.name}</strong>
                              </td>
                              <td>{acct.phone}</td>
                              <td>{acct.email || "—"}</td>
                              <td>
                                {acct.address
                                  ? `${acct.address}${acct.city ? `, ${acct.city}` : ""}`
                                  : acct.city || "—"}
                              </td>
                              <td>{formatOrderDate(acct.createdAt)}</td>
                              <td>
                                {isResetting ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <input
                                      type="text"
                                      className="adm-input-sm"
                                      placeholder="New password (min 4 chars)"
                                      value={resetPasswordInput}
                                      onChange={(e) => setResetPasswordInput(e.target.value)}
                                      style={{ width: 170 }}
                                    />
                                    <button
                                      type="button"
                                      className="adm-btn adm-btn-sm adm-btn-primary"
                                      disabled={savingCustomerReset}
                                      onClick={() => void handleAdminResetCustomerPassword(acct)}
                                    >
                                      <Check size={13} />{" "}
                                      {savingCustomerReset ? "Saving…" : "Confirm"}
                                    </button>
                                    <button
                                      type="button"
                                      className="adm-btn adm-btn-sm adm-btn-secondary"
                                      onClick={() => {
                                        setResettingCustomerId(null);
                                        setResetPasswordInput("");
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="adm-btn adm-btn-sm adm-btn-secondary"
                                    onClick={() => {
                                      setResettingCustomerId(acct.id);
                                      setResetPasswordInput("hayanest1234");
                                    }}
                                  >
                                    <Lock size={13} /> Reset Password
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Customer Contact Inquiries (from /contact form) */}
              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>
                      Customer Contact Inquiries ({contactMessages.length} total ·{" "}
                      {unreadContactMessagesCount} unread)
                    </h3>
                    <p className="adm-panel-sub">
                      Messages submitted by customers on the `/contact` page
                    </p>
                  </div>
                </div>

                {contactMessages.length === 0 ? (
                  <div className="adm-empty-state">
                    <MessageSquare size={28} />
                    <h4>No Contact Messages Yet</h4>
                    <p>Inquiries submitted via the Contact Us page will appear here.</p>
                  </div>
                ) : (
                  <div className="adm-table-scroll">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Sender</th>
                          <th>Topic</th>
                          <th>Message</th>
                          <th>Received</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contactMessages.map((msg) => (
                          <tr key={msg.id}>
                            <td>
                              <span
                                className={`adm-status-pill ${
                                  msg.status === "resolved" ? "is-success" : "is-warning"
                                }`}
                              >
                                {msg.status === "resolved" ? "Resolved" : "Unread"}
                              </span>
                            </td>
                            <td>
                              <div className="adm-cell-stack">
                                <strong>{msg.name}</strong>
                                <span>{msg.contact}</span>
                              </div>
                            </td>
                            <td>
                              <strong>{msg.topic}</strong>
                            </td>
                            <td style={{ maxWidth: 340, whiteSpace: "pre-wrap", fontSize: 13 }}>
                              {msg.message}
                            </td>
                            <td>{formatOrderDate(msg.createdAt, true)}</td>
                            <td>
                              <div className="adm-row-btns">
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-sm adm-btn-secondary"
                                  onClick={() => void handleToggleContactMessageStatus(msg)}
                                >
                                  {msg.status === "unread" ? "Mark Resolved" : "Mark Unread"}
                                </button>
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-sm adm-btn-danger"
                                  onClick={() => void handleDeleteContactMessage(msg.id)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>Top Customers &amp; Retention Directory</h3>
                    <p className="adm-panel-sub">
                      Privacy-protected customer insights derived from order history
                    </p>
                  </div>
                </div>

                {analytics.tables.topCustomers.length === 0 ? (
                  <div className="adm-empty-state">
                    <Users size={28} />
                    <h4>0 Customers Recorded</h4>
                    <p>Customer profiles are automatically built as orders are placed.</p>
                  </div>
                ) : (
                  <div className="adm-table-scroll">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>Customer Name</th>
                          <th>Protected Contact</th>
                          <th>City</th>
                          <th>Segment</th>
                          <th>Total Orders</th>
                          <th>Total Spending</th>
                          <th>Average Order Value</th>
                          <th>Last Order Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.tables.topCustomers.map((cust) => (
                          <tr key={cust.customerKey}>
                            <td>
                              <strong>{cust.name}</strong>
                            </td>
                            <td>{cust.phoneMasked}</td>
                            <td>{cust.city}</td>
                            <td>
                              <span
                                className={`adm-status-pill ${
                                  cust.isReturning ? "is-success" : ""
                                }`}
                              >
                                {cust.isReturning ? "Returning" : "New Buyer"}
                              </span>
                            </td>
                            <td>{cust.totalOrders}</td>
                            <td>
                              <strong>{formatPrice(cust.totalSpent)}</strong>
                            </td>
                            <td>{formatPrice(cust.averageSpend)}</td>
                            <td>{cust.lastOrderDate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= 6. INVENTORY SECTION (Variant-Level) ================= */}
          {activeSection === "inventory" && (
            <div className="adm-section-stack">
              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>Variant-Level Hijab Inventory ({filteredVariants.length} Variants)</h3>
                    <p className="adm-panel-sub">
                      Manage independent stock per Color, Size, Fabric, SKU, and configure Cost
                      Price (COGS)
                    </p>
                  </div>
                  <div className="adm-table-controls">
                    <input
                      type="search"
                      className="adm-input-sm"
                      placeholder="Filter SKU, product, colour…"
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                    />
                    <div className="adm-seg-group">
                      <button
                        type="button"
                        className={`adm-seg-btn ${inventoryFilter === "all" ? "is-active" : ""}`}
                        onClick={() => setInventoryFilter("all")}
                      >
                        All ({analytics.tables.variantInventory.length})
                      </button>
                      <button
                        type="button"
                        className={`adm-seg-btn ${
                          inventoryFilter === "low_stock" ? "is-active" : ""
                        }`}
                        onClick={() => setInventoryFilter("low_stock")}
                      >
                        Low Stock ({analytics.tables.lowStockAlerts.length})
                      </button>
                      <button
                        type="button"
                        className={`adm-seg-btn ${
                          inventoryFilter === "out_of_stock" ? "is-active" : ""
                        }`}
                        onClick={() => setInventoryFilter("out_of_stock")}
                      >
                        Out of Stock ({analytics.tables.outOfStockAlerts.length})
                      </button>
                    </div>
                  </div>
                </div>

                <div className="adm-table-scroll">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>Product &amp; Variant</th>
                        <th>Variant SKU</th>
                        <th>Fabric &amp; Size</th>
                        <th>Color</th>
                        <th>Retail Price</th>
                        <th>Cost Price (COGS ৳)</th>
                        <th>Available Qty</th>
                        <th>Status</th>
                        <th>Save</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVariants.map((row) => {
                        const draft = variantDrafts[row.variantKey];
                        const stockVal =
                          draft?.stock !== undefined ? draft.stock : String(row.stock);
                        const costVal =
                          draft?.costPrice !== undefined
                            ? draft.costPrice
                            : row.costPrice !== null
                              ? String(row.costPrice)
                              : "";
                        return (
                          <tr key={row.variantKey}>
                            <td>
                              <div className="adm-prod-cell">
                                <div className="adm-thumb-sm">
                                  <ProductPhoto photo={row.photo} sizes="44px" />
                                </div>
                                <strong>{row.productName}</strong>
                              </div>
                            </td>
                            <td>
                              <code>{row.sku}</code>
                            </td>
                            <td>
                              {row.fabric || row.category} · {row.size}
                            </td>
                            <td style={{ textTransform: "capitalize" }}>{row.colour}</td>
                            <td>{formatPrice(row.price)}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                className="adm-input-sm"
                                style={{ width: 95 }}
                                placeholder="Set cost"
                                value={costVal}
                                onChange={(e) =>
                                  setVariantDrafts((prev) => ({
                                    ...prev,
                                    [row.variantKey]: {
                                      stock: stockVal,
                                      costPrice: e.target.value,
                                    },
                                  }))
                                }
                                aria-label={`Cost price for ${row.productName} ${row.colour}`}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                className="adm-input-sm"
                                style={{ width: 82 }}
                                value={stockVal}
                                onChange={(e) =>
                                  setVariantDrafts((prev) => ({
                                    ...prev,
                                    [row.variantKey]: {
                                      stock: e.target.value,
                                      costPrice: costVal,
                                    },
                                  }))
                                }
                                aria-label={`Stock quantity for ${row.productName} ${row.colour}`}
                              />
                            </td>
                            <td>
                              <span
                                className={`adm-status-pill ${
                                  row.stockState === "out_of_stock"
                                    ? "is-danger"
                                    : row.stockState === "low_stock"
                                      ? "is-warning"
                                      : "is-success"
                                }`}
                              >
                                {row.stockState === "out_of_stock"
                                  ? "Out of Stock"
                                  : row.stockState === "low_stock"
                                    ? "Low Stock"
                                    : "In Stock"}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="adm-btn adm-btn-sm adm-btn-primary"
                                disabled={savingVariantKey === row.variantKey}
                                onClick={() => void handleSaveVariantStock(row)}
                              >
                                {savingVariantKey === row.variantKey ? "Saving…" : "Update"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= 7. COUPONS & DISCOUNTS SECTION ================= */}
          {activeSection === "coupons" && (
            <div className="adm-grid-2">
              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>Create Discount Coupon</h3>
                    <p className="adm-panel-sub">
                      Create promotional codes for percentage or fixed BDT discounts
                    </p>
                  </div>
                </div>
                <form className="adm-form-stack" onSubmit={handleCreateCoupon}>
                  <div className="adm-field">
                    <label htmlFor="cpn-code">Coupon Code</label>
                    <input
                      id="cpn-code"
                      type="text"
                      className="adm-input"
                      placeholder="e.g. EID20 or HAYA100"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      required
                    />
                  </div>
                  <div className="adm-form-row-2">
                    <div className="adm-field">
                      <label htmlFor="cpn-type">Discount Type</label>
                      <select
                        id="cpn-type"
                        className="adm-select"
                        value={couponType}
                        onChange={(e) =>
                          setCouponType(e.target.value as "percentage" | "fixed")
                        }
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount (৳)</option>
                      </select>
                    </div>
                    <div className="adm-field">
                      <label htmlFor="cpn-val">Discount Value</label>
                      <input
                        id="cpn-val"
                        type="number"
                        min="1"
                        className="adm-input"
                        value={couponValue}
                        onChange={(e) => setCouponValue(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="adm-field">
                    <label htmlFor="cpn-min">Minimum Order Amount (৳)</label>
                    <input
                      id="cpn-min"
                      type="number"
                      min="0"
                      className="adm-input"
                      value={couponMinOrder}
                      onChange={(e) => setCouponMinOrder(e.target.value)}
                    />
                  </div>
                  <div className="adm-field">
                    <label htmlFor="cpn-desc">Description</label>
                    <input
                      id="cpn-desc"
                      type="text"
                      className="adm-input"
                      placeholder="e.g. Festive Modal Collection Offer"
                      value={couponDesc}
                      onChange={(e) => setCouponDesc(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="adm-btn adm-btn-primary"
                    disabled={savingCoupon}
                  >
                    <Plus size={15} /> {savingCoupon ? "Saving…" : "Save Coupon"}
                  </button>
                </form>
              </div>

              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>Active Coupons ({analytics.coupons.length})</h3>
                    <p className="adm-panel-sub">
                      Total discounts given in period:{" "}
                      {formatPrice(analytics.salesAndRevenue.periodDiscountsGiven)}
                    </p>
                  </div>
                </div>
                {analytics.coupons.length === 0 ? (
                  <p className="adm-muted-note">No promotional coupons created yet.</p>
                ) : (
                  <div className="adm-mini-stat-list">
                    {analytics.coupons.map((cpn) => (
                      <div key={cpn.id} className="adm-mini-stat-row">
                        <div>
                          <strong>{cpn.code}</strong>
                          <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
                            {cpn.description} · Min order {formatPrice(cpn.minOrderAmount)}
                          </span>
                        </div>
                        <div className="adm-row-btns">
                          <button
                            type="button"
                            className="adm-btn adm-btn-sm adm-btn-secondary"
                            onClick={() => void handleToggleCoupon(cpn)}
                          >
                            {cpn.active ? "Active" : "Paused"}
                          </button>
                          <button
                            type="button"
                            className="adm-btn adm-btn-sm adm-btn-danger"
                            onClick={() => void handleDeleteCoupon(cpn.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= 8. ANALYTICS & REPORTS SECTION ================= */}
          {activeSection === "analytics" && (
            <div className="adm-section-stack">
              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>Executive Financial &amp; Operational Reconciliation</h3>
                    <p className="adm-panel-sub">
                      Complete 43-metric view and exportable reports for {analytics.meta.startDate}{" "}
                      to {analytics.meta.endDate}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="adm-btn adm-btn-sm adm-btn-primary"
                    onClick={exportOrdersCsv}
                  >
                    <Download size={14} /> Export Orders CSV
                  </button>
                </div>
                <AdminKpiGrid
                  analytics={analytics}
                  onConfigureCosts={() => setActiveSection("inventory")}
                />
              </div>

              <div className="adm-grid-2">
                <RevenueAnalyticsChart charts={analytics.charts} />
                <PaymentAnalyticsChart
                  paymentStatuses={analytics.charts.paymentStatusBreakdown}
                  paymentMethods={analytics.charts.paymentMethodBreakdown}
                />
              </div>
            </div>
          )}

          {/* ================= 9. REVIEWS SECTION ================= */}
          {activeSection === "reviews" && (
            <div className="adm-panel">
              <div className="adm-panel-head">
                <div>
                  <h3>Customer Product Reviews &amp; Moderation</h3>
                  <p className="adm-panel-sub">
                    Moderate verified customer feedback before it publishes to the storefront
                  </p>
                </div>
                <div className="adm-head-actions">
                  <div className="adm-search-box">
                    <Search size={15} />
                    <input
                      type="text"
                      placeholder="Search customer, product, comment..."
                      value={reviewSearch}
                      onChange={(e) => setReviewSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Reviews Summary Stats */}
              <div className="adm-grid-4" style={{ marginBottom: 18 }}>
                <div className="adm-stat-card">
                  <span className="adm-stat-label">Total Reviews</span>
                  <strong className="adm-stat-value">{reviews.length}</strong>
                  <span className="adm-stat-sub">Customer submissions</span>
                </div>
                <div className="adm-stat-card">
                  <span className="adm-stat-label">Pending Approval</span>
                  <strong className="adm-stat-value" style={{ color: "#d97706" }}>
                    {pendingReviewsCount}
                  </strong>
                  <span className="adm-stat-sub">Requires moderation</span>
                </div>
                <div className="adm-stat-card">
                  <span className="adm-stat-label">Approved Live</span>
                  <strong className="adm-stat-value" style={{ color: "#059669" }}>
                    {approvedReviewsCount}
                  </strong>
                  <span className="adm-stat-sub">Visible on storefront</span>
                </div>
                <div className="adm-stat-card">
                  <span className="adm-stat-label">Average Score</span>
                  <strong className="adm-stat-value" style={{ color: "#b45309" }}>
                    ★ {reviewsAverageRating}
                  </strong>
                  <span className="adm-stat-sub">Out of 5.0 stars</span>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="adm-tab-row" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button
                  type="button"
                  className={`adm-btn adm-btn-sm ${reviewFilter === "all" ? "adm-btn-primary" : "adm-btn-secondary"}`}
                  onClick={() => setReviewFilter("all")}
                >
                  All ({reviews.length})
                </button>
                <button
                  type="button"
                  className={`adm-btn adm-btn-sm ${reviewFilter === "pending" ? "adm-btn-primary" : "adm-btn-secondary"}`}
                  onClick={() => setReviewFilter("pending")}
                >
                  Pending ({pendingReviewsCount})
                </button>
                <button
                  type="button"
                  className={`adm-btn adm-btn-sm ${reviewFilter === "approved" ? "adm-btn-primary" : "adm-btn-secondary"}`}
                  onClick={() => setReviewFilter("approved")}
                >
                  Approved ({approvedReviewsCount})
                </button>
                <button
                  type="button"
                  className={`adm-btn adm-btn-sm ${reviewFilter === "rejected" ? "adm-btn-primary" : "adm-btn-secondary"}`}
                  onClick={() => setReviewFilter("rejected")}
                >
                  Rejected ({rejectedReviewsCount})
                </button>
              </div>

              {filteredReviews.length === 0 ? (
                <div className="adm-empty-state">
                  <MessageSquare size={28} />
                  <h4>No Customer Reviews Found</h4>
                  <p>
                    {reviewSearch || reviewFilter !== "all"
                      ? "No reviews match your current filters or search term."
                      : "No customer reviews have been submitted yet. When a customer receives their order and rates their hijab, it will appear here for moderation."}
                  </p>
                </div>
              ) : (
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Rating &amp; Review</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th className="adm-th-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReviews.map((rev) => (
                        <tr key={rev.id}>
                          <td>
                            <div className="adm-cell-stack">
                              <strong>{rev.productName || "Product"}</strong>
                              <span className="adm-cell-sub">ID: {rev.productId}</span>
                            </div>
                          </td>
                          <td style={{ maxWidth: 340 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <span style={{ color: "#f59e0b", letterSpacing: 2 }}>
                                {"★".repeat(rev.rating)}
                                {"☆".repeat(5 - rev.rating)}
                              </span>
                              <strong>{rev.rating}.0</strong>
                              {rev.title && (
                                <span style={{ fontWeight: 600, color: "var(--ink)" }}>· {rev.title}</span>
                              )}
                            </div>
                            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.45 }}>
                              {rev.comment}
                            </p>
                          </td>
                          <td>
                            <div className="adm-cell-stack" style={{ alignItems: "flex-start" }}>
                              <strong>{rev.customerName}</strong>
                              {rev.customerPhone && (
                                <span className="adm-cell-sub">{rev.customerPhone}</span>
                              )}
                              {rev.orderId && (
                                <span
                                  style={{
                                    display: "inline-block",
                                    marginTop: 3,
                                    fontSize: 11,
                                    padding: "2px 7px",
                                    borderRadius: 4,
                                    background: "rgba(16, 185, 129, 0.12)",
                                    color: "#059669",
                                    fontWeight: 600,
                                  }}
                                >
                                  Order: {rev.orderId}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="adm-cell-sub">
                              {new Date(rev.createdAt).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: 11.5,
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.03em",
                                background:
                                  rev.status === "approved"
                                    ? "rgba(16, 185, 129, 0.12)"
                                    : rev.status === "rejected"
                                      ? "rgba(239, 68, 68, 0.12)"
                                      : "rgba(245, 158, 11, 0.15)",
                                color:
                                  rev.status === "approved"
                                    ? "#059669"
                                    : rev.status === "rejected"
                                      ? "#dc2626"
                                      : "#d97706",
                              }}
                            >
                              {rev.status}
                            </span>
                          </td>
                          <td>
                            <div className="adm-action-buttons" style={{ display: "flex", gap: 6 }}>
                              {rev.status !== "approved" && (
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-sm"
                                  style={{
                                    background: "#059669",
                                    color: "#fff",
                                    border: "none",
                                    padding: "4px 8px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    fontSize: 12,
                                  }}
                                  title="Approve review (Publish to storefront)"
                                  disabled={reviewProcessingId === rev.id}
                                  onClick={() => handleUpdateReviewStatus(rev.id, "approved")}
                                >
                                  <Check size={13} />
                                  Approve
                                </button>
                              )}
                              {rev.status !== "rejected" && (
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-sm"
                                  style={{
                                    background: "#dc2626",
                                    color: "#fff",
                                    border: "none",
                                    padding: "4px 8px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    fontSize: 12,
                                  }}
                                  title="Reject review"
                                  disabled={reviewProcessingId === rev.id}
                                  onClick={() => handleUpdateReviewStatus(rev.id, "rejected")}
                                >
                                  <X size={13} />
                                  Reject
                                </button>
                              )}
                              <button
                                type="button"
                                className="adm-icon-btn"
                                style={{ color: "#dc2626" }}
                                title="Delete review"
                                disabled={reviewProcessingId === rev.id}
                                onClick={() => handleDeleteReview(rev.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================= 10. BANNERS & CONTENT SECTION ================= */}
          {activeSection === "banners" && (
            <div className="adm-section-stack">
              <div className="adm-grid-2">
                <div className="adm-panel">
                  <div className="adm-panel-head">
                    <div>
                      <h3>Homepage Hero Carousel Editor (3 Slides)</h3>
                      <p className="adm-panel-sub">
                        Customize all 3 auto-sliding hero banners — headline, subtitle, CTA button,
                        and photograph for each slide
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="adm-btn adm-btn-sm adm-btn-secondary"
                        onClick={handleResetHeroBanner}
                      >
                        Reset Slide {activeBannerSlideIdx + 1}
                      </button>
                      <button
                        type="button"
                        className="adm-btn adm-btn-sm adm-btn-secondary"
                        onClick={handleResetAllHeroSlides}
                      >
                        Reset All 3
                      </button>
                    </div>
                  </div>

                  {/* 3-Slide Selector Tabs */}
                  <div
                    role="tablist"
                    aria-label="Hero Carousel Slides"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: 10,
                      marginBottom: 16,
                    }}
                  >
                    {([0, 1, 2] as const).map((slideIdx) => {
                      const slideItem = heroSlides[slideIdx];
                      const isActive = activeBannerSlideIdx === slideIdx;
                      return (
                        <button
                          key={slideIdx}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          onClick={() => setActiveBannerSlideIdx(slideIdx)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 10px",
                            borderRadius: 12,
                            border: isActive
                              ? "2px solid var(--accent-strong)"
                              : "1px solid var(--line)",
                            background: isActive ? "var(--surface-soft)" : "var(--surface)",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 8,
                              backgroundImage: `url("${slideItem.imageSrc || photos.hero.src}")`,
                              backgroundSize: "cover",
                              backgroundPosition: slideItem.imagePosition || "center",
                              border: "1px solid var(--line)",
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <strong
                              style={{
                                display: "block",
                                fontSize: 12,
                                color: isActive ? "var(--accent-strong)" : "var(--ink)",
                              }}
                            >
                              Slide {slideIdx + 1} {slideIdx === 0 ? "(Primary)" : ""}
                            </strong>
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                color: "var(--muted)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {slideItem.titleLine1} {slideItem.titleLine2}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <form className="adm-form-stack" onSubmit={handleSaveHeroBanner}>
                    <div className="adm-form-row-2">
                      <div className="adm-field">
                        <label htmlFor="ban-title-1">
                          Slide {activeBannerSlideIdx + 1} — Headline Line 1
                        </label>
                        <input
                          id="ban-title-1"
                          type="text"
                          className="adm-input"
                          placeholder="e.g. Everyday"
                          value={bannerTitle1}
                          onChange={(e) => setBannerTitle1(e.target.value)}
                          required
                        />
                      </div>
                      <div className="adm-field">
                        <label htmlFor="ban-title-2">
                          Slide {activeBannerSlideIdx + 1} — Headline Line 2
                        </label>
                        <input
                          id="ban-title-2"
                          type="text"
                          className="adm-input"
                          placeholder="e.g. Elegance"
                          value={bannerTitle2}
                          onChange={(e) => setBannerTitle2(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="adm-field">
                      <label htmlFor="ban-subtitle">
                        Slide {activeBannerSlideIdx + 1} — Banner Subtitle
                      </label>
                      <input
                        id="ban-subtitle"
                        type="text"
                        className="adm-input"
                        placeholder="e.g. Premium hijabs crafted for comfort and confidence"
                        value={bannerSubtitle}
                        onChange={(e) => setBannerSubtitle(e.target.value)}
                        required
                      />
                    </div>

                    <div className="adm-form-row-2">
                      <div className="adm-field">
                        <label htmlFor="ban-cta-label">CTA Button Label</label>
                        <input
                          id="ban-cta-label"
                          type="text"
                          className="adm-input"
                          placeholder="e.g. Explore Collection"
                          value={bannerCtaLabel}
                          onChange={(e) => setBannerCtaLabel(e.target.value)}
                          required
                        />
                      </div>
                      <div className="adm-field">
                        <label htmlFor="ban-cta-href">CTA Button Link (URL / Hash)</label>
                        <input
                          id="ban-cta-href"
                          type="text"
                          className="adm-input"
                          placeholder="e.g. #new-items or /shop"
                          value={bannerCtaHref}
                          onChange={(e) => setBannerCtaHref(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="adm-field">
                      <label>
                        Slide {activeBannerSlideIdx + 1} Photograph (Upload or Choose Studio Preset)
                      </label>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <label
                          className="adm-btn adm-btn-sm adm-btn-secondary"
                          style={{ cursor: "pointer" }}
                        >
                          <CloudUpload size={14} />
                          {uploadingBannerImage
                            ? `Uploading Slide ${activeBannerSlideIdx + 1}...`
                            : status.cloudinaryConfigured
                              ? `Upload Slide ${activeBannerSlideIdx + 1} Photo (Cloudinary)`
                              : `Upload Slide ${activeBannerSlideIdx + 1} Photo`}
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            disabled={uploadingBannerImage}
                            onChange={handleBannerFileSelect}
                          />
                        </label>
                        <button
                          type="button"
                          className={`adm-chip ${bannerImageSrc === photos.hero.src ? "is-active" : ""}`}
                          onClick={() => {
                            updateCurrentBannerSlide({
                              imageSrc: photos.hero.src,
                              imageAlt: photos.hero.alt,
                              imagePosition: photos.hero.position || "74% 18%",
                            });
                          }}
                        >
                          Hero Default
                        </button>
                        {PRESET_PHOTOS.slice(0, 5).map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            className={`adm-chip ${bannerImageSrc === preset.photo.src ? "is-active" : ""}`}
                            onClick={() => {
                              updateCurrentBannerSlide({
                                imageSrc: preset.photo.src,
                                imageAlt: preset.photo.alt,
                                imagePosition: "50% 25%",
                              });
                            }}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="adm-form-row-2">
                      <div className="adm-field">
                        <label htmlFor="ban-img-src">
                          Slide {activeBannerSlideIdx + 1} Image URL / Path
                        </label>
                        <input
                          id="ban-img-src"
                          type="text"
                          className="adm-input"
                          value={bannerImageSrc}
                          onChange={(e) => setBannerImageSrc(e.target.value)}
                          required
                        />
                      </div>
                      <div className="adm-field">
                        <label htmlFor="ban-img-pos">Image Focus Position (CSS)</label>
                        <input
                          id="ban-img-pos"
                          type="text"
                          className="adm-input"
                          placeholder="e.g. 74% 18% or center"
                          value={bannerImagePosition}
                          onChange={(e) => setBannerImagePosition(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="adm-field">
                      <label htmlFor="ban-img-alt">
                        Image Alt Description (SEO &amp; Accessibility)
                      </label>
                      <input
                        id="ban-img-alt"
                        type="text"
                        className="adm-input"
                        value={bannerImageAlt}
                        onChange={(e) => setBannerImageAlt(e.target.value)}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
                      <button
                        type="submit"
                        className="adm-btn adm-btn-primary"
                        disabled={savingBanner}
                      >
                        {savingBanner
                          ? "Publishing All 3 Slides..."
                          : "Save & Publish All 3 Hero Slides"}
                      </button>
                      <Link
                        href="/"
                        target="_blank"
                        className="adm-btn adm-btn-secondary"
                        style={{ textDecoration: "none" }}
                      >
                        <ExternalLink size={14} /> View Homepage
                      </Link>
                    </div>
                  </form>
                </div>

                <div className="adm-panel">
                  <div className="adm-panel-head">
                    <div>
                      <h3>Live Hero Carousel Preview (Slide {activeBannerSlideIdx + 1} of 3)</h3>
                      <p className="adm-panel-sub">
                        Real-time preview of Slide {activeBannerSlideIdx + 1} — auto-cycles every
                        4.8s on the storefront
                      </p>
                    </div>
                    <span className="adm-status-pill is-success">Auto-Carousel Ready</span>
                  </div>

                  <div
                    style={{
                      position: "relative",
                      borderRadius: 16,
                      overflow: "hidden",
                      minHeight: 280,
                      background: "#1c1917",
                      border: "1px solid var(--line)",
                      display: "flex",
                      alignItems: "flex-end",
                      padding: 24,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={bannerImageSrc || photos.hero.src}
                      alt={bannerImageAlt || "Hero banner preview"}
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: bannerImagePosition || "74% 18%",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(90deg, rgba(20, 17, 15, 0.78) 0%, rgba(20, 17, 15, 0.42) 55%, rgba(20, 17, 15, 0.12) 100%)",
                      }}
                    />
                    <div
                      style={{
                        position: "relative",
                        zIndex: 2,
                        color: "#ffffff",
                        maxWidth: 380,
                      }}
                    >
                      <h2
                        style={{
                          fontFamily: "var(--font-display), Georgia, serif",
                          fontSize: 32,
                          lineHeight: 1.08,
                          margin: "0 0 10px",
                          fontWeight: 600,
                        }}
                      >
                        {bannerTitle1 || "Everyday"}
                        <br />
                        {bannerTitle2 || "Elegance"}
                      </h2>
                      <p
                        style={{
                          fontSize: 13,
                          lineHeight: 1.5,
                          color: "rgba(255,255,255,0.88)",
                          margin: "0 0 16px",
                        }}
                      >
                        {bannerSubtitle || "Premium hijabs crafted for comfort and confidence"}
                      </p>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "9px 16px",
                          borderRadius: 999,
                          background: "#ffffff",
                          color: "#1c1917",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {bannerCtaLabel || "Explore Collection"} →
                      </span>
                    </div>

                    {/* Interactive Preview Dots */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 14,
                        right: 18,
                        zIndex: 3,
                        display: "flex",
                        gap: 6,
                      }}
                    >
                      {([0, 1, 2] as const).map((idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveBannerSlideIdx(idx)}
                          title={`Preview Slide ${idx + 1}`}
                          style={{
                            width: activeBannerSlideIdx === idx ? 26 : 10,
                            height: 10,
                            borderRadius: 999,
                            border: "none",
                            background:
                              activeBannerSlideIdx === idx
                                ? "#d4a373"
                                : "rgba(255,255,255,0.45)",
                            cursor: "pointer",
                            transition: "width 0.25s ease",
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <div className="adm-mini-stat-list">
                      <div className="adm-mini-stat-row">
                        <span>Editing Slide</span>
                        <strong>
                          Slide {activeBannerSlideIdx + 1} of 3 ({bannerTitle1} {bannerTitle2})
                        </strong>
                      </div>
                      <div className="adm-mini-stat-row">
                        <span>Target Destination</span>
                        <code>{bannerCtaHref || "#new-items"}</code>
                      </div>
                      <div className="adm-mini-stat-row">
                        <span>Image Crop Focus</span>
                        <code>{bannerImagePosition || "74% 18%"}</code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Homepage Stories Manager (Below Hero Section) */}
              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>Homepage Video Stories Manager ({storeStories.length} Active)</h3>
                    <p className="adm-panel-sub">
                      Manage the interactive Video Stories carousel below the Hero Banner — upload
                      story videos (MP4/WebM/MOV), reorder cards, or customize cover &amp; avatar
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      className="adm-btn adm-btn-sm adm-btn-secondary"
                      disabled={savingStories}
                      onClick={() => void handleResetDefaultStories()}
                    >
                      <RefreshCw size={13} /> Reset Defaults
                    </button>
                    <Link
                      href="/#home"
                      target="_blank"
                      className="adm-btn adm-btn-sm adm-btn-secondary"
                    >
                      <ExternalLink size={13} /> View on Homepage
                    </Link>
                  </div>
                </div>

                {/* Live Visual Strip of Active Stories */}
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    overflowX: "auto",
                    paddingBottom: 10,
                    marginBottom: 20,
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  {storeStories.map((st, idx) => {
                    const isEditingThis = editingStoryId === st.id;
                    const hasVideo = Boolean(st.videoSrc?.trim());
                    return (
                      <div
                        key={st.id}
                        style={{
                          width: 148,
                          flexShrink: 0,
                          borderRadius: 14,
                          border: isEditingThis
                            ? "2px solid var(--accent-strong)"
                            : "1px solid var(--line)",
                          background: "var(--surface-soft)",
                          overflow: "hidden",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        <div
                          style={{
                            position: "relative",
                            height: 215,
                            backgroundImage: `url("${st.photo.src}")`,
                            backgroundSize: "cover",
                            backgroundPosition: st.photo.position || "center",
                            backgroundColor: "#14110f",
                          }}
                        >
                          {hasVideo && (
                            <video
                              src={st.videoSrc}
                              muted
                              loop
                              autoPlay
                              playsInline
                              style={{
                                position: "absolute",
                                inset: 0,
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          )}
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              background:
                                "linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.05) 45%, rgba(0,0,0,0.76) 100%)",
                            }}
                          />
                          {/* Top order badge & Video/Link indicator */}
                          <div
                            style={{
                              position: "absolute",
                              top: 8,
                              left: 8,
                              right: 8,
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: 999,
                                background: "rgba(0,0,0,0.6)",
                                color: "#fff",
                              }}
                            >
                              #{idx + 1}
                            </span>
                            <div style={{ display: "flex", gap: 4 }}>
                              {hasVideo && (
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    padding: "2px 6px",
                                    borderRadius: 999,
                                    background: "#dc2626",
                                    color: "#ffffff",
                                    fontWeight: 700,
                                  }}
                                >
                                  ▶ VIDEO
                                </span>
                              )}
                              {st.href && (
                                <span
                                  title={`CTA Links to ${st.href}`}
                                  style={{
                                    fontSize: 9.5,
                                    padding: "2px 6px",
                                    borderRadius: 999,
                                    background: "rgba(255,255,255,0.88)",
                                    color: "#1c1917",
                                    fontWeight: 600,
                                  }}
                                >
                                  CTA
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Bottom Avatar & Label (matches storefront) */}
                          <div
                            style={{
                              position: "absolute",
                              left: 10,
                              right: 10,
                              bottom: 10,
                              display: "flex",
                              alignItems: "center",
                              gap: 7,
                              color: "#ffffff",
                            }}
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                border: "2px solid #ffffff",
                                backgroundImage: `url("${st.avatar.src}")`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                flexShrink: 0,
                              }}
                            />
                            <strong
                              style={{
                                fontSize: 12,
                                lineHeight: 1.2,
                                textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {st.label}
                            </strong>
                          </div>
                        </div>

                        {/* Story Card Controls: Move Left, Edit, Delete, Move Right */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "6px 8px",
                            gap: 4,
                            background: "var(--surface)",
                          }}
                        >
                          <button
                            type="button"
                            className="adm-icon-btn"
                            disabled={idx === 0 || savingStories}
                            onClick={() => void handleMoveStory(idx, -1)}
                            title="Move left"
                            aria-label={`Move ${st.label} left`}
                            style={{ width: 26, height: 26 }}
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <button
                            type="button"
                            className="adm-btn adm-btn-sm adm-btn-secondary"
                            onClick={() => handleEditStory(st)}
                            style={{ padding: "3px 8px", fontSize: 11 }}
                          >
                            <Edit3 size={11} /> Edit
                          </button>
                          <button
                            type="button"
                            className="adm-icon-btn"
                            disabled={storeStories.length <= 1 || savingStories}
                            onClick={() => void handleDeleteStory(st.id)}
                            title="Delete story"
                            aria-label={`Delete ${st.label}`}
                            style={{ width: 26, height: 26, color: "#dc2626" }}
                          >
                            <Trash2 size={13} />
                          </button>
                          <button
                            type="button"
                            className="adm-icon-btn"
                            disabled={idx === storeStories.length - 1 || savingStories}
                            onClick={() => void handleMoveStory(idx, 1)}
                            title="Move right"
                            aria-label={`Move ${st.label} right`}
                            style={{ width: 26, height: 26 }}
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add / Edit Video Story Form */}
                <form onSubmit={handleSaveStory} className="adm-form-stack">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <h4 style={{ margin: 0, fontSize: 14 }}>
                      {editingStoryId
                        ? `Editing Video Story: "${storyLabel || editingStoryId}"`
                        : "Add New Homepage Video Story"}
                    </h4>
                    {editingStoryId && (
                      <button
                        type="button"
                        className="adm-btn adm-btn-sm adm-btn-secondary"
                        onClick={resetStoryForm}
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  {/* Primary Field: Story Video Upload (MP4 / WebM / MOV) */}
                  <div
                    className="adm-field"
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      border: "1px solid var(--accent-strong)",
                      background: "var(--surface-soft)",
                    }}
                  >
                    <label htmlFor="story-video-input" style={{ fontWeight: 700 }}>
                      1. Story Video Upload (Primary — Plays in Full-Height Modal on Click)
                    </label>
                    <div
                      style={{
                        display: "flex",
                        gap: 14,
                        alignItems: "center",
                        flexWrap: "wrap",
                        marginTop: 6,
                      }}
                    >
                      {/* Live Vertical Video / Poster Preview */}
                      <div
                        style={{
                          position: "relative",
                          width: 78,
                          height: 134,
                          borderRadius: 10,
                          overflow: "hidden",
                          border: "1px solid var(--line)",
                          background: "#14110f",
                          flexShrink: 0,
                        }}
                      >
                        {storyVideoSrc.trim() ? (
                          <video
                            src={storyVideoSrc.trim()}
                            poster={storyPhotoSrc || photos.rose.src}
                            muted
                            loop
                            autoPlay
                            playsInline
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              backgroundImage: `url("${storyPhotoSrc || photos.rose.src}")`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              display: "grid",
                              placeItems: "center",
                              color: "#fff",
                              fontSize: 10,
                              fontWeight: 700,
                              textShadow: "0 1px 3px #000",
                            }}
                          >
                            No Video Yet
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 240, display: "grid", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <label
                            className="adm-btn adm-btn-primary"
                            style={{ cursor: "pointer", flexShrink: 0 }}
                          >
                            <CloudUpload size={15} />{" "}
                            {uploadingTaxonomyKey === "story-video"
                              ? "Uploading Video…"
                              : "Upload Story Video (MP4 / WebM / MOV)"}
                            <input
                              type="file"
                              accept="video/mp4,video/webm,video/quicktime,video/*"
                              disabled={uploadingTaxonomyKey === "story-video"}
                              onChange={(e) => void handleStoryFileUpload(e, "video")}
                              style={{ display: "none" }}
                            />
                          </label>
                          {storyVideoSrc && (
                            <button
                              type="button"
                              className="adm-btn adm-btn-sm adm-btn-secondary"
                              onClick={() => setStoryVideoSrc("")}
                            >
                              Clear Video
                            </button>
                          )}
                        </div>

                        <input
                          id="story-video-input"
                          type="text"
                          className="adm-input"
                          placeholder="Or paste direct video URL (.mp4 / .webm / Cloudinary video link)…"
                          value={storyVideoSrc}
                          onChange={(e) => setStoryVideoSrc(e.target.value)}
                        />
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>
                          Supports vertical 9:16 reel videos up to 60 MB. Clicking the story card on
                          the homepage opens this video inside the Story Modal Player with a close (×)
                          button.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="adm-form-row-3">
                    <div className="adm-field">
                      <label htmlFor="story-label-input">2. Story Title / Label</label>
                      <input
                        id="story-label-input"
                        type="text"
                        className="adm-input"
                        placeholder="e.g. New In, Eid Collection, Styling…"
                        value={storyLabel}
                        onChange={(e) => setStoryLabel(e.target.value)}
                        required
                      />
                    </div>

                    <div className="adm-field">
                      <label htmlFor="story-href-input">
                        Modal &quot;Explore Collection&quot; Link (Optional)
                      </label>
                      <input
                        id="story-href-input"
                        type="text"
                        className="adm-input"
                        placeholder="e.g. /shop?fabric=modal or /#new-items"
                        value={storyHref}
                        onChange={(e) => setStoryHref(e.target.value)}
                      />
                    </div>

                    <div className="adm-field">
                      <label htmlFor="story-href-preset">Quick Link Preset</label>
                      <select
                        id="story-href-preset"
                        className="adm-select"
                        value={storyHref}
                        onChange={(e) => setStoryHref(e.target.value)}
                      >
                        <option value="">Default (/shop)</option>
                        <option value="/#new-items">New Arrivals (#new-items)</option>
                        <option value="/#flash-sale">Flash Sale (#flash-sale)</option>
                        <option value="/shop">All Products (/shop)</option>
                        <option value="/shop?fabric=modal">Modal Hijabs (/shop?fabric=modal)</option>
                        <option value="/shop?fabric=chiffon">Chiffon Hijabs (/shop?fabric=chiffon)</option>
                        <option value="/shop?fabric=jersey">Jersey Hijabs (/shop?fabric=jersey)</option>
                        <option value="/shop?fabric=silk">Silk Hijabs (/shop?fabric=silk)</option>
                        <option value="/shop?category=accessories">Accessories (/shop?category=accessories)</option>
                      </select>
                    </div>
                  </div>

                  <div className="adm-grid-2">
                    {/* Optional Cover / Poster Photo Upload & URL */}
                    <div className="adm-field">
                      <label>
                        Optional Thumbnail / Poster Image (Fallback before video plays)
                      </label>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span
                          aria-hidden="true"
                          style={{
                            width: 44,
                            height: 56,
                            borderRadius: 8,
                            border: "1px solid var(--line)",
                            backgroundImage: `url("${storyPhotoSrc || photos.rose.src}")`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, display: "grid", gap: 6 }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <input
                              type="text"
                              className="adm-input-sm"
                              style={{ flex: 1 }}
                              placeholder="Poster image URL (optional)…"
                              value={storyPhotoSrc}
                              onChange={(e) => setStoryPhotoSrc(e.target.value)}
                            />
                            <label
                              className="adm-btn adm-btn-sm adm-btn-secondary"
                              style={{ cursor: "pointer", flexShrink: 0 }}
                            >
                              <ImagePlus size={13} />{" "}
                              {uploadingTaxonomyKey === "story-cover" ? "Uploading…" : "Poster"}
                              <input
                                type="file"
                                accept="image/*"
                                disabled={uploadingTaxonomyKey === "story-cover"}
                                onChange={(e) => void handleStoryFileUpload(e, "cover")}
                                style={{ display: "none" }}
                              />
                            </label>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {[
                              { label: "Burgundy", src: photos.burgundy.src },
                              { label: "Folded", src: photos.folded.src },
                              { label: "Sand", src: photos.sand.src },
                              { label: "Black", src: photos.black.src },
                              { label: "Rose", src: photos.rose.src },
                              { label: "Olive", src: photos.olive.src },
                              { label: "Mauve", src: photos.mauve.src },
                            ].map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                className="adm-chip"
                                style={{ padding: "2px 8px", fontSize: 10 }}
                                onClick={() => setStoryPhotoSrc(preset.src)}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Circular Avatar Photo Upload & URL */}
                    <div className="adm-field">
                      <label>
                        Optional Circular Avatar Photo (Bottom-left badge on Story card)
                      </label>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span
                          aria-hidden="true"
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            border: "2px solid var(--line)",
                            backgroundImage: `url("${
                              storyAvatarSrc.trim() || storyPhotoSrc || photos.rose.src
                            }")`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, display: "grid", gap: 6 }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <input
                              type="text"
                              className="adm-input-sm"
                              style={{ flex: 1 }}
                              placeholder="Leave blank to use Poster, or upload avatar…"
                              value={storyAvatarSrc}
                              onChange={(e) => setStoryAvatarSrc(e.target.value)}
                            />
                            <label
                              className="adm-btn adm-btn-sm adm-btn-secondary"
                              style={{ cursor: "pointer", flexShrink: 0 }}
                            >
                              <ImagePlus size={13} />{" "}
                              {uploadingTaxonomyKey === "story-avatar" ? "Uploading…" : "Avatar"}
                              <input
                                type="file"
                                accept="image/*"
                                disabled={uploadingTaxonomyKey === "story-avatar"}
                                onChange={(e) => void handleStoryFileUpload(e, "avatar")}
                                style={{ display: "none" }}
                              />
                            </label>
                          </div>
                          {storyAvatarSrc && (
                            <div>
                              <button
                                type="button"
                                className="adm-chip"
                                style={{ padding: "2px 8px", fontSize: 10 }}
                                onClick={() => setStoryAvatarSrc("")}
                              >
                                Reset Avatar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      className="adm-btn adm-btn-primary"
                      disabled={savingStories || !storyLabel.trim()}
                    >
                      <Plus size={14} />{" "}
                      {savingStories
                        ? "Saving…"
                        : editingStoryId
                          ? "Update Video Story"
                          : "Add Video Story to Homepage"}
                    </button>
                  </div>
                </form>
              </div>

              {/* ================= FLASH SALE TIMER & EXPIRY CONTROL ================= */}
              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>Flash Sale Timer &amp; Standard Expiry Control</h3>
                    <p className="adm-panel-sub">
                      Schedule the live Homepage Flash Sale countdown and control what happens
                      automatically when the timer reaches 00:00:00
                    </p>
                  </div>
                  <span
                    className={`adm-status-pill ${
                      !flashSaleEnabled
                        ? "is-danger"
                        : flashSaleEndsAtInput &&
                            !Number.isNaN(Date.parse(flashSaleEndsAtInput)) &&
                            new Date(flashSaleEndsAtInput).toISOString() <= analytics.meta.generatedAt
                          ? "is-warning"
                          : "is-success"
                    }`}
                  >
                    {!flashSaleEnabled
                      ? "Disabled"
                      : flashSaleEndsAtInput
                        ? `Scheduled (${formatOrderDate(new Date(flashSaleEndsAtInput).toISOString(), true)})`
                        : "Active (Continuous Countdown)"}
                  </span>
                </div>

                <form className="adm-form-stack" onSubmit={handleSaveFlashSale}>
                  <div className="adm-grid-2">
                    <div className="adm-field">
                      <label htmlFor="fs-status">Flash Sale Section Status</label>
                      <select
                        id="fs-status"
                        className="adm-select"
                        value={flashSaleEnabled ? "enabled" : "disabled"}
                        onChange={(e) => setFlashSaleEnabled(e.target.value === "enabled")}
                      >
                        <option value="enabled">
                          Enabled — Show Flash Sale on Homepage
                        </option>
                        <option value="disabled">
                          Disabled — Hide Section &amp; Revert Products to Regular Price
                        </option>
                      </select>
                    </div>

                    <div className="adm-field">
                      <label htmlFor="fs-expired-behavior">
                        When Timer Ends (00:00:00) — Standard E-Commerce Action
                      </label>
                      <select
                        id="fs-expired-behavior"
                        className="adm-select"
                        value={flashSaleExpiredBehavior}
                        onChange={(e) =>
                          setFlashSaleExpiredBehavior(
                            e.target.value as "revert-prices" | "hide-section",
                          )
                        }
                      >
                        <option value="revert-prices">
                          Standard: Revert Products to Regular Price &amp; Show &quot;Sale Ended&quot;
                        </option>
                        <option value="hide-section">
                          Hide Flash Sale Section from Homepage &amp; Revert Prices
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="adm-field">
                    <label htmlFor="fs-ends-at">
                      Flash Sale End Date &amp; Time (Leave empty for continuous 2h 36m countdown)
                    </label>
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <input
                        id="fs-ends-at"
                        type="datetime-local"
                        className="adm-input"
                        style={{ maxWidth: 260 }}
                        value={flashSaleEndsAtInput}
                        onChange={(e) => setFlashSaleEndsAtInput(e.target.value)}
                      />
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {[
                          { label: "+2 Hours", hours: 2 },
                          { label: "+6 Hours", hours: 6 },
                          { label: "+12 Hours", hours: 12 },
                          { label: "+24 Hours", hours: 24 },
                          { label: "+3 Days", hours: 72 },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            className="adm-btn adm-btn-sm adm-btn-secondary"
                            onClick={() => applyFlashSalePresetHours(preset.hours)}
                          >
                            {preset.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="adm-btn adm-btn-sm adm-btn-secondary"
                          onClick={() => applyFlashSalePresetHours(-0.02)}
                          title="Set end time in the past to immediately end the Flash Sale"
                        >
                          End Sale Now
                        </button>
                        {flashSaleEndsAtInput && (
                          <button
                            type="button"
                            className="adm-btn adm-btn-sm adm-btn-secondary"
                            onClick={() => applyFlashSalePresetHours(null)}
                          >
                            Clear End Time
                          </button>
                        )}
                      </div>
                    </div>
                    <small className="adm-hint">
                      When the countdown reaches 00:00:00, every product assigned to{" "}
                      <code>flash-sale</code> automatically reverts from its discount{" "}
                      <strong>Sale Price</strong> back to its regular{" "}
                      <strong>Original Price</strong> across the Homepage, Shop, Product Details,
                      Cart, and Checkout.
                    </small>
                  </div>

                  <div className="adm-form-row-3">
                    <div className="adm-field">
                      <label htmlFor="fs-title">Section Title</label>
                      <input
                        id="fs-title"
                        type="text"
                        className="adm-input"
                        value={flashSaleTitle}
                        onChange={(e) => setFlashSaleTitle(e.target.value)}
                        placeholder="Flash Sale"
                      />
                    </div>
                    <div className="adm-field">
                      <label htmlFor="fs-badge">Section Badge</label>
                      <input
                        id="fs-badge"
                        type="text"
                        className="adm-input"
                        value={flashSaleBadge}
                        onChange={(e) => setFlashSaleBadge(e.target.value)}
                        placeholder="Limited Time Offer"
                      />
                    </div>
                    <div className="adm-field">
                      <label htmlFor="fs-subtitle">Section Subtitle</label>
                      <input
                        id="fs-subtitle"
                        type="text"
                        className="adm-input"
                        value={flashSaleSubtitle}
                        onChange={(e) => setFlashSaleSubtitle(e.target.value)}
                        placeholder="Exclusive markdowns on signature drapes..."
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid var(--line)",
                      background: "var(--surface-soft)",
                    }}
                  >
                    <strong style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
                      Products Assigned to Flash Sale (
                      {products.filter((p) => p.sections.includes("flash-sale")).length})
                    </strong>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {products
                        .filter((p) => p.sections.includes("flash-sale"))
                        .map((item) => (
                          <span
                            key={item.id}
                            className="adm-chip"
                            style={{ fontSize: 11, padding: "4px 10px" }}
                          >
                            {item.name}: <strong>{formatPrice(item.price)}</strong> during sale →{" "}
                            <span>
                              {formatPrice(item.originalPrice ?? item.price)} after sale
                            </span>
                          </span>
                        ))}
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      className="adm-btn adm-btn-primary"
                      disabled={savingFlashSale}
                    >
                      {savingFlashSale ? "Saving…" : "Save Flash Sale Timer & Rules"}
                    </button>
                  </div>
                </form>
              </div>

              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>Homepage Curation &amp; Sections</h3>
                    <p className="adm-panel-sub">
                      Products assigned to each storefront showcase section
                    </p>
                  </div>
                </div>
                <div className="adm-mini-stat-list">
                  {SECTION_OPTIONS.map((sec) => {
                    const count = products.filter((p) => p.sections.includes(sec.key)).length;
                    return (
                      <div key={sec.key} className="adm-mini-stat-row">
                        <div>
                          <strong>{sec.label}</strong>
                          <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
                            Section key: <code>{sec.key}</code>
                          </span>
                        </div>
                        <span>
                          <strong>{count}</strong> products assigned
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ================= 11. SHIPPING SECTION ================= */}
          {activeSection === "shipping" && (
            <div className="adm-grid-2">
              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>Delivery Zones &amp; Charges</h3>
                    <p className="adm-panel-sub">
                      Configured shipping fees for Inside Dhaka and Outside Dhaka
                    </p>
                  </div>
                </div>
                <div className="adm-mini-stat-list">
                  <div className="adm-mini-stat-row">
                    <div>
                      <strong>Inside Dhaka Delivery</strong>
                      <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
                        1–2 business days
                      </span>
                    </div>
                    <strong>{formatPrice(analytics.settings.insideDhakaShippingFee)}</strong>
                  </div>
                  <div className="adm-mini-stat-row">
                    <div>
                      <strong>Outside Dhaka (Nationwide)</strong>
                      <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
                        3–5 business days
                      </span>
                    </div>
                    <strong>{formatPrice(analytics.settings.outsideDhakaShippingFee)}</strong>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className="adm-btn adm-btn-sm adm-btn-secondary"
                    onClick={() => setActiveSection("settings")}
                  >
                    Edit Shipping Fees in Settings →
                  </button>
                </div>
              </div>

              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>Fulfillment Pipeline</h3>
                    <p className="adm-panel-sub">Active orders by delivery state</p>
                  </div>
                </div>
                <div className="adm-mini-stat-list">
                  {DELIVERY_STATUSES.map((ds) => {
                    const count = orders.filter((o) => o.deliveryStatus === ds).length;
                    return (
                      <div key={ds} className="adm-mini-stat-row">
                        <span>{formatAdminDeliveryOption(ds)}</span>
                        <strong>{count} orders</strong>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="adm-panel" style={{ gridColumn: "1 / -1" }}>
                <div className="adm-panel-head">
                  <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Truck size={18} /> Dual-Courier Automation, Method A Hubs &amp; Webhooks
                    </h3>
                    <p className="adm-panel-sub">
                      Connect both Steadfast &amp; Pathao Merchant APIs, manage Own Stock vs Supplier Dropship pickup hubs (Method A), and activate real-time tracking webhooks.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span
                      className={`adm-status-pill ${
                        steadfastEnabled && steadfastApiKey.trim() && steadfastSecretKey.trim()
                          ? "is-success"
                          : "is-warning"
                      }`}
                    >
                      {steadfastEnabled && steadfastApiKey.trim() && steadfastSecretKey.trim()
                        ? "🟢 Steadfast Active"
                        : "🟡 Steadfast Pending Keys"}
                    </span>
                    <span
                      className={`adm-status-pill ${
                        pathaoEnabled &&
                        pathaoClientId.trim() &&
                        pathaoClientSecret.trim() &&
                        pathaoUsername.trim() &&
                        pathaoPassword.trim()
                          ? "is-success"
                          : "is-warning"
                      }`}
                    >
                      {pathaoEnabled &&
                      pathaoClientId.trim() &&
                      pathaoClientSecret.trim() &&
                      pathaoUsername.trim() &&
                      pathaoPassword.trim()
                        ? "🟢 Pathao Active"
                        : pathaoClientId.trim() && pathaoClientSecret.trim()
                          ? "🟡 Pathao Pending Login/Store"
                          : "🟡 Pathao Pending Keys"}
                    </span>
                  </div>
                </div>

                <div className="adm-form-stack" style={{ marginTop: 14 }}>
                  {/* Routing Defaults & Global Toggles */}
                  <div className="adm-form-row-3">
                    <div className="adm-field">
                      <label htmlFor="courier-prov">Fallback Default Courier</label>
                      <select
                        id="courier-prov"
                        className="adm-select"
                        value={courierProvider}
                        onChange={(e) => setCourierProvider(e.target.value as CourierProvider)}
                      >
                        <option value="steadfast">Steadfast Courier</option>
                        <option value="pathao">Pathao Courier</option>
                      </select>
                    </div>
                    <div className="adm-field">
                      <label htmlFor="courier-inhouse-def">Own Stock Default Courier</label>
                      <select
                        id="courier-inhouse-def"
                        className="adm-select"
                        value={defaultInHouseCourier}
                        onChange={(e) =>
                          setDefaultInHouseCourier(e.target.value as CourierProvider)
                        }
                      >
                        <option value="steadfast">Steadfast Courier (Direct Parcel)</option>
                        <option value="pathao">Pathao Courier (Direct Parcel)</option>
                      </select>
                    </div>
                    <div className="adm-field">
                      <label htmlFor="courier-supplier-def">Supplier Dropship Default (Method A)</label>
                      <select
                        id="courier-supplier-def"
                        className="adm-select"
                        value={defaultSupplierCourier}
                        onChange={(e) =>
                          setDefaultSupplierCourier(e.target.value as CourierProvider)
                        }
                      >
                        <option value="pathao">Pathao Courier (Multi-Store Pickup)</option>
                        <option value="steadfast">Steadfast Courier (Supplier Hub Note)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={courierTestMode}
                        onChange={(e) => setCourierTestMode(e.target.checked)}
                      />
                      Pathao Sandbox / Test Environment (courier-api-sandbox.pathao.com)
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={autoFraudCheck}
                        onChange={(e) => setAutoFraudCheck(e.target.checked)}
                      />
                      Auto Customer Phone Fraud Check
                    </label>
                  </div>

                  {/* Side-by-Side Steadfast & Pathao API Configuration */}
                  <div className="adm-grid-2" style={{ gap: 16, alignItems: "stretch" }}>
                    {/* Steadfast Card */}
                    <div className="adm-courier-config-card">
                      <div className="adm-courier-card-head">
                        <div>
                          <h4>Steadfast Courier API</h4>
                          <span>1-Click Parcel Booking · Phone Fraud History · Webhook Sync</span>
                        </div>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={steadfastEnabled}
                            onChange={(e) => setSteadfastEnabled(e.target.checked)}
                          />
                          Enabled
                        </label>
                      </div>

                      <div className="adm-form-row-2">
                        <div className="adm-field">
                          <label htmlFor="set-sf-key">Steadfast API Key</label>
                          <input
                            id="set-sf-key"
                            type="text"
                            className="adm-input"
                            placeholder="stf_live_..."
                            value={steadfastApiKey}
                            onChange={(e) => {
                              setSteadfastApiKey(e.target.value);
                              if (e.target.value.trim()) {
                                setSteadfastEnabled(true);
                              }
                            }}
                          />
                        </div>
                        <div className="adm-field">
                          <label htmlFor="set-sf-sec">Steadfast Secret Key</label>
                          <input
                            id="set-sf-sec"
                            type="password"
                            className="adm-input"
                            placeholder="Steadfast Secret Key"
                            value={steadfastSecretKey}
                            onChange={(e) => setSteadfastSecretKey(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="adm-field">
                        <label htmlFor="set-sf-webhook">Webhook Bearer Token (Optional Security)</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            id="set-sf-webhook"
                            type="text"
                            className="adm-input"
                            placeholder="Paste in Steadfast Portal -> Webhook Auth Token"
                            value={steadfastWebhookToken}
                            onChange={(e) => setSteadfastWebhookToken(e.target.value)}
                          />
                          <button
                            type="button"
                            className="adm-btn adm-btn-sm adm-btn-secondary"
                            onClick={() => setSteadfastWebhookToken(createRandomSecret("hn_sf"))}
                          >
                            Generate
                          </button>
                        </div>
                      </div>

                      <div className="adm-webhook-url-box">
                        <span>Steadfast Callback URL:</span>
                        <code>{`${siteOrigin}/api/webhooks/steadfast`}</code>
                        <button
                          type="button"
                          className="adm-btn adm-btn-xs adm-btn-secondary"
                          onClick={() =>
                            void copyTextValue(
                              "sf-webhook-url",
                              `${siteOrigin || "https://your-domain.com"}/api/webhooks/steadfast`,
                              "Steadfast Webhook URL",
                            )
                          }
                        >
                          {copiedKeyId === "sf-webhook-url" ? <Check size={12} /> : <Copy size={12} />}
                          {copiedKeyId === "sf-webhook-url" ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>

                    {/* Pathao Card */}
                    <div className="adm-courier-config-card">
                      <div className="adm-courier-card-head">
                        <div>
                          <h4>Pathao Courier API (Aladdin v1)</h4>
                          <span>Multi-Store Pickup Hubs · Ideal for Method A Supplier Dispatch</span>
                        </div>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={pathaoEnabled}
                            onChange={(e) => setPathaoEnabled(e.target.checked)}
                          />
                          Enabled
                        </label>
                      </div>

                      <div className="adm-form-row-2">
                        <div className="adm-field">
                          <label htmlFor="set-pt-cid">Pathao Client ID</label>
                          <input
                            id="set-pt-cid"
                            type="text"
                            className="adm-input"
                            placeholder="Client ID from Pathao Merchant"
                            value={pathaoClientId}
                            onChange={(e) => {
                              setPathaoClientId(e.target.value);
                              if (e.target.value.trim()) {
                                setPathaoEnabled(true);
                              }
                            }}
                          />
                        </div>
                        <div className="adm-field">
                          <label htmlFor="set-pt-csec">Pathao Client Secret</label>
                          <input
                            id="set-pt-csec"
                            type="password"
                            className="adm-input"
                            placeholder="Client Secret"
                            value={pathaoClientSecret}
                            onChange={(e) => setPathaoClientSecret(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="adm-form-row-2">
                        <div className="adm-field">
                          <label htmlFor="set-pt-user">Merchant Email (Username)</label>
                          <input
                            id="set-pt-user"
                            type="text"
                            className="adm-input"
                            placeholder="merchant@domain.com"
                            value={pathaoUsername}
                            onChange={(e) => setPathaoUsername(e.target.value)}
                          />
                        </div>
                        <div className="adm-field">
                          <label htmlFor="set-pt-pass">Merchant Password</label>
                          <input
                            id="set-pt-pass"
                            type="password"
                            className="adm-input"
                            placeholder="Pathao Merchant Password"
                            value={pathaoPassword}
                            onChange={(e) => setPathaoPassword(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="adm-form-row-2">
                        <div className="adm-field">
                          <label htmlFor="set-pt-store">Default Pathao Store ID</label>
                          <div style={{ display: "flex", gap: 6 }}>
                            <input
                              id="set-pt-store"
                              type="text"
                              className="adm-input"
                              placeholder="e.g. 142560"
                              value={pathaoStoreId}
                              onChange={(e) => setPathaoStoreId(e.target.value)}
                            />
                            <button
                              type="button"
                              className="adm-btn adm-btn-sm adm-btn-secondary"
                              onClick={() => void handleFetchPathaoStores()}
                              disabled={loadingPathaoStores}
                              style={{ whiteSpace: "nowrap" }}
                            >
                              <RefreshCw size={13} className={loadingPathaoStores ? "adm-spin" : ""} />
                              {loadingPathaoStores ? "Testing…" : "Fetch Stores"}
                            </button>
                          </div>
                        </div>
                        <div className="adm-field">
                          <label htmlFor="set-pt-webhook">Webhook Signature Secret</label>
                          <div style={{ display: "flex", gap: 6 }}>
                            <input
                              id="set-pt-webhook"
                              type="text"
                              className="adm-input"
                              placeholder="Optional X-Pathao-Signature"
                              value={pathaoWebhookSecret}
                              onChange={(e) => setPathaoWebhookSecret(e.target.value)}
                            />
                            <button
                              type="button"
                              className="adm-btn adm-btn-sm adm-btn-secondary"
                              onClick={() => setPathaoWebhookSecret(createRandomSecret("hn_pt"))}
                            >
                              Generate
                            </button>
                          </div>
                        </div>
                      </div>

                      {pathaoStoreMessage && (
                        <div
                          className={`adm-alert ${pathaoStoreMessage.ok ? "is-success" : "is-error"}`}
                          style={{ marginBottom: 4, padding: "8px 12px", fontSize: 12 }}
                        >
                          {pathaoStoreMessage.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                          <span>{pathaoStoreMessage.text}</span>
                        </div>
                      )}

                      {pathaoStores.length > 0 && (
                        <div className="adm-pathao-stores-list">
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
                            Approved Pathao Stores (Click to set as Default Store ID):
                          </span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                            {pathaoStores.map((st) => (
                              <button
                                key={st.storeId}
                                type="button"
                                className={`adm-btn adm-btn-xs ${
                                  pathaoStoreId.trim() === String(st.storeId)
                                    ? "adm-btn-primary"
                                    : "adm-btn-secondary"
                                }`}
                                onClick={() => setPathaoStoreId(String(st.storeId))}
                                title={st.storeAddress}
                              >
                                #{st.storeId} · {st.storeName}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="adm-webhook-url-box">
                        <span>Pathao Webhook URL:</span>
                        <code>{`${siteOrigin}/api/webhooks/pathao`}</code>
                        <button
                          type="button"
                          className="adm-btn adm-btn-xs adm-btn-secondary"
                          onClick={() =>
                            void copyTextValue(
                              "pt-webhook-url",
                              `${siteOrigin || "https://your-domain.com"}/api/webhooks/pathao`,
                              "Pathao Webhook URL",
                            )
                          }
                        >
                          {copiedKeyId === "pt-webhook-url" ? <Check size={12} /> : <Copy size={12} />}
                          {copiedKeyId === "pt-webhook-url" ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Method A Pickup Hubs Manager */}
                  <div className="adm-hubs-panel">
                    <div className="adm-panel-head" style={{ marginBottom: 12 }}>
                      <div>
                        <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: 7, fontSize: 14.5 }}>
                          <MapPin size={16} /> Pickup Hubs &amp; Supplier Locations (Method A · Own Merchant Fulfillment)
                        </h4>
                        <p className="adm-panel-sub" style={{ marginTop: 3 }}>
                          Define your own studio dispatch address plus partner supplier pickup locations. When customers buy a mixed cart, parcels auto-split by hub so Steadfast or Pathao picks up directly from each location using your merchant account.
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="adm-btn adm-btn-sm adm-btn-secondary"
                          onClick={() => handleAddPickupHub("in-house")}
                        >
                          <Plus size={13} /> Own Stock Hub
                        </button>
                        <button
                          type="button"
                          className="adm-btn adm-btn-sm adm-btn-primary"
                          onClick={() => handleAddPickupHub("supplier")}
                        >
                          <Plus size={13} /> Supplier Pickup Hub
                        </button>
                      </div>
                    </div>

                    <div className="adm-hubs-grid">
                      {pickupHubs.map((hub) => (
                        <div
                          key={hub.id}
                          className={`adm-hub-card ${hub.source === "supplier" ? "is-supplier" : ""}`}
                        >
                          <div className="adm-hub-card-head">
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span
                                className={`adm-status-pill ${
                                  hub.source === "supplier" ? "is-warning" : "is-ready"
                                }`}
                              >
                                {hub.source === "supplier" ? "🤝 Supplier Dropship" : "📦 Own Stock"}
                              </span>
                              <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, cursor: "pointer" }}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(hub.isDefault)}
                                  onChange={(e) =>
                                    handleUpdatePickupHub(hub.id, { isDefault: e.target.checked })
                                  }
                                />
                                Default for {hub.source === "supplier" ? "Supplier" : "Own Stock"}
                              </label>
                            </div>
                            {pickupHubs.length > 1 && (
                              <button
                                type="button"
                                className="adm-btn adm-btn-xs adm-btn-danger"
                                onClick={() => handleRemovePickupHub(hub.id)}
                                title="Remove pickup hub"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>

                          <div className="adm-form-row-2">
                            <div className="adm-field">
                              <label>Hub Name</label>
                              <input
                                type="text"
                                className="adm-input"
                                value={hub.name}
                                onChange={(e) =>
                                  handleUpdatePickupHub(hub.id, { name: e.target.value })
                                }
                              />
                            </div>
                            <div className="adm-field">
                              <label>Fulfillment Type</label>
                              <select
                                className="adm-select"
                                value={hub.source}
                                onChange={(e) =>
                                  handleUpdatePickupHub(hub.id, {
                                    source: e.target.value as FulfillmentSource,
                                  })
                                }
                              >
                                <option value="in-house">Own Stock (Direct Parcel)</option>
                                <option value="supplier">Supplier Hub (Dropship)</option>
                              </select>
                            </div>
                          </div>

                          <div className="adm-form-row-3">
                            <div className="adm-field">
                              <label>Preferred Courier</label>
                              <select
                                className="adm-select"
                                value={hub.preferredCourier ?? "steadfast"}
                                onChange={(e) =>
                                  handleUpdatePickupHub(hub.id, {
                                    preferredCourier: e.target.value as CourierProvider,
                                  })
                                }
                              >
                                <option value="steadfast">Steadfast</option>
                                <option value="pathao">Pathao</option>
                              </select>
                            </div>
                            <div className="adm-field">
                              <label>Pathao Store ID</label>
                              {pathaoStores.length > 0 ? (
                                <select
                                  className="adm-select"
                                  value={hub.pathaoStoreId || ""}
                                  onChange={(e) =>
                                    handleUpdatePickupHub(hub.id, {
                                      pathaoStoreId: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">Use Default Store ({pathaoStoreId || "None"})</option>
                                  {pathaoStores.map((st) => (
                                    <option key={st.storeId} value={String(st.storeId)}>
                                      #{st.storeId} · {st.storeName}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  className="adm-input"
                                  placeholder="Pathao pickup store_id"
                                  value={hub.pathaoStoreId || ""}
                                  onChange={(e) =>
                                    handleUpdatePickupHub(hub.id, {
                                      pathaoStoreId: e.target.value,
                                    })
                                  }
                                />
                              )}
                            </div>
                            <div className="adm-field">
                              <label>Hub Contact / Phone</label>
                              <input
                                type="text"
                                className="adm-input"
                                placeholder="01XXXXXXXXX"
                                value={hub.phone || ""}
                                onChange={(e) =>
                                  handleUpdatePickupHub(hub.id, { phone: e.target.value })
                                }
                              />
                            </div>
                          </div>

                          <div className="adm-form-row-2">
                            <div className="adm-field">
                              <label>Pickup Address (Shown on Supplier Slip / Steadfast Note)</label>
                              <input
                                type="text"
                                className="adm-input"
                                placeholder="Shop / Building / Area, Dhaka"
                                value={hub.address}
                                onChange={(e) =>
                                  handleUpdatePickupHub(hub.id, { address: e.target.value })
                                }
                              />
                            </div>
                            <div className="adm-field">
                              <label>Steadfast Dispatch Note</label>
                              <input
                                type="text"
                                className="adm-input"
                                placeholder="Optional instruction sent with booking"
                                value={hub.steadfastPickupNote || ""}
                                onChange={(e) =>
                                  handleUpdatePickupHub(hub.id, {
                                    steadfastPickupNote: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "var(--surface)",
                      border: "1px dashed var(--line)",
                      borderRadius: 10,
                      padding: 14,
                      fontSize: 12.5,
                      color: "var(--muted)",
                      lineHeight: 1.6,
                    }}
                  >
                    <strong>💡 How Real-Time Webhooks Work (Steadfast &amp; Pathao):</strong>
                    <div>
                      Paste your <strong>Steadfast Webhook URL</strong> &amp; Token inside Steadfast Merchant Portal → Developer API, and paste your <strong>Pathao Webhook URL</strong> &amp; Secret inside Pathao Merchant Portal → Developer API (our endpoint automatically responds with <code>X-Pathao-Merchant-Webhook-Integration-Secret</code> on handshake). Whenever a parcel is picked up, in transit, delivered, or returned, your order timeline &amp; COD payment status update automatically.
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <button
                      type="button"
                      className="adm-btn adm-btn-primary"
                      onClick={() => void handleSaveCourierSettings()}
                      disabled={savingSettings}
                    >
                      {savingSettings ? "Saving…" : "Save All Courier, Webhook & Hub Settings"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= 12. PAYMENTS SECTION ================= */}
          {activeSection === "payments" && (
            <div className="adm-section-stack">
              {/* Manual bKash & Nagad Send Money Configuration */}
              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Wallet size={18} color="var(--brand)" />
                      Manual bKash &amp; Nagad Send Money Numbers
                    </h3>
                    <p className="adm-panel-sub">
                      Set the personal/merchant mobile numbers displayed on Checkout. Customers send money first, then submit their sender number &amp; TrxID for your verification.
                    </p>
                  </div>
                  {(bkashNumber === "01700-000000" || nagadNumber === "01700-000000") && (
                    <span className="adm-status-pill is-warning">Replace Demo Number 01700-000000</span>
                  )}
                </div>

                <form className="adm-form-stack" onSubmit={handleSaveManualPaymentSettings}>
                  <div className="adm-grid-2">
                    {/* bKash Channel Box */}
                    <div
                      style={{
                        border: "1px solid var(--line)",
                        borderRadius: 12,
                        padding: 16,
                        background: "var(--surface-soft)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ fontSize: 15, color: "#be123c" }}>bKash Manual Payment</strong>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={bkashEnabled}
                            onChange={(e) => setBkashEnabled(e.target.checked)}
                          />
                          <span>{bkashEnabled ? "Enabled on Checkout" : "Hidden"}</span>
                        </label>
                      </div>

                      <div className="adm-form-row-2">
                        <div className="adm-field">
                          <label htmlFor="bkash-number">bKash Number</label>
                          <input
                            id="bkash-number"
                            type="text"
                            className="adm-input"
                            placeholder="e.g. 017XXXXXXXX"
                            value={bkashNumber}
                            onChange={(e) => setBkashNumber(e.target.value)}
                          />
                        </div>
                        <div className="adm-field">
                          <label htmlFor="bkash-type">Account Type</label>
                          <select
                            id="bkash-type"
                            className="adm-select"
                            value={bkashType}
                            onChange={(e) =>
                              setBkashType(e.target.value as "Personal" | "Merchant" | "Agent")
                            }
                          >
                            <option value="Personal">Personal (Send Money)</option>
                            <option value="Merchant">Merchant (Payment)</option>
                            <option value="Agent">Agent (Cash Out)</option>
                          </select>
                        </div>
                      </div>

                      <div className="adm-field">
                        <label htmlFor="bkash-instruction">Checkout Instructions for Customer</label>
                        <textarea
                          id="bkash-instruction"
                          rows={2}
                          className="adm-input"
                          value={bkashInstruction}
                          onChange={(e) => setBkashInstruction(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Nagad Channel Box */}
                    <div
                      style={{
                        border: "1px solid var(--line)",
                        borderRadius: 12,
                        padding: 16,
                        background: "var(--surface-soft)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ fontSize: 15, color: "#c2410c" }}>Nagad Manual Payment</strong>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={nagadEnabled}
                            onChange={(e) => setNagadEnabled(e.target.checked)}
                          />
                          <span>{nagadEnabled ? "Enabled on Checkout" : "Hidden"}</span>
                        </label>
                      </div>

                      <div className="adm-form-row-2">
                        <div className="adm-field">
                          <label htmlFor="nagad-number">Nagad Number</label>
                          <input
                            id="nagad-number"
                            type="text"
                            className="adm-input"
                            placeholder="e.g. 018XXXXXXXX"
                            value={nagadNumber}
                            onChange={(e) => setNagadNumber(e.target.value)}
                          />
                        </div>
                        <div className="adm-field">
                          <label htmlFor="nagad-type">Account Type</label>
                          <select
                            id="nagad-type"
                            className="adm-select"
                            value={nagadType}
                            onChange={(e) =>
                              setNagadType(e.target.value as "Personal" | "Merchant" | "Agent")
                            }
                          >
                            <option value="Personal">Personal (Send Money)</option>
                            <option value="Merchant">Merchant (Payment)</option>
                            <option value="Agent">Agent (Cash Out)</option>
                          </select>
                        </div>
                      </div>

                      <div className="adm-field">
                        <label htmlFor="nagad-instruction">Checkout Instructions for Customer</label>
                        <textarea
                          id="nagad-instruction"
                          rows={2}
                          className="adm-input"
                          value={nagadInstruction}
                          onChange={(e) => setNagadInstruction(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="adm-field">
                    <label htmlFor="manual-payment-note">Verification Footnote (Shown Below TrxID Box)</label>
                    <input
                      id="manual-payment-note"
                      type="text"
                      className="adm-input"
                      value={manualPaymentNote}
                      onChange={(e) => setManualPaymentNote(e.target.value)}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="submit"
                      className="adm-btn adm-btn-primary"
                      disabled={savingManualPayment}
                    >
                      <CheckCircle2 size={15} />
                      {savingManualPayment ? "Saving Payment Numbers…" : "Save bKash & Nagad Numbers Live"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Pending Manual Payment Verification Queue */}
              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>Pending bKash / Nagad Payment Verification ({pendingPaymentVerifications.length})</h3>
                    <p className="adm-panel-sub">
                      Match the submitted Sender Number &amp; Transaction ID (TrxID) with your mobile SMS/statement, then click Verify to confirm Payment &amp; Order together.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="adm-btn adm-btn-sm adm-btn-secondary"
                    onClick={() => setActiveSection("orders")}
                  >
                    Open Full Orders Table
                  </button>
                </div>

                {pendingPaymentVerifications.length === 0 ? (
                  <div className="adm-empty-state" style={{ padding: "24px 16px" }}>
                    <CheckCircle2 size={24} color="#10b981" />
                    <span>All manual bKash &amp; Nagad transactions are verified! No pending payments in the queue.</span>
                  </div>
                ) : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>Customer</th>
                          <th>Channel</th>
                          <th>Sender Number</th>
                          <th>Transaction ID (TrxID)</th>
                          <th>Amount</th>
                          <th>Submitted</th>
                          <th>Verify Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingPaymentVerifications.map((order) => (
                          <tr key={order.id}>
                            <td>
                              <strong>{order.id}</strong>
                            </td>
                            <td>
                              <div className="adm-cell-stack">
                                <strong>{order.customer.name}</strong>
                                <span>{order.customer.phone}</span>
                              </div>
                            </td>
                            <td>
                              <span
                                className="adm-status-pill"
                                style={{
                                  background:
                                    order.paymentMethod === "bkash" ? "rgba(226,19,110,0.12)" : "rgba(234,88,12,0.12)",
                                  color: order.paymentMethod === "bkash" ? "#be123c" : "#c2410c",
                                }}
                              >
                                {order.paymentMethod.toUpperCase()}
                              </span>
                            </td>
                            <td>{order.paymentPhone || "—"}</td>
                            <td>
                              <code style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>
                                {order.paymentTrxId || "Not provided"}
                              </code>
                            </td>
                            <td>
                              <strong>{formatPrice(order.total)}</strong>
                            </td>
                            <td>{formatOrderDate(order.createdAt, true)}</td>
                            <td>
                              <div className="adm-row-actions">
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-sm adm-btn-primary"
                                  disabled={verifyingOrderId === order.id}
                                  onClick={() => void handleVerifyManualPayment(order.id, true)}
                                >
                                  <CheckCircle2 size={13} />
                                  {verifyingOrderId === order.id ? "Verifying…" : "Verify & Confirm"}
                                </button>
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-sm adm-btn-secondary"
                                  onClick={() =>
                                    void handleUpdateOrder({
                                      id: order.id,
                                      paymentStatus: "Failed",
                                    })
                                  }
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-sm adm-btn-secondary"
                                  onClick={() => setSelectedOrder(order)}
                                >
                                  <Eye size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <PaymentAnalyticsChart
                paymentStatuses={analytics.charts.paymentStatusBreakdown}
                paymentMethods={analytics.charts.paymentMethodBreakdown}
              />
            </div>
          )}

          {/* ================= 13. ADMIN USERS & ROLES SECTION ================= */}
          {activeSection === "users" && (
            <div className="adm-panel">
              <div className="adm-panel-head">
                <div>
                  <h3>Admin Users &amp; Access Control</h3>
                  <p className="adm-panel-sub">
                    Authenticated via HMAC-SHA256 HTTP-only session cookie
                  </p>
                </div>
              </div>
              <div className="adm-mini-stat-list">
                <div className="adm-mini-stat-row">
                  <div>
                    <strong>{status.defaultAdminEmail}</strong>
                    <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
                      Role: Super Administrator · Full Catalog, Inventory, Order &amp; Analytics
                      Access
                    </span>
                  </div>
                  <span className="adm-status-pill is-success">Active Session</span>
                </div>
              </div>
            </div>
          )}

          {/* ================= 13B. INTEGRATIONS SECTION ================= */}
          {activeSection === "integrations" && (() => {
            const savedFromEmail = analytics.settings.emailSettings?.fromEmail?.trim() || "";
            const savedFromName =
              analytics.settings.emailSettings?.fromName?.trim() || "HayaNest BD";
            const effectiveEmailFrom =
              savedFromEmail &&
              savedFromEmail.includes("@") &&
              !savedFromEmail.toLowerCase().endsWith("@smtp-brevo.com")
                ? `"${savedFromName}" <${savedFromEmail}>`
                : status.emailFrom || "Default (no-reply@hayanestbd.com)";
            const usesBrevoLoginFrom = effectiveEmailFrom
              .toLowerCase()
              .includes("@smtp-brevo.com");
            const emailSenderReady = Boolean(status.emailConfigured && !usesBrevoLoginFrom);

            return (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Header / Summary Banner */}
              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h2 style={{ fontSize: 20, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 10 }}>
                      <Blocks size={22} color="var(--brand)" />
                      Connected Services &amp; Cloud Integrations
                    </h2>
                    <p className="adm-panel-sub">
                      Overview and live connection status of all external APIs, databases, media CDNs, couriers, and tracking tools powering HayaNest BD.
                    </p>
                  </div>
                </div>

                {/* KPI Overview Grid */}
                <div className="adm-kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", marginTop: 12 }}>
                  <div className="adm-kpi-card">
                    <span className="adm-kpi-label">Active Integrations</span>
                    <div className="adm-kpi-val" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span>
                        {[
                          status.supabaseWriteConfigured,
                          status.cloudinaryConfigured,
                          emailSenderReady,
                          Boolean(
                            (steadfastEnabled && steadfastApiKey.trim()) ||
                              (pathaoEnabled &&
                                pathaoClientId.trim() &&
                                pathaoClientSecret.trim() &&
                                pathaoUsername.trim() &&
                                pathaoPassword.trim()),
                          ),
                          Boolean(fbPixelEnabled && fbPixelId.trim()),
                        ].filter(Boolean).length}{" "}
                        / 5
                      </span>
                      <span className="adm-status-pill is-success" style={{ fontSize: 11 }}>Operational</span>
                    </div>
                    <span className="adm-kpi-sub">External cloud systems syncing</span>
                  </div>

                  <div className="adm-kpi-card">
                    <span className="adm-kpi-label">PostgreSQL Database</span>
                    <div className="adm-kpi-val" style={{ fontSize: 18 }}>
                      {status.supabaseWriteConfigured ? "Supabase (Live)" : "Local File Store"}
                    </div>
                    <span className="adm-kpi-sub">
                      {status.supabaseWriteConfigured ? "PostgreSQL with RLS" : "Local fallback mode"}
                    </span>
                  </div>

                  <div className="adm-kpi-card">
                    <span className="adm-kpi-label">Media &amp; CDN</span>
                    <div className="adm-kpi-val" style={{ fontSize: 18 }}>
                      {status.cloudinaryConfigured ? "Cloudinary CDN" : "Local Uploads"}
                    </div>
                    <span className="adm-kpi-sub">
                      {status.cloudinaryConfigured ? `Cloud: ${status.cloudinaryCloudName || "i29k7i0j"}` : "Unconfigured"}
                    </span>
                  </div>

                  <div className="adm-kpi-card">
                    <span className="adm-kpi-label">Email Transporter</span>
                    <div className="adm-kpi-val" style={{ fontSize: 18 }}>
                      {status.emailConfigured ? (status.emailProvider || "Brevo SMTP") : "Dev Mode (Console)"}
                    </div>
                    <span className="adm-kpi-sub">
                      {!status.emailConfigured
                        ? "Needs SMTP credentials"
                        : usesBrevoLoginFrom
                          ? "Needs Verified Sender (From)"
                          : "300 free emails / day"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Integrations Grid List */}
              <div className="adm-grid-2">
                {/* 1. Supabase PostgreSQL Card */}
                <div className="adm-panel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: "#10b98118", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981", flexShrink: 0 }}>
                        <Database size={24} />
                      </div>
                      <div>
                        <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Supabase (PostgreSQL)</h3>
                        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                          Cloud Database &amp; Storage Architecture
                        </p>
                      </div>
                    </div>
                    <span className={`adm-status-pill ${status.supabaseWriteConfigured ? "is-success" : "is-warning"}`}>
                      {status.supabaseWriteConfigured ? "Connected" : "Local Mode"}
                    </span>
                  </div>

                  <div style={{ margin: "16px 0", fontSize: 12, background: "var(--surface-soft)", padding: 12, borderRadius: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Endpoint:</span>
                      <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{status.supabaseUrl || "zhctgkmufwyujbtmqlcz.supabase.co"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Live Tables:</span>
                      <span>products, orders, customers, store_settings</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Security:</span>
                      <span>Row Level Security (RLS) &amp; Dual Schema Active</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
                    <button
                      type="button"
                      className="adm-btn adm-btn-secondary"
                      onClick={handleSeedSupabase}
                      disabled={seedingSupabase}
                    >
                      <RefreshCw size={14} className={seedingSupabase ? "adm-spin" : ""} />
                      {seedingSupabase ? "Syncing Catalog…" : "Sync Catalog to Supabase"}
                    </button>
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="adm-btn adm-btn-secondary"
                    >
                      <ExternalLink size={14} />
                      Open Dashboard
                    </a>
                  </div>
                </div>

                {/* 2. Cloudinary Media CDN Card */}
                <div className="adm-panel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: "#3b82f618", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6", flexShrink: 0 }}>
                        <CloudUpload size={24} />
                      </div>
                      <div>
                        <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Cloudinary CDN</h3>
                        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                          Fast Image &amp; Story Video Global Delivery
                        </p>
                      </div>
                    </div>
                    <span className={`adm-status-pill ${status.cloudinaryConfigured ? "is-success" : "is-warning"}`}>
                      {status.cloudinaryConfigured ? "Active" : "Unconfigured"}
                    </span>
                  </div>

                  <div style={{ margin: "16px 0", fontSize: 12, background: "var(--surface-soft)", padding: 12, borderRadius: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Cloud Name:</span>
                      <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{status.cloudinaryCloudName || "i29k7i0j"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Image Transformation:</span>
                      <span>Auto WebP / AVIF (f_auto, q_auto)</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Story Videos:</span>
                      <span>720p HD Vertical Optimization</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
                    <a
                      href="https://console.cloudinary.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="adm-btn adm-btn-secondary"
                    >
                      <ExternalLink size={14} />
                      Cloudinary Console
                    </a>
                  </div>
                </div>

                {/* 3. Brevo Transactional Email Card */}
                <div className="adm-panel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: "#8b5cf618", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b5cf6", flexShrink: 0 }}>
                        <Mail size={24} />
                      </div>
                      <div>
                        <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Brevo (Transactional SMTP)</h3>
                        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                          Password Reset OTP &amp; Order Invoices
                        </p>
                      </div>
                    </div>
                    <span
                      className={`adm-status-pill ${
                        !status.emailConfigured || usesBrevoLoginFrom ? "is-warning" : "is-success"
                      }`}
                    >
                      {!status.emailConfigured
                        ? "Dev Mode"
                        : usesBrevoLoginFrom
                          ? "Sender Needed"
                          : "Connected"}
                    </span>
                  </div>

                  <div style={{ margin: "16px 0", fontSize: 12, background: "var(--surface-soft)", padding: 12, borderRadius: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Relay Server:</span>
                      <span style={{ fontFamily: "monospace" }}>smtp-relay.brevo.com:587</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Login User:</span>
                      <span style={{ fontFamily: "monospace", fontSize: 11 }}>{status.emailUser || "c20625001@smtp-brevo.com"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ color: "var(--muted)" }}>Active Sender (From):</span>
                      <span style={{ fontFamily: "monospace", fontSize: 11, textAlign: "right" }}>
                        {effectiveEmailFrom}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Daily Limit:</span>
                      <span style={{ color: "#10b981", fontWeight: 600 }}>300 emails / day (Free)</span>
                    </div>
                  </div>

                  {usesBrevoLoginFrom && (
                    <div
                      style={{
                        marginBottom: 12,
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "rgba(245, 158, 11, 0.12)",
                        border: "1px dashed rgba(245, 158, 11, 0.55)",
                        fontSize: 11.5,
                        lineHeight: 1.55,
                      }}
                    >
                      ⚠️ <strong>Action Required for Forgot Password Emails:</strong>{" "}
                      <code>c20625001@smtp-brevo.com</code> is only your SMTP login, and{" "}
                      <code>smtp-brevo.com</code> blocks delivery via{" "}
                      <code>SPF -all / DMARC p=reject</code>. Verify your store Gmail or domain in
                      Brevo → <em>Senders, Domains &amp; IPs → Senders</em> and save it below. Also
                      ensure your Brevo Transactional SMTP account is activated under{" "}
                      <em>Transactional → Logs</em>.
                    </div>
                  )}

                  <form
                    onSubmit={handleSaveEmailSender}
                    style={{
                      display: "grid",
                      gap: 8,
                      marginBottom: 12,
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      Verified Sender Configuration (Live Override)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 8 }}>
                      <input
                        type="text"
                        className="adm-input"
                        placeholder="Display Name (HayaNest BD)"
                        value={emailFromNameInput}
                        onChange={(e) => setEmailFromNameInput(e.target.value)}
                      />
                      <input
                        type="email"
                        className="adm-input"
                        placeholder="Verified Sender Email (e.g. yourstore@gmail.com)"
                        value={emailFromEmailInput}
                        onChange={(e) => setEmailFromEmailInput(e.target.value)}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <button
                        type="submit"
                        className="adm-btn adm-btn-primary adm-btn-sm"
                        disabled={savingEmailSender}
                      >
                        {savingEmailSender ? "Saving…" : "Save Sender Email"}
                      </button>
                      <input
                        type="email"
                        className="adm-input"
                        style={{ flex: 1, minWidth: 170 }}
                        placeholder="Test recipient (e.g. test@gmail.com)"
                        value={testEmailToInput}
                        onChange={(e) => setTestEmailToInput(e.target.value)}
                      />
                      <button
                        type="button"
                        className="adm-btn adm-btn-secondary adm-btn-sm"
                        onClick={() => void handleSendTestEmail()}
                        disabled={sendingTestEmail}
                      >
                        {sendingTestEmail ? "Sending…" : "Send Test Email"}
                      </button>
                    </div>
                  </form>

                  {smtpVerifyResult && (
                    <div
                      className={`adm-alert ${smtpVerifyResult.ok ? "is-success" : "is-error"}`}
                      style={{ marginBottom: 12, fontSize: 12 }}
                    >
                      {smtpVerifyResult.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                      <span>{smtpVerifyResult.message}</span>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
                    <button
                      type="button"
                      className="adm-btn adm-btn-secondary"
                      onClick={() => void handleTestSmtpConnection()}
                      disabled={smtpTesting}
                    >
                      <RefreshCw size={14} className={smtpTesting ? "adm-spin" : ""} />
                      {smtpTesting ? "Testing SMTP…" : "Test SMTP Handshake"}
                    </button>
                    <a
                      href="https://app.brevo.com/senders"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="adm-btn adm-btn-secondary"
                    >
                      <ExternalLink size={14} />
                      Brevo Senders
                    </a>
                    <a
                      href="https://app.brevo.com/transactional/email/logs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="adm-btn adm-btn-secondary"
                    >
                      <ExternalLink size={14} />
                      Transactional Logs
                    </a>
                  </div>
                </div>

                {/* 4. Steadfast Courier API Card */}
                <div className="adm-panel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: "#f59e0b18", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b", flexShrink: 0 }}>
                        <Truck size={24} />
                      </div>
                      <div>
                        <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Steadfast Courier API</h3>
                        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                          Bangladesh Parcels &amp; Customer Fraud Check
                        </p>
                      </div>
                    </div>
                    <span className={`adm-status-pill ${steadfastEnabled && steadfastApiKey.trim() && steadfastSecretKey.trim() ? "is-success" : "is-warning"}`}>
                      {steadfastEnabled && steadfastApiKey.trim() && steadfastSecretKey.trim() ? "Active" : "Keys Needed"}
                    </span>
                  </div>

                  <div style={{ margin: "16px 0", fontSize: 12, background: "var(--surface-soft)", padding: 12, borderRadius: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>1-Click Parcel Booking:</span>
                      <span>{steadfastEnabled && steadfastApiKey.trim() ? "Active on Orders Page" : "Requires API Keys"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Webhook Endpoint:</span>
                      <span style={{ fontFamily: "monospace" }}>/api/webhooks/steadfast</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Fraud Risk Detection:</span>
                      <span>{autoFraudCheck ? "Live check on buyer phone" : "Off"}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
                    <button
                      type="button"
                      className="adm-btn adm-btn-secondary"
                      onClick={() => setActiveSection("shipping")}
                    >
                      <Settings size={14} />
                      Configure API Keys
                    </button>
                    <a
                      href="https://portal.steadfast.com.bd"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="adm-btn adm-btn-secondary"
                    >
                      <ExternalLink size={14} />
                      Steadfast Portal
                    </a>
                  </div>
                </div>

                {/* 5. Meta (Facebook) Pixel Card */}
                <div className="adm-panel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: "#0668E118", display: "flex", alignItems: "center", justifyContent: "center", color: "#0668E1", flexShrink: 0 }}>
                        <Radio size={24} />
                      </div>
                      <div>
                        <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Meta (Facebook) Pixel</h3>
                        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                          E-commerce Conversion &amp; Ad Tracking
                        </p>
                      </div>
                    </div>
                    <span className={`adm-status-pill ${!fbPixelId.trim() ? "is-warning" : fbPixelEnabled ? "is-success" : "is-danger"}`}>
                      {!fbPixelId.trim() ? "Not Configured" : fbPixelEnabled ? "Active" : "Paused"}
                    </span>
                  </div>

                  <div style={{ margin: "16px 0", fontSize: 12, background: "var(--surface-soft)", padding: 12, borderRadius: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Pixel ID:</span>
                      <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{fbPixelId.trim() || "Not set yet"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Tracked Events:</span>
                      <span>ViewContent, AddToCart, InitiateCheckout, Purchase</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Diagnostics:</span>
                      <span>{fbPixelTestMode ? "Storefront Test Badge ON" : "Production Mode"}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
                    <button
                      type="button"
                      className="adm-btn adm-btn-secondary"
                      onClick={() => {
                        setActiveSection("settings");
                        setTimeout(() => {
                          document.getElementById("meta-pixel-settings")?.scrollIntoView({ behavior: "smooth" });
                        }, 100);
                      }}
                    >
                      <Settings size={14} />
                      Configure Pixel ID
                    </button>
                    <a
                      href="https://adsmanager.facebook.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="adm-btn adm-btn-secondary"
                    >
                      <ExternalLink size={14} />
                      Events Manager
                    </a>
                  </div>
                </div>

                {/* 6. Pathao Courier Card */}
                <div className="adm-panel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: "#ef444418", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", flexShrink: 0 }}>
                        <Truck size={24} />
                      </div>
                      <div>
                        <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Pathao Courier API</h3>
                        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                          On-demand Delivery &amp; Merchant Integration
                        </p>
                      </div>
                    </div>
                    <span
                      className={`adm-status-pill ${
                        pathaoEnabled &&
                        pathaoClientId.trim() &&
                        pathaoClientSecret.trim() &&
                        pathaoUsername.trim() &&
                        pathaoPassword.trim()
                          ? "is-success"
                          : "is-warning"
                      }`}
                    >
                      {pathaoEnabled &&
                      pathaoClientId.trim() &&
                      pathaoClientSecret.trim() &&
                      pathaoUsername.trim() &&
                      pathaoPassword.trim()
                        ? "Active"
                        : "Keys Needed"}
                    </span>
                  </div>

                  <div style={{ margin: "16px 0", fontSize: 12, background: "var(--surface-soft)", padding: 12, borderRadius: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Integration:</span>
                      <span>Pathao Aladdin API v1 ({courierTestMode ? "Sandbox" : "Production"})</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Default Store ID:</span>
                      <span style={{ fontFamily: "monospace" }}>{pathaoStoreId.trim() || "Configure in Shipping"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Webhook Endpoint:</span>
                      <span style={{ fontFamily: "monospace" }}>/api/webhooks/pathao</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
                    <button
                      type="button"
                      className="adm-btn adm-btn-secondary"
                      onClick={() => setActiveSection("shipping")}
                    >
                      <Settings size={14} />
                      Configure Pathao &amp; Hubs
                    </button>
                    <a
                      href="https://merchant.pathao.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="adm-btn adm-btn-secondary"
                    >
                      <ExternalLink size={14} />
                      Pathao Merchant
                    </a>
                  </div>
                </div>
              </div>
            </div>
            );
          })()}

          {/* ================= 14. SETTINGS SECTION ================= */}
          {activeSection === "settings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="adm-grid-2">
              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>Store &amp; Analytics Configuration</h3>
                    <p className="adm-panel-sub">
                      Configure timezone, stock alert thresholds, monthly revenue target, and
                      shipping fees
                    </p>
                  </div>
                </div>

                <form className="adm-form-stack" onSubmit={handleSaveSettings}>
                  <div className="adm-field">
                    <label htmlFor="set-name">Store Name</label>
                    <input
                      id="set-name"
                      type="text"
                      className="adm-input"
                      value={storeNameInput}
                      onChange={(e) => setStoreNameInput(e.target.value)}
                    />
                  </div>
                  <div className="adm-form-row-2">
                    <div className="adm-field">
                      <label htmlFor="set-tz">Store Timezone</label>
                      <input
                        id="set-tz"
                        type="text"
                        className="adm-input"
                        value={timezoneInput}
                        onChange={(e) => setTimezoneInput(e.target.value)}
                      />
                    </div>
                    <div className="adm-field">
                      <label htmlFor="set-thresh">Low Stock Alert Threshold</label>
                      <input
                        id="set-thresh"
                        type="number"
                        min="0"
                        className="adm-input"
                        value={thresholdInput}
                        onChange={(e) => setThresholdInput(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="adm-field">
                    <label htmlFor="set-target">Monthly Revenue Target (৳ Optional)</label>
                    <input
                      id="set-target"
                      type="number"
                      min="0"
                      className="adm-input"
                      placeholder="e.g. 150000"
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                    />
                  </div>
                  <div className="adm-form-row-2">
                    <div className="adm-field">
                      <label htmlFor="set-in-dhaka">Inside Dhaka Shipping (৳)</label>
                      <input
                        id="set-in-dhaka"
                        type="number"
                        min="0"
                        className="adm-input"
                        value={insideDhakaFeeInput}
                        onChange={(e) => setInsideDhakaFeeInput(e.target.value)}
                      />
                    </div>
                    <div className="adm-field">
                      <label htmlFor="set-out-dhaka">Outside Dhaka Shipping (৳)</label>
                      <input
                        id="set-out-dhaka"
                        type="number"
                        min="0"
                        className="adm-input"
                        value={outsideDhakaFeeInput}
                        onChange={(e) => setOutsideDhakaFeeInput(e.target.value)}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      paddingTop: 10,
                      borderTop: "1px solid var(--line)",
                      marginTop: 4,
                    }}
                  >
                    <h4 style={{ margin: "0 0 8px", fontSize: 13 }}>
                      Storefront Contact Info (Footer &amp; Contact Us Page)
                    </h4>
                    <div className="adm-form-row-2">
                      <div className="adm-field">
                        <label htmlFor="set-contact-phone">Support Phone / WhatsApp</label>
                        <input
                          id="set-contact-phone"
                          type="text"
                          className="adm-input"
                          placeholder="+880 1700-000000"
                          value={contactPhoneInput}
                          onChange={(e) => setContactPhoneInput(e.target.value)}
                        />
                      </div>
                      <div className="adm-field">
                        <label htmlFor="set-contact-email">Customer Care Email</label>
                        <input
                          id="set-contact-email"
                          type="email"
                          className="adm-input"
                          placeholder="support@hayanestbd.com"
                          value={contactEmailInput}
                          onChange={(e) => setContactEmailInput(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="adm-field" style={{ marginTop: 10 }}>
                      <label htmlFor="set-contact-loc">Studio / Dispatch Location</label>
                      <input
                        id="set-contact-loc"
                        type="text"
                        className="adm-input"
                        placeholder="Dhaka, Bangladesh"
                        value={contactLocationInput}
                        onChange={(e) => setContactLocationInput(e.target.value)}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      paddingTop: 10,
                      borderTop: "1px solid var(--line)",
                      marginTop: 4,
                    }}
                  >
                    <h4 style={{ margin: "0 0 8px", fontSize: 13 }}>
                      Footer Social Media Links (Optional URLs)
                    </h4>
                    <div className="adm-form-row-2">
                      <div className="adm-field">
                        <label htmlFor="set-soc-fb">Facebook URL</label>
                        <input
                          id="set-soc-fb"
                          type="url"
                          className="adm-input"
                          placeholder="https://facebook.com/..."
                          value={facebookUrlInput}
                          onChange={(e) => setFacebookUrlInput(e.target.value)}
                        />
                      </div>
                      <div className="adm-field">
                        <label htmlFor="set-soc-ig">Instagram URL</label>
                        <input
                          id="set-soc-ig"
                          type="url"
                          className="adm-input"
                          placeholder="https://instagram.com/..."
                          value={instagramUrlInput}
                          onChange={(e) => setInstagramUrlInput(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="adm-form-row-2" style={{ marginTop: 10 }}>
                      <div className="adm-field">
                        <label htmlFor="set-soc-yt">YouTube URL</label>
                        <input
                          id="set-soc-yt"
                          type="url"
                          className="adm-input"
                          placeholder="https://youtube.com/..."
                          value={youtubeUrlInput}
                          onChange={(e) => setYoutubeUrlInput(e.target.value)}
                        />
                      </div>
                      <div className="adm-field">
                        <label htmlFor="set-soc-tt">TikTok URL</label>
                        <input
                          id="set-soc-tt"
                          type="url"
                          className="adm-input"
                          placeholder="https://tiktok.com/@..."
                          value={tiktokUrlInput}
                          onChange={(e) => setTiktokUrlInput(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="adm-btn adm-btn-primary"
                    disabled={savingSettings}
                  >
                    {savingSettings ? "Saving…" : "Save Store Settings"}
                  </button>
                </form>
              </div>

              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h3>Cloud Infrastructure Status</h3>
                    <p className="adm-panel-sub">
                      Supabase PostgreSQL Database &amp; Cloudinary Image CDN
                    </p>
                  </div>
                </div>

                <div className="adm-mini-stat-list">
                  <div className="adm-mini-stat-row">
                    <div>
                      <strong>
                        <Database size={14} style={{ display: "inline", marginRight: 6 }} />
                        Supabase PostgreSQL
                      </strong>
                      <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
                        {status.supabaseWriteConfigured
                          ? "Connected to live PostgreSQL database"
                          : "Running in local persistence mode (add keys in .env.local)"}
                      </span>
                    </div>
                    <span
                      className={`adm-status-pill ${
                        status.supabaseWriteConfigured ? "is-success" : "is-warning"
                      }`}
                    >
                      {status.supabaseWriteConfigured ? "Live DB" : "Local Mode"}
                    </span>
                  </div>

                  <div className="adm-mini-stat-row">
                    <div>
                      <strong>
                        <CloudUpload size={14} style={{ display: "inline", marginRight: 6 }} />
                        Cloudinary Image CDN
                      </strong>
                      <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
                        {status.cloudinaryConfigured
                          ? "Connected with auto WebP/AVIF transformation"
                          : "Using public/uploads fallback (add keys in .env.local)"}
                      </span>
                    </div>
                    <span
                      className={`adm-status-pill ${
                        status.cloudinaryConfigured ? "is-success" : "is-warning"
                      }`}
                    >
                      {status.cloudinaryConfigured ? "Live CDN" : "Local Upload"}
                    </span>
                  </div>

                  <div className="adm-mini-stat-row">
                    <div>
                      <strong>
                        <Truck size={14} style={{ display: "inline", marginRight: 6 }} />
                        Dual-Courier APIs (Steadfast &amp; Pathao)
                      </strong>
                      <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
                        {(steadfastEnabled && steadfastApiKey.trim()) ||
                        (pathaoEnabled &&
                          pathaoClientId.trim() &&
                          pathaoClientSecret.trim() &&
                          pathaoUsername.trim() &&
                          pathaoPassword.trim())
                          ? `Connected (${steadfastEnabled && steadfastApiKey.trim() ? "Steadfast" : ""}${
                              steadfastEnabled &&
                              steadfastApiKey.trim() &&
                              pathaoEnabled &&
                              pathaoClientId.trim() &&
                              pathaoClientSecret.trim() &&
                              pathaoUsername.trim() &&
                              pathaoPassword.trim()
                                ? " + "
                                : ""
                            }${
                              pathaoEnabled &&
                              pathaoClientId.trim() &&
                              pathaoClientSecret.trim() &&
                              pathaoUsername.trim() &&
                              pathaoPassword.trim()
                                ? "Pathao"
                                : ""
                            }) · ${pickupHubs.length} pickup hub(s)`
                          : "Ready for API keys (configure under Shipping)"}
                      </span>
                    </div>
                    <span
                      className={`adm-status-pill ${
                        (steadfastEnabled && steadfastApiKey.trim()) ||
                        (pathaoEnabled &&
                          pathaoClientId.trim() &&
                          pathaoClientSecret.trim() &&
                          pathaoUsername.trim() &&
                          pathaoPassword.trim())
                          ? "is-success"
                          : "is-warning"
                      }`}
                    >
                      {(steadfastEnabled && steadfastApiKey.trim()) ||
                      (pathaoEnabled &&
                        pathaoClientId.trim() &&
                        pathaoClientSecret.trim() &&
                        pathaoUsername.trim() &&
                        pathaoPassword.trim())
                        ? "API Active"
                        : "Manual Mode"}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: 18 }}>
                  <button
                    type="button"
                    className="adm-btn adm-btn-secondary"
                    onClick={handleSeedSupabase}
                    disabled={seedingSupabase}
                  >
                    <RefreshCw size={15} />
                    {seedingSupabase ? "Syncing…" : "Sync All Products to Supabase"}
                  </button>
                </div>
              </div>
            </div>

            {/* Admin Security & Password Change Panel */}
            <div className="adm-panel" id="admin-security-settings">
              <div className="adm-panel-head">
                <div>
                  <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Lock size={16} />
                    Admin Security &amp; Password
                  </h3>
                  <p className="adm-panel-sub">
                    Update your master administrator password for logging in to the dashboard (/admin)
                  </p>
                </div>
              </div>

              <form className="adm-form-stack" onSubmit={handleAdminPasswordChange} style={{ maxWidth: 640 }}>
                {adminPwMessage && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      fontSize: 13,
                      backgroundColor: adminPwMessage.type === "success" ? "#ecfdf5" : "#fef2f2",
                      color: adminPwMessage.type === "success" ? "#065f46" : "#991b1b",
                      border: `1px solid ${adminPwMessage.type === "success" ? "#a7f3d0" : "#fecaca"}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <ShieldCheck size={16} />
                    <span>{adminPwMessage.text}</span>
                  </div>
                )}

                <div className="adm-field">
                  <label htmlFor="adm-current-pw">Current Password *</label>
                  <input
                    id="adm-current-pw"
                    type="password"
                    required
                    className="adm-input"
                    placeholder="Enter current admin password"
                    value={adminCurrentPassword}
                    onChange={(e) => setAdminCurrentPassword(e.target.value)}
                  />
                </div>

                <div className="adm-form-row-2">
                  <div className="adm-field">
                    <label htmlFor="adm-new-pw">New Password *</label>
                    <input
                      id="adm-new-pw"
                      type="password"
                      required
                      minLength={6}
                      className="adm-input"
                      placeholder="Minimum 6 characters"
                      value={adminNewPassword}
                      onChange={(e) => setAdminNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="adm-field">
                    <label htmlFor="adm-confirm-pw">Confirm New Password *</label>
                    <input
                      id="adm-confirm-pw"
                      type="password"
                      required
                      minLength={6}
                      className="adm-input"
                      placeholder="Repeat new password"
                      value={adminConfirmPassword}
                      onChange={(e) => setAdminConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 6 }}>
                  <button
                    type="submit"
                    className="adm-btn adm-btn-primary"
                    disabled={adminPwLoading}
                  >
                    <Lock size={15} />
                    {adminPwLoading ? "Updating Password…" : "Update Admin Password"}
                  </button>
                </div>
              </form>
            </div>

            {/* Meta (Facebook) Pixel & Conversion Tracking Panel */}
            <div className="adm-panel" id="meta-pixel-settings">
              <div className="adm-panel-head">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0 }}>Meta (Facebook) Pixel &amp; Conversion Tracking</h3>
                    <span
                      className={`adm-status-pill ${
                        !fbPixelId.trim()
                          ? "is-warning"
                          : fbPixelEnabled
                            ? "is-success"
                            : "is-danger"
                      }`}
                    >
                      {!fbPixelId.trim()
                        ? "⚪ Pixel Not Configured"
                        : fbPixelEnabled
                          ? "🟢 Active & Tracking"
                          : "🟡 Tracking Paused"}
                    </span>
                    {fbPixelTestMode && fbPixelEnabled && (
                      <span
                        className="adm-status-pill is-warning"
                        style={{ fontSize: 11 }}
                        title="Diagnostic test badge is visible on storefront"
                      >
                        🧪 Storefront Test Mode On
                      </span>
                    )}
                  </div>
                  <p className="adm-panel-sub" style={{ marginTop: 4 }}>
                    Add your Meta Pixel ID to automatically track storefront visitors, product views, add-to-carts, checkouts, and purchases in Meta Events Manager &amp; Ads Manager.
                  </p>
                </div>
              </div>

              <div className="adm-form-stack" style={{ gap: 18 }}>
                <div className="adm-form-row-2">
                  <div className="adm-field">
                    <label htmlFor="fb-pixel-id">
                      <strong>Meta Pixel ID (14–17 Digits)</strong>
                    </label>
                    <input
                      id="fb-pixel-id"
                      type="text"
                      className="adm-input"
                      placeholder="e.g. 182736455291048"
                      value={fbPixelId}
                      onChange={(e) => setFbPixelId(e.target.value.replace(/[^\d]/g, ""))}
                    />
                    <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, display: "block" }}>
                      Enter your numeric Pixel ID. Found in Meta Business Suite → Events Manager → Data Sources.
                    </span>
                  </div>

                  <div className="adm-field" style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={fbPixelEnabled}
                        onChange={(e) => setFbPixelEnabled(e.target.checked)}
                        style={{ width: 17, height: 17, accentColor: "#1877f2" }}
                      />
                      <span>Enable Meta Pixel Tracking on Storefront</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "var(--muted)" }}>
                      <input
                        type="checkbox"
                        checked={fbPixelTestMode}
                        onChange={(e) => setFbPixelTestMode(e.target.checked)}
                        style={{ width: 15, height: 15 }}
                      />
                      <span>Diagnostic / Test Mode (logs events in browser console &amp; displays floating pill on storefront)</span>
                    </label>
                  </div>
                </div>

                {/* Verification & Live Connection Toolbar */}
                <div
                  style={{
                    background: "var(--surface-sunken, #f8fafc)",
                    borderRadius: 10,
                    padding: "16px 18px",
                    border: "1px solid var(--line)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <strong style={{ fontSize: 13, display: "block" }}>
                        Connection Verification &amp; Diagnostics
                      </strong>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        {fbPixelVerifiedAt
                          ? `Last verified: ${new Date(fbPixelVerifiedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`
                          : "Status: Not verified yet. Click 'Verify Connection' to check."}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="adm-btn adm-btn-secondary"
                        onClick={handleVerifyFacebookPixel}
                        disabled={fbVerifying || !fbPixelId.trim()}
                      >
                        <RefreshCw size={14} className={fbVerifying ? "adm-spin" : ""} />
                        {fbVerifying ? "Verifying with Meta…" : "Verify Connection"}
                      </button>

                      <button
                        type="button"
                        className="adm-btn adm-btn-secondary"
                        onClick={handleSendTestPing}
                        disabled={fbSendingTestPing || !fbPixelId.trim()}
                        title="Dispatches a test event in this browser window to ensure Meta script executes"
                      >
                        <Activity size={14} />
                        {fbTestPingSent ? "✓ Test Sent!" : fbSendingTestPing ? "Sending…" : "Send Test Ping"}
                      </button>

                      {fbPixelId.trim() && (
                        <a
                          href={`https://business.facebook.com/events_manager2/list/pixel/${fbPixelId.trim()}/test_events`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="adm-btn adm-btn-secondary"
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
                        >
                          <span>Meta Events Manager</span>
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Verification Result Feedback Alert */}
                  {fbVerifyResult && (
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: 8,
                        fontSize: 12,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        background: fbVerifyResult.ok ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                        border: `1px solid ${fbVerifyResult.ok ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                        color: fbVerifyResult.ok ? "#166534" : "#991b1b",
                      }}
                    >
                      {fbVerifyResult.ok ? (
                        <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                      ) : (
                        <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                      )}
                      <div>
                        <strong>{fbVerifyResult.ok ? "Connection Status: Connected & Verified ✓" : "Verification Notice"}</strong>
                        <p style={{ margin: "3px 0 0" }}>{fbVerifyResult.message}</p>
                        {fbVerifyResult.testEventsUrl && (
                          <a
                            href={fbVerifyResult.testEventsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 5, fontWeight: 600, color: "inherit", textDecoration: "underline" }}
                          >
                            Open Meta Test Events Dashboard to see live events →
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Standard Events Tracked Breakdown */}
                <div>
                  <h4 style={{ margin: "8px 0 10px", fontSize: 13 }}>
                    Configured E-Commerce Tracking Events
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <div style={{ padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Check size={14} style={{ color: "#22c55e" }} />
                        <strong style={{ fontSize: 12 }}>PageView</strong>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4, display: "block" }}>
                        Fired automatically on every page load and Next.js client-side route navigation.
                      </span>
                    </div>

                    <div style={{ padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Check size={14} style={{ color: "#22c55e" }} />
                        <strong style={{ fontSize: 12 }}>ViewContent</strong>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4, display: "block" }}>
                        Fired when a customer views any product page with product ID, name, price, and currency (BDT).
                      </span>
                    </div>

                    <div style={{ padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Check size={14} style={{ color: "#22c55e" }} />
                        <strong style={{ fontSize: 12 }}>AddToCart</strong>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4, display: "block" }}>
                        Fired when adding an item to the shopping bag with selected colour, price, and quantity.
                      </span>
                    </div>

                    <div style={{ padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Check size={14} style={{ color: "#22c55e" }} />
                        <strong style={{ fontSize: 12 }}>InitiateCheckout</strong>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4, display: "block" }}>
                        Fired when customer arrives at the checkout page with cart item count and order subtotal.
                      </span>
                    </div>

                    <div style={{ padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Check size={14} style={{ color: "#22c55e" }} />
                        <strong style={{ fontSize: 12 }}>Purchase</strong>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4, display: "block" }}>
                        Fired immediately when an order is placed with order ID, total amount in BDT, and item count.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions & Verification Tips */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                    paddingTop: 8,
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <div style={{ fontSize: 12, color: "var(--muted)", maxWidth: 600 }}>
                    💡 <strong>Pixel Verification Tip:</strong> Install the official <strong>Meta Pixel Helper</strong> Chrome Extension. When you visit any page on your store, the extension icon will turn blue with a green checkmark showing live events received.
                  </div>

                  <button
                    type="button"
                    className="adm-btn adm-btn-primary"
                    onClick={handleSaveMetaPixel}
                    disabled={savingSettings}
                  >
                    {savingSettings ? "Saving…" : "Save Meta Pixel Settings"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* ================= MODAL 1: ADD / EDIT PRODUCT + LIVE PREVIEW ================= */}
      {showProductFormModal && (
        <div className="adm-modal-backdrop" role="dialog" aria-modal="true" aria-label="Product editor">
          <div className="adm-modal adm-modal-xl">
            <div className="adm-modal-head">
              <div>
                <h3>{editingId ? `Edit Product: ${name}` : "Add New Product"}</h3>
                <p className="adm-panel-sub">
                  Upload picture via Cloudinary CDN, set price &amp; cost price (COGS), and preview
                  the card live
                </p>
              </div>
              <button
                type="button"
                className="adm-icon-btn"
                onClick={() => setShowProductFormModal(false)}
                aria-label="Close product modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="adm-modal-body adm-product-editor-grid">
              <form className="adm-form-stack" onSubmit={handleSaveProduct}>
                <div className="adm-field">
                  <label>Product Pictures &amp; Gallery (Select multiple photos supported)</label>
                  <label className="adm-upload-dropzone">
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      onChange={handleFileSelect}
                      disabled={uploadingImage}
                    />
                    <ImagePlus size={24} />
                    <strong>
                      {uploadingImage
                        ? "Uploading & optimizing picture(s)…"
                        : "Click to select & upload pictures (Multi-image supported · JPG, PNG, WebP, AVIF)"}
                    </strong>
                    <span>Auto-compressed via Cloudinary CDN · Optimized for instant fast loading</span>
                  </label>

                  {galleryPhotos.length > 0 && (
                    <div className="adm-gallery-manager">
                      <div className="adm-gallery-header">
                        <span>
                          Product Photos (<strong>{galleryPhotos.length}</strong> photo{galleryPhotos.length > 1 ? "s" : ""}) · First photo is featured card display
                        </span>
                      </div>
                      <div className="adm-gallery-grid">
                        {galleryPhotos.map((photoItem, idx) => {
                          const isPrimary = idx === 0;
                          return (
                            <div
                              key={`${photoItem.src}-${idx}`}
                              className={`adm-gallery-card ${isPrimary ? "is-primary" : ""}`}
                            >
                              <div className="adm-gallery-thumb-wrap">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={photoItem.src}
                                  alt={photoItem.alt || `Photo ${idx + 1}`}
                                  className="adm-gallery-thumb"
                                />
                                {isPrimary && (
                                  <span className="adm-gallery-badge-primary">
                                    <Star size={10} fill="currentColor" /> Primary
                                  </span>
                                )}
                              </div>
                              <div className="adm-gallery-colour-bar">
                                <span
                                  className="adm-gallery-colour-dot"
                                  style={{
                                    background:
                                      taxonomy.colours.find(
                                        (c) => c.value === (photoItem.colour || colour),
                                      )?.swatch || "#888",
                                  }}
                                  aria-hidden="true"
                                />
                                <select
                                  value={photoItem.colour || colour}
                                  onChange={(e) =>
                                    handleSetPhotoColour(idx, e.target.value as ProductColour)
                                  }
                                  className="adm-gallery-colour-dropdown"
                                  title="Assign this picture to a specific color variant"
                                >
                                  {taxonomy.colours.map((c) => (
                                    <option key={c.value} value={c.value}>
                                      {c.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="adm-gallery-card-actions">
                                {!isPrimary ? (
                                  <button
                                    type="button"
                                    className="adm-gallery-btn-primary"
                                    onClick={() => handleSetPrimaryPhoto(idx)}
                                    title="Set as featured main photo"
                                  >
                                    Make Primary
                                  </button>
                                ) : (
                                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#0f766e" }}>
                                    ⭐ Main
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="adm-gallery-btn-delete"
                                  onClick={() => handleRemovePhoto(idx)}
                                  title="Remove photo"
                                  aria-label="Remove photo"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {(() => {
                        const configuredColours = Array.from(
                          new Set(galleryPhotos.map((p) => p.colour || colour)),
                        );
                        if (configuredColours.length > 1) {
                          return (
                            <div className="adm-gallery-colour-summary">
                              <span className="adm-gallery-colour-summary-title">
                                🎨 <strong>{configuredColours.length} Color Variants Configured:</strong>
                              </span>
                              <div className="adm-gallery-colour-pills">
                                {configuredColours.map((colKey) => {
                                  const meta = resolveColourMeta(colKey, taxonomy.colours);
                                  const count = galleryPhotos.filter(
                                    (p) => (p.colour || colour) === colKey,
                                  ).length;
                                  return (
                                    <span key={colKey} className="adm-gallery-colour-pill">
                                      <span
                                        className="adm-gallery-colour-dot"
                                        style={{ background: meta.swatch }}
                                        aria-hidden="true"
                                      />
                                      {meta.label} ({count} photo{count > 1 ? "s" : ""})
                                    </span>
                                  );
                                })}
                              </div>
                              <span className="adm-hint">
                                When a customer selects any of these colours on the product page, the main image will automatically switch to that colour&apos;s picture.
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </div>

                <div className="adm-form-row-2">
                  <div className="adm-field">
                    <label htmlFor="mod-img-src">Primary Image URL</label>
                    <input
                      id="mod-img-src"
                      type="text"
                      className="adm-input"
                      value={imageSrc}
                      onChange={(e) => {
                        const val = e.target.value;
                        setImageSrc(val);
                        setGalleryPhotos((prev) =>
                          prev.map((p, idx) => (idx === 0 ? { ...p, src: val } : p)),
                        );
                      }}
                      required
                    />
                  </div>
                  <div className="adm-field">
                    <label htmlFor="mod-img-alt">Primary Image Alt Text</label>
                    <input
                      id="mod-img-alt"
                      type="text"
                      className="adm-input"
                      value={imageAlt}
                      onChange={(e) => {
                        const val = e.target.value;
                        setImageAlt(val);
                        setGalleryPhotos((prev) =>
                          prev.map((p, idx) => (idx === 0 ? { ...p, alt: val } : p)),
                        );
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="adm-form-row-3">
                  <div className="adm-field">
                    <label htmlFor="mod-name">Product Title</label>
                    <input
                      id="mod-name"
                      type="text"
                      className="adm-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="adm-field">
                    <label htmlFor="mod-sku">SKU (Auto if blank)</label>
                    <input
                      id="mod-sku"
                      type="text"
                      className="adm-input"
                      placeholder="e.g. HN-MOD-ROS-01"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                    />
                  </div>
                  <div className="adm-field">
                    <label htmlFor="mod-status">Visibility Status</label>
                    <select
                      id="mod-status"
                      className="adm-select"
                      value={productStatus}
                      onChange={(e) => setProductStatus(e.target.value as ProductStatus)}
                    >
                      <option value="active">Active (Visible)</option>
                      <option value="inactive">Inactive (Hidden)</option>
                    </select>
                  </div>
                </div>

                {(() => {
                  const trimmedName = name.trim().toLowerCase();
                  const trimmedSku = sku.trim().toLowerCase();
                  if (!trimmedName && !trimmedSku) return null;
                  const exactMatch = products.find(
                    (p) =>
                      p.id !== editingId &&
                      ((trimmedSku && p.sku.toLowerCase() === trimmedSku) ||
                        (p.name.trim().toLowerCase() === trimmedName &&
                          p.category === category &&
                          (p.fabric ?? null) === (category === "accessories" ? null : fabric) &&
                          p.colour === colour)),
                  );
                  const sameNameDiffVariant =
                    !exactMatch && trimmedName
                      ? products.find(
                          (p) =>
                            p.id !== editingId && p.name.trim().toLowerCase() === trimmedName,
                        )
                      : undefined;

                  if (exactMatch) {
                    return (
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          background: "rgba(245, 158, 11, 0.12)",
                          border: "1px solid rgba(245, 158, 11, 0.4)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                          fontSize: 12,
                        }}
                      >
                        <span>
                          <strong>Duplicate Guard:</strong> &ldquo;{exactMatch.name}&rdquo; (SKU:{" "}
                          <code>{exactMatch.sku}</code>) with the same attributes already exists in
                          Inventory. Saving will update &amp; merge sections into the existing product.
                        </span>
                        <button
                          type="button"
                          className="adm-btn adm-btn-sm adm-btn-secondary"
                          onClick={() => openEditProduct(exactMatch)}
                        >
                          Load Existing to Edit
                        </button>
                      </div>
                    );
                  }

                  if (sameNameDiffVariant) {
                    const colLabel = resolveColourMeta(colour, taxonomy.colours).label;
                    const suggestedTitle = `${name.trim()} (${colLabel})`;
                    return (
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          background: "rgba(59, 130, 246, 0.1)",
                          border: "1px solid rgba(59, 130, 246, 0.35)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                          fontSize: 12,
                        }}
                      >
                        <span>
                          Another product named &ldquo;{sameNameDiffVariant.name}&rdquo; exists in{" "}
                          <strong>{sameNameDiffVariant.colour}</strong>. Include the colour in the
                          title to keep catalog names distinct.
                        </span>
                        <button
                          type="button"
                          className="adm-btn adm-btn-sm adm-btn-secondary"
                          onClick={() => setName(suggestedTitle)}
                        >
                          Use &ldquo;{suggestedTitle}&rdquo;
                        </button>
                      </div>
                    );
                  }

                  return null;
                })()}

                <div className="adm-form-row-3">
                  <div className="adm-field">
                    <label htmlFor="mod-price">Selling Price (৳)</label>
                    <input
                      id="mod-price"
                      type="number"
                      min="0"
                      className="adm-input"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      required
                    />
                  </div>
                  <div className="adm-field">
                    <label htmlFor="mod-orig-price">Original Price (৳ Optional)</label>
                    <input
                      id="mod-orig-price"
                      type="number"
                      min="0"
                      className="adm-input"
                      placeholder="For sale discount"
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(e.target.value)}
                    />
                  </div>
                  <div className="adm-field">
                    <label htmlFor="mod-cost-price">Cost Price / COGS (৳)</label>
                    <input
                      id="mod-cost-price"
                      type="number"
                      min="0"
                      className="adm-input"
                      placeholder="For profit calculation"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                    />
                  </div>
                </div>

                <div className="adm-field">
                  <label htmlFor="mod-desc">Short Description (Shown on Product Card)</label>
                  <textarea
                    id="mod-desc"
                    className="adm-textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="adm-form-row-3">
                  <div className="adm-field">
                    <label htmlFor="mod-cat">Category</label>
                    <select
                      id="mod-cat"
                      className="adm-select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ProductCategory)}
                    >
                      {taxonomy.categories.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(taxonomy.categories.find((c) => c.value === category)?.hasFabric ??
                    category !== "accessories") && (
                    <div className="adm-field">
                      <label htmlFor="mod-fab">Fabric</label>
                      <select
                        id="mod-fab"
                        className="adm-select"
                        value={fabric}
                        onChange={(e) => {
                          const nextF = e.target.value as Fabric;
                          setFabric(nextF);
                          const fabMeta = taxonomy.fabrics.find((f) => f.value === nextF);
                          setMaterial(
                            fabMeta?.label ?? nextF.charAt(0).toUpperCase() + nextF.slice(1),
                          );
                        }}
                      >
                        {taxonomy.fabrics.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="adm-field">
                    <label htmlFor="mod-col">Primary Colour</label>
                    <select
                      id="mod-col"
                      className="adm-select"
                      value={colour}
                      onChange={(e) => setColour(e.target.value as ProductColour)}
                    >
                      {taxonomy.colours.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Visual Colour Swatch Selector + Inline Color Picker */}
                <div className="adm-field">
                  <label>
                    Quick Colour Swatch Picker (Selected:{" "}
                    <strong>{resolveColourMeta(colour, taxonomy.colours).label}</strong>)
                  </label>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginBottom: 8,
                    }}
                  >
                    {taxonomy.colours.map((col) => {
                      const isSelected = colour === col.value;
                      return (
                        <button
                          key={col.value}
                          type="button"
                          onClick={() => setColour(col.value)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "5px 11px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: isSelected ? 700 : 500,
                            background: isSelected ? "var(--ink)" : "var(--surface-soft)",
                            color: isSelected ? "var(--page)" : "var(--ink)",
                            border: isSelected ? "1px solid var(--ink)" : "1px solid var(--line)",
                            cursor: "pointer",
                          }}
                        >
                          <span
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              background: col.swatch,
                              border: "1px solid rgba(255,255,255,0.45)",
                            }}
                          />
                          {col.label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    <input
                      type="color"
                      aria-label="Pick custom colour"
                      value={
                        newColourSwatch.startsWith("#") && newColourSwatch.length === 7
                          ? newColourSwatch
                          : "#0f766e"
                      }
                      onChange={(e) => setNewColourSwatch(e.target.value)}
                      style={{
                        width: 34,
                        height: 32,
                        padding: 2,
                        borderRadius: 8,
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        cursor: "pointer",
                      }}
                    />
                    <input
                      type="text"
                      className="adm-input-sm"
                      style={{ width: 170 }}
                      placeholder="New colour name (e.g. Teal)…"
                      value={newColourLabel}
                      onChange={(e) => setNewColourLabel(e.target.value)}
                    />
                    <button
                      type="button"
                      className="adm-btn adm-btn-sm adm-btn-secondary"
                      disabled={savingTaxonomy || !newColourLabel.trim()}
                      onClick={() => void handleAddColour()}
                    >
                      <Plus size={13} /> Add Custom Colour
                    </button>
                  </div>
                </div>

                <div className="adm-form-row-3">
                  <div className="adm-field">
                    <label htmlFor="mod-stock">Stock Quantity</label>
                    <input
                      id="mod-stock"
                      type="number"
                      min="0"
                      className="adm-input"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      required
                    />
                  </div>
                  <div className="adm-field">
                    <label htmlFor="mod-low">Low Stock Threshold</label>
                    <input
                      id="mod-low"
                      type="number"
                      min="0"
                      className="adm-input"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                    />
                  </div>
                  <div className="adm-field">
                    <label htmlFor="mod-size">Size</label>
                    <input
                      id="mod-size"
                      type="text"
                      className="adm-input"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                    />
                  </div>
                </div>

                  {/* Fulfillment Source & Method A Pickup Hub */}
                  <div className="adm-fulfillment-product-box">
                    <div className="adm-form-row-2">
                      <div className="adm-field">
                        <label htmlFor="mod-fulfillment-source">Fulfillment Mode</label>
                        <select
                          id="mod-fulfillment-source"
                          className="adm-select"
                          value={productFulfillmentSource}
                          onChange={(e) => {
                            const nextSource = e.target.value as FulfillmentSource;
                            setProductFulfillmentSource(nextSource);
                            const matchingHub = resolvePickupHubForSource(
                              pickupHubs,
                              nextSource,
                              undefined,
                              analytics.settings.courier,
                            );
                            setProductPickupHubId(matchingHub.id);
                          }}
                        >
                          <option value="in-house">Own Stock (Direct Parcel from My Address)</option>
                          <option value="supplier">Supplier Dropship (Method A · Own Courier Merchant)</option>
                        </select>
                      </div>
                      <div className="adm-field">
                        <label htmlFor="mod-pickup-hub">Assigned Pickup Hub / Store</label>
                        <select
                          id="mod-pickup-hub"
                          className="adm-select"
                          value={productPickupHubId}
                          onChange={(e) => setProductPickupHubId(e.target.value)}
                        >
                          {(() => {
                            const matching = pickupHubs.filter(
                              (h) => h.source === productFulfillmentSource,
                            );
                            const list = matching.length > 0 ? matching : pickupHubs;
                            return list.map((hub) => (
                              <option key={hub.id} value={hub.id}>
                                {hub.name} (
                                {hub.preferredCourier === "pathao" ? "Pathao" : "Steadfast"})
                              </option>
                            ));
                          })()}
                        </select>
                      </div>
                    </div>
                    <p className="adm-muted-note" style={{ margin: "6px 0 0", fontSize: 11.5 }}>
                      Mixed carts containing both <strong>Own Stock</strong> and{" "}
                      <strong>Supplier Dropship</strong> products are automatically organized into
                      separate split parcels for dispatch.
                    </p>
                  </div>

                <div className="adm-field">
                  <label>Homepage Showcase Sections</label>
                  <div className="adm-check-grid">
                    {SECTION_OPTIONS.map((opt) => (
                      <label key={opt.key} className="adm-check-chip">
                        <input
                          type="checkbox"
                          checked={sections.includes(opt.key)}
                          onChange={() =>
                            setSections((prev) =>
                              prev.includes(opt.key)
                                ? prev.filter((s) => s !== opt.key)
                                : [...prev, opt.key],
                            )
                          }
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="adm-modal-actions">
                  <button
                    type="submit"
                    className="adm-btn adm-btn-primary"
                    disabled={savingProduct}
                  >
                    <CloudUpload size={15} />
                    {savingProduct
                      ? "Saving…"
                      : editingId
                        ? "Update Product"
                        : "Publish Product"}
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn-secondary"
                    onClick={() => setShowProductFormModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>

              <div className="adm-preview-box">
                <h4>Live Storefront Card Preview</h4>
                <div style={{ maxWidth: 255, marginInline: "auto" }}>
                  <ProductCard
                    product={previewProduct}
                    variant={sections.includes("flash-sale") ? "sale" : "standard"}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: QUICK ORDER DETAILS & REFUND MANAGER ================= */}
      {selectedOrder && (
        <div className="adm-modal-backdrop" role="dialog" aria-modal="true" aria-label="Order details">
          <div className="adm-modal adm-modal-lg">
            <div className="adm-modal-head">
              <div>
                <h3>Order {selectedOrder.id}</h3>
                <p className="adm-panel-sub">
                  Placed on {formatOrderDate(selectedOrder.createdAt, true)}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className="adm-btn adm-btn-sm adm-btn-secondary"
                  onClick={() => handlePrintInvoice(selectedOrder)}
                >
                  <Printer size={14} /> Print Invoice
                </button>
                <button
                  type="button"
                  className="adm-icon-btn"
                  onClick={() => setSelectedOrder(null)}
                  aria-label="Close order details"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="adm-modal-body adm-form-stack">
              <div className="adm-grid-2">
                <div className="adm-info-block">
                  <h4>Customer Information</h4>
                  <p>
                    <strong>{selectedOrder.customer.name}</strong>
                  </p>
                  <p>Phone: {selectedOrder.customer.phone}</p>
                  {selectedOrder.customer.email && <p>Email: {selectedOrder.customer.email}</p>}
                  <p>
                    Address: {selectedOrder.customer.address}, {selectedOrder.customer.city}
                  </p>
                  <p>Zone: {selectedOrder.deliveryZone}</p>
                </div>

                <div className="adm-info-block">
                  <h4>Financial &amp; Payment Breakdown</h4>
                  <p>Subtotal: {formatPrice(selectedOrder.subtotal)}</p>
                  <p>Shipping Fee: {formatPrice(selectedOrder.shippingFee)}</p>
                  <p>Discount: {formatPrice(selectedOrder.discountAmount)}</p>
                  <p>Refund Issued: {formatPrice(selectedOrder.refundAmount)}</p>
                  <p>
                    <strong>Total: {formatPrice(selectedOrder.total)}</strong> (
                    {selectedOrder.paymentMethod.toUpperCase()} ·{" "}
                    <strong>{selectedOrder.paymentStatus}</strong>)
                  </p>
                  {selectedOrder.paymentPhone && (
                    <p>
                      Sender Wallet Number: <strong>{selectedOrder.paymentPhone}</strong>
                    </p>
                  )}
                  {selectedOrder.paymentTrxId && (
                    <p>
                      Transaction ID (TrxID):{" "}
                      <code style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>
                        {selectedOrder.paymentTrxId}
                      </code>
                    </p>
                  )}
                </div>
              </div>

              {selectedOrder.paymentMethod !== "cod" && (
                <div
                  className="adm-info-block"
                  style={{
                    borderLeft: `4px solid ${
                      selectedOrder.paymentStatus === "Paid" ? "#10b981" : "#f59e0b"
                    }`,
                    background: "var(--surface)",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                        <Wallet size={16} />
                        {selectedOrder.paymentMethod.toUpperCase()} Manual Payment Verification
                      </h4>
                      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                        Sender: <strong>{selectedOrder.paymentPhone || "—"}</strong> · TrxID:{" "}
                        <strong style={{ fontFamily: "monospace" }}>
                          {selectedOrder.paymentTrxId || "Not provided"}
                        </strong>
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {selectedOrder.paymentStatus !== "Paid" ? (
                        <>
                          <button
                            type="button"
                            className="adm-btn adm-btn-sm adm-btn-primary"
                            disabled={verifyingOrderId === selectedOrder.id}
                            onClick={() => void handleVerifyManualPayment(selectedOrder.id, true)}
                          >
                            <CheckCircle2 size={14} />{" "}
                            {verifyingOrderId === selectedOrder.id
                              ? "Verifying…"
                              : "Verify Payment (Paid) & Confirm Order"}
                          </button>
                          <button
                            type="button"
                            className="adm-btn adm-btn-sm adm-btn-secondary"
                            disabled={verifyingOrderId === selectedOrder.id}
                            onClick={() => void handleVerifyManualPayment(selectedOrder.id, false)}
                          >
                            Mark Paid Only
                          </button>
                          <button
                            type="button"
                            className="adm-btn adm-btn-sm adm-btn-secondary"
                            onClick={() =>
                              void handleUpdateOrder({
                                id: selectedOrder.id,
                                paymentStatus: "Failed",
                              })
                            }
                          >
                            Reject / Invalid TrxID
                          </button>
                        </>
                      ) : (
                        <span className="adm-status-pill is-success">
                          Payment Verified · Paid ✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="adm-info-block">
                <h4>Ordered Items ({selectedOrder.items.length})</h4>
                <div className="adm-mini-stat-list">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={`${item.id || item.name}-${item.colour || ""}-${idx}`} className="adm-mini-stat-row">
                      <span>
                        {item.name}
                        {item.colour ? ` (${item.colour})` : ""} × {item.quantity}
                        <span
                          className={`adm-mini-tag ${item.fulfillmentSource === "supplier" ? "is-supplier" : ""}`}
                          style={{ marginLeft: 8, fontSize: 10 }}
                        >
                          {item.fulfillmentSource === "supplier"
                            ? `🤝 ${item.pickupHubName || "Supplier Hub"}`
                            : `📦 ${item.pickupHubName || "Own Stock"}`}
                        </span>
                      </span>
                      <strong>{formatPrice(item.price * item.quantity)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dual-Courier Split Shipments, Method A Dispatch & Fraud Check Block */}
              {(() => {
                const effectiveShipments = buildOrderShipments(
                  selectedOrder,
                  analytics.settings.courier,
                );
                const pendingShipments = effectiveShipments.filter(
                  (s) => !s.trackingCode && !s.consignmentId,
                );
                const anyDispatched = effectiveShipments.some(
                  (s) => Boolean(s.trackingCode || s.consignmentId),
                );
                const isMixedCart = hasMixedFulfillmentItems(
                  selectedOrder.items,
                  analytics.settings.courier,
                );

                return (
                  <div
                    className="adm-info-block"
                    style={{
                      borderLeft: "4px solid var(--accent)",
                      background: "var(--surface)",
                      borderRadius: 12,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      <div>
                        <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                          <Truck size={16} /> Courier Dispatch, Split Shipments &amp; Fraud Check
                        </h4>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          Steadfast &amp; Pathao per-parcel dispatch · {effectiveShipments.length} parcel(s)
                          {isMixedCart ? " · Mixed Own Stock & Supplier Hub" : ""}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="adm-btn adm-btn-sm adm-btn-secondary"
                          onClick={() => void handleCheckFraud(selectedOrder.customer.phone)}
                          disabled={fraudCheckingPhone === selectedOrder.customer.phone}
                        >
                          <ShieldCheck size={14} />{" "}
                          {fraudCheckingPhone === selectedOrder.customer.phone
                            ? "Checking…"
                            : "Fraud Check"}
                        </button>
                        {!anyDispatched &&
                          selectedOrder.status !== "Cancelled" &&
                          selectedOrder.items.length > 0 && (
                            <>
                              {effectiveShipments.length === 1 && isMixedCart && (
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-sm adm-btn-secondary"
                                  onClick={() =>
                                    void handleRebuildShipments(selectedOrder, "split-auto")
                                  }
                                  disabled={rebuildingShipmentsOrderId === selectedOrder.id}
                                >
                                  Split by Hub
                                </button>
                              )}
                              {effectiveShipments.length > 1 && (
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-sm adm-btn-secondary"
                                  onClick={() =>
                                    void handleRebuildShipments(selectedOrder, "combine-single")
                                  }
                                  disabled={rebuildingShipmentsOrderId === selectedOrder.id}
                                >
                                  Combine 1 Parcel
                                </button>
                              )}
                            </>
                          )}
                        {anyDispatched && (
                          <button
                            type="button"
                            className="adm-btn adm-btn-sm adm-btn-secondary"
                            onClick={() => void handleSyncCourierStatus(selectedOrder)}
                            disabled={syncingCourierOrderId === selectedOrder.id}
                          >
                            <RefreshCw
                              size={13}
                              className={syncingCourierOrderId === selectedOrder.id ? "adm-spin" : ""}
                            />
                            Sync Status
                          </button>
                        )}
                        {pendingShipments.length > 1 && selectedOrder.status !== "Cancelled" && (
                          <button
                            type="button"
                            className="adm-btn adm-btn-sm adm-btn-primary"
                            onClick={() =>
                              void handleDispatchCourier(selectedOrder, {
                                dispatchAllPending: true,
                              })
                            }
                            disabled={dispatchingOrderId === selectedOrder.id}
                          >
                            <Send size={13} /> Dispatch All ({pendingShipments.length})
                          </button>
                        )}
                      </div>
                    </div>

                    {courierFeedback[selectedOrder.id] && (
                      <div
                        className="adm-alert is-success"
                        style={{ marginBottom: 12, padding: "8px 12px", fontSize: 12 }}
                      >
                        <span>{courierFeedback[selectedOrder.id]}</span>
                      </div>
                    )}

                    {/* Parcels Stack */}
                    <div className="adm-shipment-list">
                      {effectiveShipments.map((pkg) => {
                        const draft =
                          shipmentDrafts[getShipmentDraftKey(selectedOrder.id, pkg.id)] ?? {};
                        const selectedCourier: CourierProvider | "manual" =
                          draft.courierProvider ?? pkg.courierProvider ?? "steadfast";
                        const selectedHubId = draft.pickupHubId ?? pkg.pickupHubId ?? "";
                        const selectedStoreId =
                          draft.pathaoStoreId ?? pkg.pathaoStoreId ?? pathaoStoreId ?? "";
                        const codInputValue =
                          draft.codAmount !== undefined ? draft.codAmount : String(pkg.codAmount);
                        const noteInputValue = draft.note ?? "";
                        const manualCodeValue = draft.manualTrackingCode ?? "";
                        const isDispatched = Boolean(pkg.trackingCode || pkg.consignmentId);
                        const trackingCodeValue = pkg.trackingCode || pkg.consignmentId || "";
                        const trackUrl = trackingCodeValue
                          ? getCourierTrackingUrl(pkg.courierProvider, trackingCodeValue)
                          : null;
                        const thisDispatchKey = `${selectedOrder.id}::${pkg.id}`;
                        const isThisDispatching = dispatchingTargetKey === thisDispatchKey;
                        const slipKey = `slip-${selectedOrder.id}-${pkg.id}`;

                        return (
                          <div
                            key={pkg.id}
                            className={`adm-shipment-card ${
                              pkg.fulfillmentSource === "supplier" ? "is-supplier" : ""
                            }`}
                          >
                            <div className="adm-shipment-card-head">
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                  <strong>{pkg.label}</strong>
                                  <span
                                    className={`adm-status-pill ${
                                      pkg.fulfillmentSource === "supplier" ? "is-warning" : "is-ready"
                                    }`}
                                  >
                                    {pkg.fulfillmentSource === "supplier"
                                      ? "🤝 Supplier Hub"
                                      : "📦 Own Stock"}
                                  </span>
                                  <span className="adm-mini-tag">Ref: {pkg.invoiceRef || selectedOrder.id}</span>
                                </div>
                                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                                  Items:{" "}
                                  {pkg.items
                                    .map(
                                      (it) =>
                                        `${it.quantity}× ${it.name}${it.colour ? ` (${it.colour})` : ""}`,
                                    )
                                    .join(", ")}
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <span
                                  className={`adm-status-pill ${
                                    pkg.deliveryStatus === "Delivered"
                                      ? "is-success"
                                      : pkg.deliveryStatus === "Returned" ||
                                          pkg.deliveryStatus === "Cancelled"
                                        ? "is-danger"
                                        : pkg.deliveryStatus === "In Transit" ||
                                            pkg.deliveryStatus === "Out for Delivery"
                                          ? "is-info"
                                          : "is-warning"
                                  }`}
                                >
                                  {pkg.deliveryStatus}
                                </span>
                                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                                  COD: {formatPrice(pkg.codAmount)}
                                </div>
                              </div>
                            </div>

                            {isDispatched ? (
                              <div className="adm-shipment-tracked-box">
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 12.5 }}>
                                  <span>
                                    Courier:{" "}
                                    <strong style={{ textTransform: "uppercase" }}>
                                      {pkg.courierProvider || "steadfast"}
                                    </strong>
                                  </span>
                                  <span>
                                    Tracking: <strong>{trackingCodeValue}</strong>
                                  </span>
                                  {pkg.consignmentId && pkg.consignmentId !== pkg.trackingCode && (
                                    <span>
                                      Consignment: <strong>{pkg.consignmentId}</strong>
                                    </span>
                                  )}
                                  {pkg.courierRawStatus && (
                                    <span>
                                      Courier State: <strong>{pkg.courierRawStatus}</strong>
                                    </span>
                                  )}
                                  {typeof pkg.deliveryFee === "number" && pkg.deliveryFee > 0 && (
                                    <span>
                                      Courier Charge: <strong>{formatPrice(pkg.deliveryFee)}</strong>
                                    </span>
                                  )}
                                </div>
                                {pkg.courierTrackingMessage && (
                                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                                    {pkg.courierTrackingMessage}
                                  </div>
                                )}
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                                  <button
                                    type="button"
                                    className="adm-btn adm-btn-xs adm-btn-secondary"
                                    onClick={() =>
                                      void copyTextValue(
                                        `trk-${pkg.id}`,
                                        trackingCodeValue,
                                        "Tracking Code",
                                      )
                                    }
                                  >
                                    {copiedKeyId === `trk-${pkg.id}` ? <Check size={12} /> : <Copy size={12} />}
                                    {copiedKeyId === `trk-${pkg.id}` ? "Copied" : "Copy Tracking"}
                                  </button>
                                  {trackUrl && (
                                    <a
                                      href={trackUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="adm-btn adm-btn-xs adm-btn-secondary"
                                    >
                                      <ExternalLink size={12} /> Track Live
                                    </a>
                                  )}
                                  {(pkg.courierProvider === "steadfast" ||
                                    pkg.courierProvider === "pathao") && (
                                    <button
                                      type="button"
                                      className="adm-btn adm-btn-xs adm-btn-secondary"
                                      onClick={() =>
                                        void handleSyncCourierStatus(selectedOrder, pkg.id)
                                      }
                                      disabled={syncingCourierOrderId === selectedOrder.id}
                                    >
                                      <RefreshCw
                                        size={12}
                                        className={
                                          syncingCourierOrderId === selectedOrder.id ? "adm-spin" : ""
                                        }
                                      />
                                      Sync Parcel
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="adm-btn adm-btn-xs adm-btn-secondary"
                                    onClick={() =>
                                      void copyTextValue(
                                        slipKey,
                                        formatSupplierPickupSlip(selectedOrder, pkg),
                                        "Supplier WhatsApp Pickup Slip",
                                      )
                                    }
                                  >
                                    {copiedKeyId === slipKey ? <Check size={12} /> : <Copy size={12} />}
                                    {copiedKeyId === slipKey
                                      ? "Slip Copied!"
                                      : "Copy Supplier Pickup Slip"}
                                  </button>
                                </div>
                              </div>
                            ) : selectedOrder.status !== "Cancelled" ? (
                              <div className="adm-shipment-dispatch-controls">
                                <div className="adm-form-row-3">
                                  <div className="adm-field">
                                    <label>Dispatch Via</label>
                                    <select
                                      className="adm-select-sm"
                                      value={selectedCourier}
                                      onChange={(e) =>
                                        updateShipmentDraft(selectedOrder.id, pkg.id, {
                                          courierProvider: e.target.value as
                                            | CourierProvider
                                            | "manual",
                                        })
                                      }
                                    >
                                      <option value="steadfast">Steadfast Courier API</option>
                                      <option value="pathao">Pathao Courier API</option>
                                      <option value="manual">Manual / Custom Tracking</option>
                                    </select>
                                  </div>
                                  <div className="adm-field">
                                    <label>Pickup Hub</label>
                                    <select
                                      className="adm-select-sm"
                                      value={selectedHubId}
                                      onChange={(e) => {
                                        const hubId = e.target.value;
                                        const chosen = pickupHubs.find((h) => h.id === hubId);
                                        updateShipmentDraft(selectedOrder.id, pkg.id, {
                                          pickupHubId: hubId,
                                          ...(chosen?.pathaoStoreId
                                            ? { pathaoStoreId: chosen.pathaoStoreId }
                                            : {}),
                                        });
                                      }}
                                    >
                                      {pickupHubs.map((hub) => (
                                        <option key={hub.id} value={hub.id}>
                                          {hub.name} ({hub.source === "supplier" ? "Supplier" : "Own"})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="adm-field">
                                    <label>COD Amount (৳)</label>
                                    <input
                                      type="number"
                                      min="0"
                                      className="adm-input-sm"
                                      value={codInputValue}
                                      onChange={(e) =>
                                        updateShipmentDraft(selectedOrder.id, pkg.id, {
                                          codAmount: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                </div>

                                <div className="adm-form-row-2" style={{ marginTop: 8 }}>
                                  {selectedCourier === "pathao" && (
                                    <div className="adm-field">
                                      <label>Pathao Store ID (Pickup Location)</label>
                                      {pathaoStores.length > 0 ? (
                                        <select
                                          className="adm-select-sm"
                                          value={selectedStoreId}
                                          onChange={(e) =>
                                            updateShipmentDraft(selectedOrder.id, pkg.id, {
                                              pathaoStoreId: e.target.value,
                                            })
                                          }
                                        >
                                          <option value="">Select Store ID…</option>
                                          {pathaoStores.map((st) => (
                                            <option key={st.storeId} value={String(st.storeId)}>
                                              #{st.storeId} · {st.storeName}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <input
                                          type="text"
                                          className="adm-input-sm"
                                          placeholder="Pathao Store ID"
                                          value={selectedStoreId}
                                          onChange={(e) =>
                                            updateShipmentDraft(selectedOrder.id, pkg.id, {
                                              pathaoStoreId: e.target.value,
                                            })
                                          }
                                        />
                                      )}
                                    </div>
                                  )}
                                  {selectedCourier === "manual" && (
                                    <div className="adm-field">
                                      <label>Manual Tracking / CN Number *</label>
                                      <input
                                        type="text"
                                        className="adm-input-sm"
                                        placeholder="e.g. SF-992014 or Rider CN"
                                        value={manualCodeValue}
                                        onChange={(e) =>
                                          updateShipmentDraft(selectedOrder.id, pkg.id, {
                                            manualTrackingCode: e.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                  )}
                                  <div className="adm-field">
                                    <label>Pickup / Courier Note (Optional)</label>
                                    <input
                                      type="text"
                                      className="adm-input-sm"
                                      placeholder="Supplier phone / pickup note"
                                      value={noteInputValue}
                                      onChange={(e) =>
                                        updateShipmentDraft(selectedOrder.id, pkg.id, {
                                          note: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                </div>

                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                                  <button
                                    type="button"
                                    className="adm-btn adm-btn-sm adm-btn-primary"
                                    onClick={() =>
                                      void handleDispatchCourier(selectedOrder, {
                                        shipment: pkg,
                                      })
                                    }
                                    disabled={dispatchingOrderId === selectedOrder.id}
                                  >
                                    <Send size={13} />{" "}
                                    {isThisDispatching
                                      ? "Dispatching…"
                                      : selectedCourier === "pathao"
                                        ? "Dispatch via Pathao"
                                        : selectedCourier === "manual"
                                          ? "Save Manual Tracking"
                                          : "Dispatch via Steadfast"}
                                  </button>
                                  <button
                                    type="button"
                                    className="adm-btn adm-btn-sm adm-btn-secondary"
                                    onClick={() =>
                                      void copyTextValue(
                                        slipKey,
                                        formatSupplierPickupSlip(selectedOrder, pkg),
                                        "Supplier WhatsApp Slip",
                                      )
                                    }
                                  >
                                    {copiedKeyId === slipKey ? <Check size={13} /> : <Copy size={13} />}
                                    {copiedKeyId === slipKey ? "Copied!" : "Copy Supplier Slip"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                                Order is cancelled.
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Fraud & Return Analysis Box */}
                    <div
                      style={{
                        marginTop: 12,
                        fontSize: 13,
                        background: "var(--bg)",
                        padding: 12,
                        borderRadius: 8,
                        border: "1px solid var(--line)",
                      }}
                    >
                      <strong>Customer Fraud &amp; Return Analysis:</strong>
                      <div style={{ marginTop: 6 }}>
                        {(() => {
                          const fraud = fraudResults[selectedOrder.customer.phone];
                          if (!fraud) {
                            return (
                              <span style={{ color: "var(--muted)" }}>
                                Click &quot;Fraud Check&quot; above to inspect this phone number across our store database and live courier delivery logs.
                              </span>
                            );
                          }
                          const riskColor =
                            fraud.riskLevel === "safe"
                              ? "#16a34a"
                              : fraud.riskLevel === "moderate"
                                ? "#d97706"
                                : "#dc2626";
                          return (
                            <div style={{ lineHeight: 1.6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span>Risk Level:</span>
                                <strong style={{ color: riskColor, textTransform: "uppercase" }}>
                                  {fraud.riskLevel} ({fraud.successRate}% delivery rate)
                                </strong>
                              </div>
                              <div>
                                This Store: <strong>{fraud.storeOrdersCount}</strong> orders ({fraud.storeDeliveredCount} delivered, {fraud.storeCancelledCount} cancelled)
                              </div>
                              <div>
                                Courier Parcels: <strong>{fraud.courierTotalOrders}</strong> nationwide ({fraud.courierSuccessOrders} delivered, {fraud.courierCancelledOrders} returned)
                              </div>
                              {fraud.notes && (
                                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                                  Note: {fraud.notes}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="adm-form-row-3">
                <div className="adm-field">
                  <label>Order Status</label>
                  <select
                    className="adm-select"
                    value={selectedOrder.status}
                    onChange={(e) =>
                      void handleUpdateOrder({
                        id: selectedOrder.id,
                        status: e.target.value as AdminOrderStatus,
                      })
                    }
                  >
                    {ORDER_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {formatAdminOrderStatusOption(st)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="adm-field">
                  <label>Payment Status</label>
                  <select
                    className="adm-select"
                    value={selectedOrder.paymentStatus}
                    onChange={(e) =>
                      void handleUpdateOrder({
                        id: selectedOrder.id,
                        paymentStatus: e.target.value as AdminPaymentStatus,
                      })
                    }
                  >
                    {PAYMENT_STATUSES.map((ps) => (
                      <option key={ps} value={ps}>
                        {ps}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="adm-field">
                  <label>Delivery Status</label>
                  <select
                    className="adm-select"
                    value={selectedOrder.deliveryStatus}
                    onChange={(e) =>
                      void handleUpdateOrder({
                        id: selectedOrder.id,
                        deliveryStatus: e.target.value as AdminDeliveryStatus,
                      })
                    }
                  >
                    {DELIVERY_STATUSES.map((ds) => (
                      <option key={ds} value={ds}>
                        {formatAdminDeliveryOption(ds)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 8,
                  paddingTop: 4,
                  fontSize: 12,
                  color: "var(--muted)",
                }}
              >
                <span>Customer View:</span>
                {(() => {
                  const custMeta = getCustomerFacingStatusMeta(selectedOrder);
                  const delMeta = getAdminDeliveryPillMeta(selectedOrder);
                  return (
                    <>
                      <span className={`adm-status-pill ${custMeta.pillClass}`}>
                        {custMeta.label}
                      </span>
                      <span className={`adm-status-pill ${delMeta.pillClass}`}>
                        Delivery: {delMeta.label}
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: RECORD MANUAL / POS ORDER ================= */}
      {showManualOrderModal && (
        <div className="adm-modal-backdrop" role="dialog" aria-modal="true" aria-label="Record manual order">
          <div className="adm-modal">
            <div className="adm-modal-head">
              <div>
                <h3>Record Customer Order</h3>
                <p className="adm-panel-sub">
                  Log a phone, WhatsApp, or test order directly into the database
                </p>
              </div>
              <button
                type="button"
                className="adm-icon-btn"
                onClick={() => setShowManualOrderModal(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <form className="adm-modal-body adm-form-stack" onSubmit={handleCreateManualOrder}>
              <div className="adm-form-row-2">
                <div className="adm-field">
                  <label htmlFor="man-name">Customer Name</label>
                  <input
                    id="man-name"
                    type="text"
                    className="adm-input"
                    placeholder="e.g. Ayesha Rahman"
                    value={manualCustomerName}
                    onChange={(e) => setManualCustomerName(e.target.value)}
                    required
                  />
                </div>
                <div className="adm-field">
                  <label htmlFor="man-phone">Phone Number</label>
                  <input
                    id="man-phone"
                    type="tel"
                    className="adm-input"
                    placeholder="017XXXXXXXX"
                    value={manualCustomerPhone}
                    onChange={(e) => setManualCustomerPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="adm-form-row-2">
                <div className="adm-field">
                  <label htmlFor="man-city">City</label>
                  <input
                    id="man-city"
                    type="text"
                    className="adm-input"
                    value={manualCustomerCity}
                    onChange={(e) => setManualCustomerCity(e.target.value)}
                    required
                  />
                </div>
                <div className="adm-field">
                  <label htmlFor="man-zone">Delivery Zone</label>
                  <select
                    id="man-zone"
                    className="adm-select"
                    value={manualZone}
                    onChange={(e) =>
                      setManualZone(e.target.value as "inside-dhaka" | "outside-dhaka")
                    }
                  >
                    <option value="inside-dhaka">
                      Inside Dhaka (৳{analytics.settings.insideDhakaShippingFee})
                    </option>
                    <option value="outside-dhaka">
                      Outside Dhaka (৳{analytics.settings.outsideDhakaShippingFee})
                    </option>
                  </select>
                </div>
              </div>

              <div className="adm-field">
                <label htmlFor="man-addr">Delivery Address</label>
                <input
                  id="man-addr"
                  type="text"
                  className="adm-input"
                  placeholder="House, Road, Area"
                  value={manualCustomerAddress}
                  onChange={(e) => setManualCustomerAddress(e.target.value)}
                  required
                />
              </div>

              <div className="adm-form-row-3">
                <div className="adm-field">
                  <label htmlFor="man-prod">Select Product</label>
                  <select
                    id="man-prod"
                    className="adm-select"
                    value={manualProductId}
                    onChange={(e) => setManualProductId(e.target.value)}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatPrice(p.price)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="adm-field">
                  <label htmlFor="man-qty">Quantity</label>
                  <input
                    id="man-qty"
                    type="number"
                    min="1"
                    className="adm-input"
                    value={manualQty}
                    onChange={(e) => setManualQty(e.target.value)}
                    required
                  />
                </div>
                <div className="adm-field">
                  <label htmlFor="man-pay">Payment Method</label>
                  <select
                    id="man-pay"
                    className="adm-select"
                    value={manualPaymentMethod}
                    onChange={(e) =>
                      setManualPaymentMethod(e.target.value as "cod" | "bkash" | "nagad")
                    }
                  >
                    <option value="cod">Cash on Delivery</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                  </select>
                </div>
              </div>

              {manualPaymentMethod !== "cod" && (
                <div className="adm-form-row-2">
                  <div className="adm-field">
                    <label htmlFor="man-pay-phone">
                      {manualPaymentMethod.toUpperCase()} Sender Number (Optional)
                    </label>
                    <input
                      id="man-pay-phone"
                      type="tel"
                      className="adm-input"
                      placeholder="01XXXXXXXXX"
                      value={manualPaymentPhone}
                      onChange={(e) => setManualPaymentPhone(e.target.value)}
                    />
                  </div>
                  <div className="adm-field">
                    <label htmlFor="man-pay-trx">
                      Transaction ID / TrxID (Optional)
                    </label>
                    <input
                      id="man-pay-trx"
                      type="text"
                      className="adm-input"
                      placeholder="e.g. BL729XK91M"
                      value={manualPaymentTrxId}
                      onChange={(e) => setManualPaymentTrxId(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
              )}

              <div className="adm-modal-actions">
                <button
                  type="submit"
                  className="adm-btn adm-btn-primary"
                  disabled={creatingManualOrder}
                >
                  {creatingManualOrder ? "Recording…" : "Confirm & Record Order"}
                </button>
                <button
                  type="button"
                  className="adm-btn adm-btn-secondary"
                  onClick={() => setShowManualOrderModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
