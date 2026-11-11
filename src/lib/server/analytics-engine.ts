import type {
  AdminActivityRecord,
  AdminCouponRecord,
  AdminOrderRecord,
  AdminOrderStatus,
  AdminPaymentStatus,
  AdminProductRecord,
  AdminSettingsRecord,
} from "./store-repository";

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export type GrowthMetric = {
  value: number | null;
  current: number;
  previous: number;
  direction: "positive" | "negative" | "neutral";
  hasBaseline: boolean;
  comparisonLabel: string;
};

export type TimeSeriesPoint = {
  key: string;
  label: string;
  revenue: number;
  previousRevenue: number;
  sales: number;
  orders: number;
  aov: number;
  newCustomers: number;
  returningCustomers: number;
};

export type CategoryPerformancePoint = {
  key: string;
  name: string;
  category: string;
  fabric: string | null;
  productCount: number;
  unitsSold: number;
  revenue: number;
  stockQuantity: number;
  sharePercent: number;
};

export type BestSellingProductRow = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  category: string;
  fabric: string | null;
  colour: string;
  photo: { src: string; alt: string };
  price: number;
  unitsSold: number;
  revenue: number;
  currentStock: number;
  status: "active" | "inactive";
  performancePercent: number;
};

export type VariantInventoryRow = {
  variantKey: string;
  productId: string;
  productSlug: string;
  productName: string;
  category: string;
  fabric: string | null;
  size: string;
  colour: string;
  sku: string;
  price: number;
  costPrice: number | null;
  stock: number;
  lowStockThreshold: number;
  stockState: "in_stock" | "low_stock" | "out_of_stock";
  retailValue: number;
  lastRestockedAt: string | null;
  photo: { src: string; alt: string };
};

export type TopCustomerRow = {
  customerKey: string;
  name: string;
  phoneMasked: string;
  city: string;
  totalOrders: number;
  totalSpent: number;
  averageSpend: number;
  firstOrderDate: string;
  lastOrderDate: string;
  isReturning: boolean;
};

export type DashboardAnalyticsResponse = {
  meta: {
    preset: DateRangePreset;
    startDate: string;
    endDate: string;
    previousStartDate: string;
    previousEndDate: string;
    timezone: string;
    generatedAt: string;
  };
  salesAndRevenue: {
    totalRevenue: number;
    periodRevenue: number;
    previousPeriodRevenue: number;
    todayRevenue: number;
    yesterdayRevenue: number;
    thisWeekRevenue: number;
    thisMonthRevenue: number;
    previousMonthRevenue: number;
    totalSales: number;
    periodSales: number;
    averageOrderValue: number;
    previousAverageOrderValue: number;
    aovGrowth: GrowthMetric;
    revenueGrowth: GrowthMetric;
    totalDiscountsGiven: number;
    periodDiscountsGiven: number;
    totalRefundAmount: number;
    periodRefundAmount: number;
    netRevenue: number;
    periodNetRevenue: number;
    grossProfit: number | null;
    grossProfitMargin: number | null;
    costDataStatus: "configured" | "partial" | "unconfigured";
    configuredCostProducts: number;
    totalProductsCount: number;
  };
  ordersMetrics: {
    totalOrders: number;
    periodOrders: number;
    previousPeriodOrders: number;
    todayOrders: number;
    yesterdayOrders: number;
    pendingOrders: number;
    confirmedOrders: number;
    processingOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    returnedOrders: number;
    refundedOrders: number;
    orderGrowth: GrowthMetric;
  };
  customersMetrics: {
    totalCustomers: number;
    periodCustomers: number;
    newCustomersToday: number;
    newCustomersThisMonth: number;
    newCustomersInPeriod: number;
    returningCustomers: number;
    returningCustomersInPeriod: number;
    repeatCustomerRate: number;
    averageCustomerOrderValue: number;
    customerGrowth: GrowthMetric;
  };
  productsAndInventory: {
    totalProducts: number;
    activeProducts: number;
    inactiveProducts: number;
    totalUnitsSold: number;
    periodUnitsSold: number;
    totalStockQuantity: number;
    lowStockProductsCount: number;
    outOfStockProductsCount: number;
    lowStockVariantsCount: number;
    outOfStockVariantsCount: number;
    bestSellingProduct: {
      id: string;
      name: string;
      sku: string;
      unitsSold: number;
      revenue: number;
    } | null;
    slowMovingProductsCount: number;
    inventoryRetailValue: number;
    inventoryCostValue: number | null;
  };
  charts: {
    dailySeries: TimeSeriesPoint[];
    weeklySeries: TimeSeriesPoint[];
    monthlySeries: TimeSeriesPoint[];
    yearlySeries: TimeSeriesPoint[];
    orderStatusDistribution: {
      status: AdminOrderStatus;
      count: number;
      amount: number;
      percentage: number;
    }[];
    categoryPerformance: CategoryPerformancePoint[];
    paymentStatusBreakdown: {
      status: AdminPaymentStatus;
      count: number;
      amount: number;
      percentage: number;
    }[];
    paymentMethodBreakdown: {
      method: "cod" | "bkash" | "nagad";
      label: string;
      count: number;
      revenue: number;
      percentage: number;
    }[];
  };
  tables: {
    bestSellingProducts: BestSellingProductRow[];
    slowMovingProducts: BestSellingProductRow[];
    variantInventory: VariantInventoryRow[];
    lowStockAlerts: VariantInventoryRow[];
    outOfStockAlerts: VariantInventoryRow[];
    recentlyRestocked: VariantInventoryRow[];
    topCustomers: TopCustomerRow[];
    pendingAttentionOrders: AdminOrderRecord[];
  };
  settings: AdminSettingsRecord;
  coupons: AdminCouponRecord[];
  activities: AdminActivityRecord[];
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeGrowthMetric(
  current: number,
  previous: number,
  comparisonLabel = "vs previous period",
): GrowthMetric {
  const cur = round2(current);
  const prev = round2(previous);

  if (prev === 0 && cur === 0) {
    return {
      value: 0,
      current: cur,
      previous: prev,
      direction: "neutral",
      hasBaseline: true,
      comparisonLabel,
    };
  }

  if (prev === 0) {
    return {
      value: null,
      current: cur,
      previous: prev,
      direction: cur > 0 ? "positive" : "neutral",
      hasBaseline: false,
      comparisonLabel: `${comparisonLabel} (0 baseline)`,
    };
  }

  const pct = round2(((cur - prev) / prev) * 100);
  return {
    value: pct,
    current: cur,
    previous: prev,
    direction: pct > 0 ? "positive" : pct < 0 ? "negative" : "neutral",
    hasBaseline: true,
    comparisonLabel,
  };
}

function getTzParts(date: Date, timeZone: string): { year: number; month: number; day: number; dateStr: string } {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const dateStr = formatter.format(date);
    const [y, m, d] = dateStr.split("-").map(Number);
    return { year: y, month: m, day: d, dateStr };
  } catch {
    const iso = date.toISOString().slice(0, 10);
    const [y, m, d] = iso.split("-").map(Number);
    return { year: y, month: m, day: d, dateStr: iso };
  }
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function daysBetweenInclusive(startStr: string, endStr: string): number {
  const [sy, sm, sd] = startStr.split("-").map(Number);
  const [ey, em, ed] = endStr.split("-").map(Number);
  const diff = Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd);
  return Math.max(1, Math.round(diff / 86400000) + 1);
}

export function resolveDateWindows(options: {
  preset?: DateRangePreset;
  customStart?: string;
  customEnd?: string;
  timeZone?: string;
  now?: Date;
}) {
  const timeZone = options.timeZone || "Asia/Dhaka";
  const now = options.now ?? new Date();
  const todayParts = getTzParts(now, timeZone);
  const todayStr = todayParts.dateStr;
  const yesterdayStr = addDays(todayStr, -1);

  // Start of current week (Monday-based or 7-day rolling)
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(ty, tm - 1, td)).getUTCDay();
  const thisWeekStartStr = addDays(todayStr, -((dayOfWeek + 6) % 7));
  const thisMonthStartStr = `${todayStr.slice(0, 7)}-01`;

  const prevMonthDate = new Date(Date.UTC(ty, tm - 2, 1));
  const prevMonthEndDate = new Date(Date.UTC(ty, tm - 1, 0));
  const prevMonthStartStr = prevMonthDate.toISOString().slice(0, 10);
  const prevMonthEndStr = prevMonthEndDate.toISOString().slice(0, 10);

  const thisYearStartStr = `${ty}-01-01`;

  const preset: DateRangePreset = options.preset || "last_30_days";
  let startStr = addDays(todayStr, -29);
  let endStr = todayStr;
  let prevStartStr = addDays(startStr, -30);
  let prevEndStr = addDays(startStr, -1);

  switch (preset) {
    case "today":
      startStr = todayStr;
      endStr = todayStr;
      prevStartStr = yesterdayStr;
      prevEndStr = yesterdayStr;
      break;
    case "yesterday":
      startStr = yesterdayStr;
      endStr = yesterdayStr;
      prevStartStr = addDays(yesterdayStr, -1);
      prevEndStr = addDays(yesterdayStr, -1);
      break;
    case "last_7_days":
      startStr = addDays(todayStr, -6);
      endStr = todayStr;
      prevStartStr = addDays(startStr, -7);
      prevEndStr = addDays(startStr, -1);
      break;
    case "last_30_days":
      startStr = addDays(todayStr, -29);
      endStr = todayStr;
      prevStartStr = addDays(startStr, -30);
      prevEndStr = addDays(startStr, -1);
      break;
    case "this_month":
      startStr = thisMonthStartStr;
      endStr = todayStr;
      prevStartStr = prevMonthStartStr;
      prevEndStr = prevMonthEndStr;
      break;
    case "last_month": {
      startStr = prevMonthStartStr;
      endStr = prevMonthEndStr;
      const twoMonthsAgoStart = new Date(Date.UTC(ty, tm - 3, 1)).toISOString().slice(0, 10);
      const twoMonthsAgoEnd = new Date(Date.UTC(ty, tm - 2, 0)).toISOString().slice(0, 10);
      prevStartStr = twoMonthsAgoStart;
      prevEndStr = twoMonthsAgoEnd;
      break;
    }
    case "this_year":
      startStr = thisYearStartStr;
      endStr = todayStr;
      prevStartStr = `${ty - 1}-01-01`;
      prevEndStr = `${ty - 1}-12-31`;
      break;
    case "custom": {
      const s = options.customStart && /^\d{4}-\d{2}-\d{2}$/.test(options.customStart)
        ? options.customStart
        : addDays(todayStr, -29);
      const e = options.customEnd && /^\d{4}-\d{2}-\d{2}$/.test(options.customEnd)
        ? options.customEnd
        : todayStr;
      startStr = s <= e ? s : e;
      endStr = s <= e ? e : s;
      const span = daysBetweenInclusive(startStr, endStr);
      prevStartStr = addDays(startStr, -span);
      prevEndStr = addDays(startStr, -1);
      break;
    }
  }

  return {
    preset,
    timeZone,
    todayStr,
    yesterdayStr,
    thisWeekStartStr,
    thisMonthStartStr,
    prevMonthStartStr,
    prevMonthEndStr,
    startStr,
    endStr,
    prevStartStr,
    prevEndStr,
  };
}

function normalizeCustomerKey(order: AdminOrderRecord): string {
  const digits = (order.customer.phone || "").replace(/\D/g, "");
  if (digits.length >= 7) return `tel:${digits.slice(-11)}`;
  const email = (order.customer.email || "").trim().toLowerCase();
  if (email) return `mail:${email}`;
  return `name:${(order.customer.name || "guest").trim().toLowerCase()}`;
}

function maskPhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.length <= 6) return trimmed;
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-3)}`;
}

function isOrderEligible(order: AdminOrderRecord): boolean {
  return order.status !== "Cancelled" && order.paymentStatus !== "Failed";
}

function getOrderRefundAmount(order: AdminOrderRecord): number {
  if (order.refundAmount > 0) return round2(order.refundAmount);
  if (order.status === "Refunded" || order.status === "Returned" || order.paymentStatus === "Refunded") {
    return round2(order.total);
  }
  return 0;
}

export function buildDashboardAnalytics(input: {
  products: AdminProductRecord[];
  orders: AdminOrderRecord[];
  coupons: AdminCouponRecord[];
  settings: AdminSettingsRecord;
  activities: AdminActivityRecord[];
  preset?: DateRangePreset;
  customStart?: string;
  customEnd?: string;
  now?: Date;
}): DashboardAnalyticsResponse {
  const { products, orders, coupons, settings, activities } = input;
  const win = resolveDateWindows({
    preset: input.preset,
    customStart: input.customStart,
    customEnd: input.customEnd,
    timeZone: settings.timezone,
    now: input.now,
  });

  const productById = new Map<string, AdminProductRecord>();
  for (const p of products) {
    productById.set(p.id, p);
    productById.set(p.slug, p);
  }

  const orderWithDate = orders.map((order) => {
    const dt = new Date(order.createdAt);
    const tzDate = Number.isNaN(dt.getTime())
      ? win.todayStr
      : getTzParts(dt, win.timeZone).dateStr;
    return { order, dateStr: tzDate };
  });

  const inRange = (d: string, s: string, e: string) => d >= s && d <= e;

  const periodOrdersAll = orderWithDate
    .filter(({ dateStr }) => inRange(dateStr, win.startStr, win.endStr))
    .map(({ order }) => order);

  const prevPeriodOrdersAll = orderWithDate
    .filter(({ dateStr }) => inRange(dateStr, win.prevStartStr, win.prevEndStr))
    .map(({ order }) => order);

  const todayOrdersAll = orderWithDate
    .filter(({ dateStr }) => dateStr === win.todayStr)
    .map(({ order }) => order);

  const yesterdayOrdersAll = orderWithDate
    .filter(({ dateStr }) => dateStr === win.yesterdayStr)
    .map(({ order }) => order);

  const thisWeekOrdersAll = orderWithDate
    .filter(({ dateStr }) => inRange(dateStr, win.thisWeekStartStr, win.todayStr))
    .map(({ order }) => order);

  const thisMonthOrdersAll = orderWithDate
    .filter(({ dateStr }) => inRange(dateStr, win.thisMonthStartStr, win.todayStr))
    .map(({ order }) => order);

  const prevMonthOrdersAll = orderWithDate
    .filter(({ dateStr }) => inRange(dateStr, win.prevMonthStartStr, win.prevMonthEndStr))
    .map(({ order }) => order);

  function calculateFinancialWindow(windowOrders: AdminOrderRecord[]) {
    let grossRevenue = 0;
    let productSubtotal = 0;
    let discounts = 0;
    let refunds = 0;
    let eligibleCount = 0;
    let unitsSold = 0;
    let cogsTotal = 0;
    let unitsWithCost = 0;

    for (const order of windowOrders) {
      const refund = getOrderRefundAmount(order);
      refunds += refund;

      if (!isOrderEligible(order)) {
        continue;
      }

      eligibleCount += 1;
      grossRevenue += Number(order.total);
      productSubtotal += Number(order.subtotal);
      discounts += Number(order.discountAmount ?? 0);

      const isFullyReturnedOrRefunded =
        order.status === "Refunded" || order.status === "Returned" || refund >= order.total;

      for (const item of order.items) {
        const qty = Math.max(0, Number(item.quantity ?? 1));
        unitsSold += qty;

        const catalogProd = productById.get(item.id) ?? productById.get(item.slug);
        const origPrice = catalogProd?.originalPrice;
        if (origPrice && origPrice > item.price) {
          discounts += (origPrice - item.price) * qty;
        }

        if (!isFullyReturnedOrRefunded) {
          const unitCost = catalogProd?.costPrice;
          if (unitCost !== null && unitCost !== undefined) {
            cogsTotal += unitCost * qty;
            unitsWithCost += qty;
          }
        }
      }
    }

    const netRevenue = Math.max(0, round2(grossRevenue - refunds));
    const aov = eligibleCount > 0 ? round2(grossRevenue / eligibleCount) : 0;

    return {
      grossRevenue: round2(grossRevenue),
      productSubtotal: round2(productSubtotal),
      discounts: round2(discounts),
      refunds: round2(refunds),
      netRevenue,
      aov,
      eligibleCount,
      unitsSold,
      cogsTotal: round2(cogsTotal),
      unitsWithCost,
    };
  }

  const allTimeFin = calculateFinancialWindow(orders);
  const periodFin = calculateFinancialWindow(periodOrdersAll);
  const prevPeriodFin = calculateFinancialWindow(prevPeriodOrdersAll);
  const todayFin = calculateFinancialWindow(todayOrdersAll);
  const yesterdayFin = calculateFinancialWindow(yesterdayOrdersAll);
  const thisWeekFin = calculateFinancialWindow(thisWeekOrdersAll);
  const thisMonthFin = calculateFinancialWindow(thisMonthOrdersAll);
  const prevMonthFin = calculateFinancialWindow(prevMonthOrdersAll);

  // Cost / Gross Profit calculation rules
  const configuredCostProducts = products.filter(
    (p) => p.costPrice !== null && p.costPrice !== undefined,
  ).length;

  let costDataStatus: "configured" | "partial" | "unconfigured" = "unconfigured";
  if (configuredCostProducts === products.length && products.length > 0) {
    costDataStatus = "configured";
  } else if (configuredCostProducts > 0) {
    costDataStatus = "partial";
  }

  let grossProfit: number | null = null;
  let grossProfitMargin: number | null = null;

  if (configuredCostProducts > 0) {
    if (periodFin.unitsSold === 0) {
      grossProfit = 0;
      grossProfitMargin = 0;
    } else if (periodFin.unitsWithCost > 0) {
      grossProfit = round2(periodFin.netRevenue - periodFin.cogsTotal);
      grossProfitMargin =
        periodFin.netRevenue > 0 ? round2((grossProfit / periodFin.netRevenue) * 100) : 0;
    }
  }

  // Order status counts (for selected period; if all-time vs period is needed, use periodOrdersAll)
  const countByStatus = (list: AdminOrderRecord[], status: AdminOrderStatus) =>
    list.filter((o) => o.status === status).length;

  // Customers Analytics
  const customerMap = new Map<
    string,
    {
      key: string;
      name: string;
      phone: string;
      city: string;
      firstDate: string;
      lastDate: string;
      totalOrders: number;
      eligibleOrders: number;
      totalSpent: number;
      ordersInPeriod: number;
      ordersInPrevPeriod: number;
    }
  >();

  // Sort orders chronologically to find accurate firstOrderDate
  const sortedAsc = [...orderWithDate].sort((a, b) =>
    a.order.createdAt.localeCompare(b.order.createdAt),
  );

  for (const { order, dateStr } of sortedAsc) {
    const key = normalizeCustomerKey(order);
    const existing = customerMap.get(key);
    const eligible = isOrderEligible(order);
    const netOrderSpend = eligible ? Math.max(0, order.total - getOrderRefundAmount(order)) : 0;
    const isInPeriod = inRange(dateStr, win.startStr, win.endStr);
    const isInPrev = inRange(dateStr, win.prevStartStr, win.prevEndStr);

    if (!existing) {
      customerMap.set(key, {
        key,
        name: order.customer.name,
        phone: order.customer.phone,
        city: order.customer.city,
        firstDate: dateStr,
        lastDate: dateStr,
        totalOrders: 1,
        eligibleOrders: eligible ? 1 : 0,
        totalSpent: round2(netOrderSpend),
        ordersInPeriod: isInPeriod ? 1 : 0,
        ordersInPrevPeriod: isInPrev ? 1 : 0,
      });
    } else {
      existing.name = order.customer.name || existing.name;
      existing.city = order.customer.city || existing.city;
      if (dateStr < existing.firstDate) existing.firstDate = dateStr;
      if (dateStr > existing.lastDate) existing.lastDate = dateStr;
      existing.totalOrders += 1;
      if (eligible) existing.eligibleOrders += 1;
      existing.totalSpent = round2(existing.totalSpent + netOrderSpend);
      if (isInPeriod) existing.ordersInPeriod += 1;
      if (isInPrev) existing.ordersInPrevPeriod += 1;
    }
  }

  const allCustomers = Array.from(customerMap.values());
  const totalCustomers = allCustomers.length;
  const newCustomersToday = allCustomers.filter((c) => c.firstDate === win.todayStr).length;
  const newCustomersThisMonth = allCustomers.filter((c) =>
    inRange(c.firstDate, win.thisMonthStartStr, win.todayStr),
  ).length;
  const newCustomersInPeriod = allCustomers.filter((c) =>
    inRange(c.firstDate, win.startStr, win.endStr),
  ).length;
  const newCustomersInPrevPeriod = allCustomers.filter((c) =>
    inRange(c.firstDate, win.prevStartStr, win.prevEndStr),
  ).length;

  const returningCustomers = allCustomers.filter((c) => c.totalOrders >= 2).length;
  const periodCustomers = allCustomers.filter((c) => c.ordersInPeriod > 0).length;
  const returningCustomersInPeriod = allCustomers.filter(
    (c) => c.ordersInPeriod > 0 && c.totalOrders >= 2,
  ).length;

  const repeatCustomerRate =
    totalCustomers > 0 ? round2((returningCustomers / totalCustomers) * 100) : 0;
  const totalCustomerSpend = allCustomers.reduce((sum, c) => sum + c.totalSpent, 0);
  const averageCustomerOrderValue =
    totalCustomers > 0 ? round2(totalCustomerSpend / totalCustomers) : 0;

  const topCustomers: TopCustomerRow[] = [...allCustomers]
    .sort((a, b) => b.totalSpent - a.totalSpent || b.totalOrders - a.totalOrders)
    .slice(0, 10)
    .map((c) => ({
      customerKey: c.key,
      name: c.name,
      phoneMasked: maskPhone(c.phone),
      city: c.city,
      totalOrders: c.totalOrders,
      totalSpent: c.totalSpent,
      averageSpend: c.totalOrders > 0 ? round2(c.totalSpent / c.totalOrders) : 0,
      firstOrderDate: c.firstDate,
      lastOrderDate: c.lastDate,
      isReturning: c.totalOrders >= 2,
    }));

  // Product & Variant Inventory Analytics
  const activeProducts = products.filter((p) => p.status === "active").length;
  const inactiveProducts = products.filter((p) => p.status === "inactive").length;

  const variantInventory: VariantInventoryRow[] = [];
  let totalStockQuantity = 0;
  let inventoryRetailValue = 0;
  let inventoryCostValue = 0;

  for (const product of products) {
    const threshold = product.lowStockThreshold ?? settings.lowStockThreshold ?? 5;
    for (const variant of product.details.variants) {
      const vStock = Math.max(0, Number(variant.stock ?? 0));
      totalStockQuantity += vStock;
      const vRetail = round2(vStock * product.price);
      inventoryRetailValue = round2(inventoryRetailValue + vRetail);
      if (product.costPrice !== null && product.costPrice !== undefined) {
        inventoryCostValue = round2(inventoryCostValue + vStock * product.costPrice);
      }

      const stockState: "in_stock" | "low_stock" | "out_of_stock" =
        vStock === 0 ? "out_of_stock" : vStock <= threshold ? "low_stock" : "in_stock";

      const vSku = `${product.sku}-${variant.colour.slice(0, 3).toUpperCase()}`;
      variantInventory.push({
        variantKey: `${product.id}:${variant.colour}`,
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        category: product.category,
        fabric: product.fabric,
        size: product.details.size,
        colour: variant.colour,
        sku: vSku,
        price: product.price,
        costPrice: product.costPrice,
        stock: vStock,
        lowStockThreshold: threshold,
        stockState,
        retailValue: vRetail,
        lastRestockedAt: product.lastRestockedAt,
        photo: variant.gallery[0] ?? product.photo,
      });
    }
  }

  const lowStockProductsCount = products.filter((p) => {
    const th = p.lowStockThreshold ?? settings.lowStockThreshold ?? 5;
    return p.stock > 0 && p.stock <= th;
  }).length;

  const outOfStockProductsCount = products.filter((p) => p.stock === 0).length;
  const lowStockAlerts = variantInventory.filter((v) => v.stockState === "low_stock");
  const outOfStockAlerts = variantInventory.filter((v) => v.stockState === "out_of_stock");
  const recentlyRestocked = variantInventory
    .filter((v) => Boolean(v.lastRestockedAt))
    .sort((a, b) => (b.lastRestockedAt ?? "").localeCompare(a.lastRestockedAt ?? ""))
    .slice(0, 8);

  // Product Sales Performance in Selected Period
  const productSalesMap = new Map<string, { unitsSold: number; revenue: number }>();
  for (const order of periodOrdersAll) {
    if (!isOrderEligible(order)) continue;
    const refundRatio =
      order.total > 0 ? Math.min(1, getOrderRefundAmount(order) / order.total) : 0;
    if (refundRatio >= 1) continue;

    for (const item of order.items) {
      const prod = productById.get(item.id) ?? productById.get(item.slug);
      const pid = prod?.id ?? item.id;
      const qty = Math.max(0, Number(item.quantity ?? 1));
      const rev = round2(item.price * qty * (1 - refundRatio));
      const curr = productSalesMap.get(pid) ?? { unitsSold: 0, revenue: 0 };
      curr.unitsSold += qty;
      curr.revenue = round2(curr.revenue + rev);
      productSalesMap.set(pid, curr);
    }
  }

  const maxUnitsSold = Math.max(
    1,
    ...Array.from(productSalesMap.values()).map((v) => v.unitsSold),
  );

  const allProductPerformance: BestSellingProductRow[] = products.map((product) => {
    const stats = productSalesMap.get(product.id) ?? { unitsSold: 0, revenue: 0 };
    return {
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      name: product.name,
      category: product.category,
      fabric: product.fabric,
      colour: product.colour,
      photo: product.photo,
      price: product.price,
      unitsSold: stats.unitsSold,
      revenue: stats.revenue,
      currentStock: product.stock,
      status: product.status,
      performancePercent:
        stats.unitsSold > 0 ? Math.round((stats.unitsSold / maxUnitsSold) * 100) : 0,
    };
  });

  const bestSellingProducts = [...allProductPerformance]
    .filter((p) => p.unitsSold > 0)
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue);

  const slowMovingProducts = allProductPerformance
    .filter((p) => p.status === "active" && p.unitsSold === 0)
    .sort((a, b) => b.currentStock - a.currentStock);

  const topSeller = bestSellingProducts[0]
    ? {
        id: bestSellingProducts[0].id,
        name: bestSellingProducts[0].name,
        sku: bestSellingProducts[0].sku,
        unitsSold: bestSellingProducts[0].unitsSold,
        revenue: bestSellingProducts[0].revenue,
      }
    : null;

  // Dynamic Category & Fabric Performance (Never hardcoded!)
  const categoryGroupMap = new Map<
    string,
    {
      key: string;
      name: string;
      category: string;
      fabric: string | null;
      productCount: number;
      unitsSold: number;
      revenue: number;
      stockQuantity: number;
    }
  >();

  for (const product of products) {
    const key = product.fabric ? `${product.category}:${product.fabric}` : product.category;
    const label = product.fabric
      ? `${product.fabric.charAt(0).toUpperCase() + product.fabric.slice(1)} Hijab`
      : `${product.category.charAt(0).toUpperCase() + product.category.slice(1)}`;
    const stats = productSalesMap.get(product.id) ?? { unitsSold: 0, revenue: 0 };
    const existing = categoryGroupMap.get(key);
    if (!existing) {
      categoryGroupMap.set(key, {
        key,
        name: label,
        category: product.category,
        fabric: product.fabric,
        productCount: 1,
        unitsSold: stats.unitsSold,
        revenue: stats.revenue,
        stockQuantity: product.stock,
      });
    } else {
      existing.productCount += 1;
      existing.unitsSold += stats.unitsSold;
      existing.revenue = round2(existing.revenue + stats.revenue);
      existing.stockQuantity += product.stock;
    }
  }

  const totalCatRevenue = Array.from(categoryGroupMap.values()).reduce(
    (s, c) => s + c.revenue,
    0,
  );
  const totalCatStock = Math.max(
    1,
    Array.from(categoryGroupMap.values()).reduce((s, c) => s + c.stockQuantity, 0),
  );

  const categoryPerformance: CategoryPerformancePoint[] = Array.from(
    categoryGroupMap.values(),
  )
    .map((c) => ({
      ...c,
      sharePercent:
        totalCatRevenue > 0
          ? round2((c.revenue / totalCatRevenue) * 100)
          : round2((c.stockQuantity / totalCatStock) * 100),
    }))
    .sort((a, b) => b.revenue - a.revenue || b.stockQuantity - a.stockQuantity);

  // Order Status Distribution
  const allStatuses: AdminOrderStatus[] = [
    "Pending",
    "Confirmed",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancelled",
    "Returned",
    "Refunded",
  ];

  const totalPeriodOrderCount = periodOrdersAll.length;
  const orderStatusDistribution = allStatuses.map((st) => {
    const matched = periodOrdersAll.filter((o) => o.status === st);
    const amount = round2(matched.reduce((sum, o) => sum + o.total, 0));
    return {
      status: st,
      count: matched.length,
      amount,
      percentage:
        totalPeriodOrderCount > 0 ? round2((matched.length / totalPeriodOrderCount) * 100) : 0,
    };
  });

  // Payment Status & Method Breakdown
  const paymentStatuses: AdminPaymentStatus[] = [
    "Paid",
    "Pending",
    "Failed",
    "Refunded",
    "Partially Refunded",
  ];
  const paymentStatusBreakdown = paymentStatuses.map((ps) => {
    const matched = periodOrdersAll.filter((o) => o.paymentStatus === ps);
    const amount = round2(matched.reduce((sum, o) => sum + o.total, 0));
    return {
      status: ps,
      count: matched.length,
      amount,
      percentage:
        totalPeriodOrderCount > 0 ? round2((matched.length / totalPeriodOrderCount) * 100) : 0,
    };
  });

  const methodDefs: { method: "cod" | "bkash" | "nagad"; label: string }[] = [
    { method: "cod", label: "Cash on Delivery (COD)" },
    { method: "bkash", label: "bKash Mobile Banking" },
    { method: "nagad", label: "Nagad Mobile Banking" },
  ];

  const paymentMethodBreakdown = methodDefs.map(({ method, label }) => {
    const matched = periodOrdersAll.filter(
      (o) => o.paymentMethod === method && isOrderEligible(o),
    );
    const revenue = round2(matched.reduce((sum, o) => sum + o.total, 0));
    return {
      method,
      label,
      count: matched.length,
      revenue,
      percentage:
        periodFin.grossRevenue > 0 ? round2((revenue / periodFin.grossRevenue) * 100) : 0,
    };
  });

  // Time Series Builders (Daily, Weekly, Monthly, Yearly)
  const spanDays = Math.min(90, daysBetweenInclusive(win.startStr, win.endStr));
  const dailySeries: TimeSeriesPoint[] = [];
  for (let i = 0; i < spanDays; i++) {
    const curDate = addDays(win.endStr, -(spanDays - 1 - i));
    const prevDate = addDays(curDate, -spanDays);

    const curOrders = orderWithDate
      .filter(({ dateStr }) => dateStr === curDate)
      .map(({ order }) => order);
    const prevOrders = orderWithDate
      .filter(({ dateStr }) => dateStr === prevDate)
      .map(({ order }) => order);

    const curF = calculateFinancialWindow(curOrders);
    const prevF = calculateFinancialWindow(prevOrders);

    const newCust = allCustomers.filter((c) => c.firstDate === curDate).length;
    const activeCustKeys = new Set(curOrders.map(normalizeCustomerKey));
    const retCust = Array.from(activeCustKeys).filter((k) => {
      const c = customerMap.get(k);
      return c && c.firstDate < curDate;
    }).length;

    dailySeries.push({
      key: curDate,
      label: curDate.slice(5), // MM-DD
      revenue: curF.grossRevenue,
      previousRevenue: prevF.grossRevenue,
      sales: curF.productSubtotal,
      orders: curOrders.length,
      aov: curF.aov,
      newCustomers: newCust,
      returningCustomers: retCust,
    });
  }

  // Weekly Series (Last 8 weeks)
  const weeklySeries: TimeSeriesPoint[] = [];
  for (let w = 7; w >= 0; w--) {
    const wEnd = addDays(win.endStr, -w * 7);
    const wStart = addDays(wEnd, -6);
    const prevWEnd = addDays(wStart, -1);
    const prevWStart = addDays(prevWEnd, -6);

    const wOrders = orderWithDate
      .filter(({ dateStr }) => inRange(dateStr, wStart, wEnd))
      .map(({ order }) => order);
    const prevWOrders = orderWithDate
      .filter(({ dateStr }) => inRange(dateStr, prevWStart, prevWEnd))
      .map(({ order }) => order);

    const wF = calculateFinancialWindow(wOrders);
    const prevWF = calculateFinancialWindow(prevWOrders);
    const newCust = allCustomers.filter((c) => inRange(c.firstDate, wStart, wEnd)).length;
    const activeKeys = new Set(wOrders.map(normalizeCustomerKey));
    const retCust = Array.from(activeKeys).filter((k) => {
      const c = customerMap.get(k);
      return c && c.firstDate < wStart;
    }).length;

    weeklySeries.push({
      key: `${wStart}..${wEnd}`,
      label: `${wStart.slice(5)}–${wEnd.slice(5)}`,
      revenue: wF.grossRevenue,
      previousRevenue: prevWF.grossRevenue,
      sales: wF.productSubtotal,
      orders: wOrders.length,
      aov: wF.aov,
      newCustomers: newCust,
      returningCustomers: retCust,
    });
  }

  // Monthly Series (Last 6 months)
  const [ey, em] = win.endStr.split("-").map(Number);
  const monthlySeries: TimeSeriesPoint[] = [];
  for (let m = 5; m >= 0; m--) {
    const mDate = new Date(Date.UTC(ey, em - 1 - m, 1));
    const mPrefix = mDate.toISOString().slice(0, 7);
    const prevMDate = new Date(Date.UTC(ey, em - 2 - m, 1));
    const prevMPrefix = prevMDate.toISOString().slice(0, 7);

    const mOrders = orderWithDate
      .filter(({ dateStr }) => dateStr.startsWith(mPrefix))
      .map(({ order }) => order);
    const prevMOrders = orderWithDate
      .filter(({ dateStr }) => dateStr.startsWith(prevMPrefix))
      .map(({ order }) => order);

    const mF = calculateFinancialWindow(mOrders);
    const prevMF = calculateFinancialWindow(prevMOrders);
    const newCust = allCustomers.filter((c) => c.firstDate.startsWith(mPrefix)).length;
    const activeKeys = new Set(mOrders.map(normalizeCustomerKey));
    const retCust = Array.from(activeKeys).filter((k) => {
      const c = customerMap.get(k);
      return c && c.firstDate < `${mPrefix}-01`;
    }).length;

    monthlySeries.push({
      key: mPrefix,
      label: mPrefix,
      revenue: mF.grossRevenue,
      previousRevenue: prevMF.grossRevenue,
      sales: mF.productSubtotal,
      orders: mOrders.length,
      aov: mF.aov,
      newCustomers: newCust,
      returningCustomers: retCust,
    });
  }

  // Yearly Series (Last 3 years)
  const yearlySeries: TimeSeriesPoint[] = [];
  for (let yOffset = 2; yOffset >= 0; yOffset--) {
    const yStr = String(ey - yOffset);
    const prevYStr = String(ey - yOffset - 1);
    const yOrders = orderWithDate
      .filter(({ dateStr }) => dateStr.startsWith(yStr))
      .map(({ order }) => order);
    const prevYOrders = orderWithDate
      .filter(({ dateStr }) => dateStr.startsWith(prevYStr))
      .map(({ order }) => order);

    const yF = calculateFinancialWindow(yOrders);
    const prevYF = calculateFinancialWindow(prevYOrders);
    const newCust = allCustomers.filter((c) => c.firstDate.startsWith(yStr)).length;
    const activeKeys = new Set(yOrders.map(normalizeCustomerKey));
    const retCust = Array.from(activeKeys).filter((k) => {
      const c = customerMap.get(k);
      return c && c.firstDate < `${yStr}-01-01`;
    }).length;

    yearlySeries.push({
      key: yStr,
      label: yStr,
      revenue: yF.grossRevenue,
      previousRevenue: prevYF.grossRevenue,
      sales: yF.productSubtotal,
      orders: yOrders.length,
      aov: yF.aov,
      newCustomers: newCust,
      returningCustomers: retCust,
    });
  }

  const pendingAttentionOrders = orders
    .filter((o) => o.status === "Pending" || o.status === "Confirmed" || o.status === "Processing")
    .slice(0, 8);

  return {
    meta: {
      preset: win.preset,
      startDate: win.startStr,
      endDate: win.endStr,
      previousStartDate: win.prevStartStr,
      previousEndDate: win.prevEndStr,
      timezone: win.timeZone,
      generatedAt: new Date().toISOString(),
    },
    salesAndRevenue: {
      totalRevenue: allTimeFin.grossRevenue,
      periodRevenue: periodFin.grossRevenue,
      previousPeriodRevenue: prevPeriodFin.grossRevenue,
      todayRevenue: todayFin.grossRevenue,
      yesterdayRevenue: yesterdayFin.grossRevenue,
      thisWeekRevenue: thisWeekFin.grossRevenue,
      thisMonthRevenue: thisMonthFin.grossRevenue,
      previousMonthRevenue: prevMonthFin.grossRevenue,
      totalSales: allTimeFin.productSubtotal,
      periodSales: periodFin.productSubtotal,
      averageOrderValue: periodFin.aov,
      previousAverageOrderValue: prevPeriodFin.aov,
      aovGrowth: computeGrowthMetric(periodFin.aov, prevPeriodFin.aov, "vs prior period"),
      revenueGrowth: computeGrowthMetric(
        periodFin.grossRevenue,
        prevPeriodFin.grossRevenue,
        `${win.prevStartStr} to ${win.prevEndStr}`,
      ),
      totalDiscountsGiven: allTimeFin.discounts,
      periodDiscountsGiven: periodFin.discounts,
      totalRefundAmount: allTimeFin.refunds,
      periodRefundAmount: periodFin.refunds,
      netRevenue: allTimeFin.netRevenue,
      periodNetRevenue: periodFin.netRevenue,
      grossProfit,
      grossProfitMargin,
      costDataStatus,
      configuredCostProducts,
      totalProductsCount: products.length,
    },
    ordersMetrics: {
      totalOrders: orders.length,
      periodOrders: periodOrdersAll.length,
      previousPeriodOrders: prevPeriodOrdersAll.length,
      todayOrders: todayOrdersAll.length,
      yesterdayOrders: yesterdayOrdersAll.length,
      pendingOrders: countByStatus(periodOrdersAll, "Pending"),
      confirmedOrders: countByStatus(periodOrdersAll, "Confirmed"),
      processingOrders: countByStatus(periodOrdersAll, "Processing"),
      shippedOrders: countByStatus(periodOrdersAll, "Shipped"),
      deliveredOrders: countByStatus(periodOrdersAll, "Delivered"),
      cancelledOrders: countByStatus(periodOrdersAll, "Cancelled"),
      returnedOrders: countByStatus(periodOrdersAll, "Returned"),
      refundedOrders: countByStatus(periodOrdersAll, "Refunded"),
      orderGrowth: computeGrowthMetric(
        periodOrdersAll.length,
        prevPeriodOrdersAll.length,
        `${win.prevStartStr} to ${win.prevEndStr}`,
      ),
    },
    customersMetrics: {
      totalCustomers,
      periodCustomers,
      newCustomersToday,
      newCustomersThisMonth,
      newCustomersInPeriod,
      returningCustomers,
      returningCustomersInPeriod,
      repeatCustomerRate,
      averageCustomerOrderValue,
      customerGrowth: computeGrowthMetric(
        newCustomersInPeriod,
        newCustomersInPrevPeriod,
        "vs prior period",
      ),
    },
    productsAndInventory: {
      totalProducts: products.length,
      activeProducts,
      inactiveProducts,
      totalUnitsSold: allTimeFin.unitsSold,
      periodUnitsSold: periodFin.unitsSold,
      totalStockQuantity,
      lowStockProductsCount,
      outOfStockProductsCount,
      lowStockVariantsCount: lowStockAlerts.length,
      outOfStockVariantsCount: outOfStockAlerts.length,
      bestSellingProduct: topSeller,
      slowMovingProductsCount: slowMovingProducts.length,
      inventoryRetailValue,
      inventoryCostValue: configuredCostProducts > 0 ? inventoryCostValue : null,
    },
    charts: {
      dailySeries,
      weeklySeries,
      monthlySeries,
      yearlySeries,
      orderStatusDistribution,
      categoryPerformance,
      paymentStatusBreakdown,
      paymentMethodBreakdown,
    },
    tables: {
      bestSellingProducts,
      slowMovingProducts,
      variantInventory,
      lowStockAlerts,
      outOfStockAlerts,
      recentlyRestocked,
      topCustomers,
      pendingAttentionOrders,
    },
    settings,
    coupons,
    activities,
  };
}
