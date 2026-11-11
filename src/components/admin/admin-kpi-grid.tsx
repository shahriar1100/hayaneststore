"use client";

import { useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Ban,
  BarChart3,
  Box,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  DollarSign,
  Layers,
  Minus,
  Package,
  PackageCheck,
  PackageX,
  Percent,
  RefreshCcw,
  Repeat,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Tag,
  TrendingDown,
  TrendingUp,
  Truck,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { formatPrice } from "@/data/store";
import type { DashboardAnalyticsResponse, GrowthMetric } from "@/lib/server/analytics-engine";

type KpiCardItem = {
  id: string;
  group: "revenue" | "orders" | "customers" | "inventory";
  featured?: boolean;
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  growth?: GrowthMetric;
  tone?: "positive" | "negative" | "neutral" | "warning";
};

function renderGrowthBadge(growth?: GrowthMetric, fallbackTone?: KpiCardItem["tone"]) {
  if (!growth) {
    if (!fallbackTone) return null;
    return (
      <span className={`adm-kpi-badge is-${fallbackTone}`}>
        {fallbackTone === "positive"
          ? "Healthy"
          : fallbackTone === "warning"
            ? "Attention"
            : fallbackTone === "negative"
              ? "Alert"
              : "Stable"}
      </span>
    );
  }

  if (growth.value === null) {
    return (
      <span className="adm-kpi-badge is-neutral" title={growth.comparisonLabel}>
        <Minus size={11} aria-hidden="true" />
        {growth.current > 0 ? "New baseline" : "0%"}
      </span>
    );
  }

  const dir = growth.direction;
  return (
    <span
      className={`adm-kpi-badge is-${dir}`}
      title={`${growth.comparisonLabel}: ${growth.previous} -> ${growth.current}`}
    >
      {dir === "positive" ? (
        <ArrowUpRight size={12} aria-hidden="true" />
      ) : dir === "negative" ? (
        <ArrowDownRight size={12} aria-hidden="true" />
      ) : (
        <Minus size={11} aria-hidden="true" />
      )}
      {growth.value > 0 ? `+${growth.value}%` : `${growth.value}%`}
    </span>
  );
}

export function AdminKpiGrid({
  analytics,
  onConfigureCosts,
}: {
  analytics: DashboardAnalyticsResponse;
  onConfigureCosts?: () => void;
}) {
  const [activeGroup, setActiveGroup] = useState<
    "featured" | "revenue" | "orders" | "customers" | "inventory" | "all"
  >("featured");

  const { salesAndRevenue: sr, ordersMetrics: om, customersMetrics: cm, productsAndInventory: pi } =
    analytics;

  const grossProfitDisplay =
    sr.grossProfit !== null
      ? formatPrice(sr.grossProfit)
      : "Configure COGS";

  const grossMarginDisplay =
    sr.grossProfitMargin !== null
      ? `${sr.grossProfitMargin}%`
      : "Cost needed";

  const revenueGrowthValue =
    sr.revenueGrowth.value !== null
      ? `${sr.revenueGrowth.value > 0 ? "+" : ""}${sr.revenueGrowth.value}%`
      : sr.periodRevenue > 0
        ? "New (৳0 prior)"
        : "0%";

  const orderGrowthValue =
    om.orderGrowth.value !== null
      ? `${om.orderGrowth.value > 0 ? "+" : ""}${om.orderGrowth.value}%`
      : om.periodOrders > 0
        ? "New (0 prior)"
        : "0%";

  const customerGrowthValue =
    cm.customerGrowth.value !== null
      ? `${cm.customerGrowth.value > 0 ? "+" : ""}${cm.customerGrowth.value}%`
      : cm.newCustomersInPeriod > 0
        ? "New (0 prior)"
        : "0%";

  const cards: KpiCardItem[] = [
    // ================= 1. SALES & REVENUE (14 KPIs) =================
    {
      id: "total-revenue",
      group: "revenue",
      featured: true,
      title: "Total Revenue",
      value: formatPrice(sr.periodRevenue),
      subtitle: `All-time: ${formatPrice(sr.totalRevenue)} · Prev: ${formatPrice(sr.previousPeriodRevenue)}`,
      icon: <DollarSign size={18} />,
      growth: sr.revenueGrowth,
    },
    {
      id: "today-revenue",
      group: "revenue",
      featured: true,
      title: "Today's Revenue",
      value: formatPrice(sr.todayRevenue),
      subtitle: `Yesterday: ${formatPrice(sr.yesterdayRevenue)}`,
      icon: <Sparkles size={18} />,
      tone: sr.todayRevenue >= sr.yesterdayRevenue ? "positive" : "neutral",
    },
    {
      id: "yesterday-revenue",
      group: "revenue",
      title: "Yesterday's Revenue",
      value: formatPrice(sr.yesterdayRevenue),
      subtitle: "Completed 24h cycle",
      icon: <Clock size={18} />,
    },
    {
      id: "this-week-revenue",
      group: "revenue",
      title: "This Week's Revenue",
      value: formatPrice(sr.thisWeekRevenue),
      subtitle: "Current week to date",
      icon: <Calendar size={18} />,
    },
    {
      id: "this-month-revenue",
      group: "revenue",
      featured: true,
      title: "This Month's Revenue",
      value: formatPrice(sr.thisMonthRevenue),
      subtitle: `Prev month: ${formatPrice(sr.previousMonthRevenue)}`,
      icon: <TrendingUp size={18} />,
    },
    {
      id: "prev-month-revenue",
      group: "revenue",
      title: "Previous Month's Revenue",
      value: formatPrice(sr.previousMonthRevenue),
      subtitle: "Prior calendar month",
      icon: <BarChart3 size={18} />,
    },
    {
      id: "total-sales",
      group: "revenue",
      title: "Total Sales (Merchandise)",
      value: formatPrice(sr.periodSales),
      subtitle: `All-time subtotal: ${formatPrice(sr.totalSales)}`,
      icon: <ShoppingBag size={18} />,
    },
    {
      id: "aov",
      group: "revenue",
      featured: true,
      title: "Average Order Value",
      value: formatPrice(sr.averageOrderValue),
      subtitle: `Prior period AOV: ${formatPrice(sr.previousAverageOrderValue)}`,
      icon: <CreditCard size={18} />,
      growth: sr.aovGrowth,
    },
    {
      id: "revenue-growth",
      group: "revenue",
      title: "Revenue Growth %",
      value: revenueGrowthValue,
      subtitle: `${formatPrice(sr.periodRevenue)} vs ${formatPrice(sr.previousPeriodRevenue)}`,
      icon: <TrendingUp size={18} />,
      growth: sr.revenueGrowth,
    },
    {
      id: "discounts-given",
      group: "revenue",
      title: "Total Discounts Given",
      value: formatPrice(sr.periodDiscountsGiven),
      subtitle: `All-time markdowns & coupons: ${formatPrice(sr.totalDiscountsGiven)}`,
      icon: <Tag size={18} />,
    },
    {
      id: "refund-amount",
      group: "revenue",
      title: "Total Refund Amount",
      value: formatPrice(sr.periodRefundAmount),
      subtitle: `All-time refunds: ${formatPrice(sr.totalRefundAmount)}`,
      icon: <RotateCcw size={18} />,
      tone: sr.periodRefundAmount > 0 ? "warning" : "neutral",
    },
    {
      id: "net-revenue",
      group: "revenue",
      featured: true,
      title: "Net Revenue",
      value: formatPrice(sr.periodNetRevenue),
      subtitle: `After refunds · All-time: ${formatPrice(sr.netRevenue)}`,
      icon: <Wallet size={18} />,
    },
    {
      id: "gross-profit",
      group: "revenue",
      featured: true,
      title: "Gross Profit",
      value: grossProfitDisplay,
      subtitle:
        sr.costDataStatus === "unconfigured"
          ? "Set product costPrice in Inventory to calculate profit"
          : `COGS configured on ${sr.configuredCostProducts}/${sr.totalProductsCount} products`,
      icon: <Coins size={18} />,
      tone: sr.grossProfit !== null && sr.grossProfit > 0 ? "positive" : "neutral",
    },
    {
      id: "gross-profit-margin",
      group: "revenue",
      title: "Gross Profit Margin",
      value: grossMarginDisplay,
      subtitle:
        sr.grossProfitMargin !== null
          ? "(Gross Profit / Net Revenue) × 100"
          : "Requires product costPrice data",
      icon: <Percent size={18} />,
    },

    // ================= 2. ORDERS (12 KPIs) =================
    {
      id: "total-orders",
      group: "orders",
      featured: true,
      title: "Total Orders",
      value: String(om.periodOrders),
      subtitle: `All-time: ${om.totalOrders} · Prior period: ${om.previousPeriodOrders}`,
      icon: <ShoppingCart size={18} />,
      growth: om.orderGrowth,
    },
    {
      id: "today-orders",
      group: "orders",
      title: "Today's Orders",
      value: String(om.todayOrders),
      subtitle: `Yesterday: ${om.yesterdayOrders} orders`,
      icon: <Activity size={18} />,
    },
    {
      id: "yesterday-orders",
      group: "orders",
      title: "Yesterday's Orders",
      value: String(om.yesterdayOrders),
      subtitle: "Prior day order volume",
      icon: <Clock size={18} />,
    },
    {
      id: "pending-orders",
      group: "orders",
      featured: true,
      title: "Pending Orders",
      value: String(om.pendingOrders),
      subtitle: "Awaiting confirmation",
      icon: <AlertTriangle size={18} />,
      tone: om.pendingOrders > 0 ? "warning" : "neutral",
    },
    {
      id: "confirmed-orders",
      group: "orders",
      title: "Confirmed Orders",
      value: String(om.confirmedOrders),
      subtitle: "Verified & ready to pack",
      icon: <CheckCircle2 size={18} />,
    },
    {
      id: "processing-orders",
      group: "orders",
      title: "Processing Orders",
      value: String(om.processingOrders),
      subtitle: "Being prepared in warehouse",
      icon: <RefreshCcw size={18} />,
    },
    {
      id: "shipped-orders",
      group: "orders",
      title: "Shipped Orders",
      value: String(om.shippedOrders),
      subtitle: "Handed over to courier",
      icon: <Truck size={18} />,
    },
    {
      id: "delivered-orders",
      group: "orders",
      title: "Delivered Orders",
      value: String(om.deliveredOrders),
      subtitle: "Successfully completed",
      icon: <PackageCheck size={18} />,
      tone: om.deliveredOrders > 0 ? "positive" : "neutral",
    },
    {
      id: "cancelled-orders",
      group: "orders",
      title: "Cancelled Orders",
      value: String(om.cancelledOrders),
      subtitle: "Excluded from net sales",
      icon: <Ban size={18} />,
      tone: om.cancelledOrders > 0 ? "negative" : "neutral",
    },
    {
      id: "returned-orders",
      group: "orders",
      title: "Returned Orders",
      value: String(om.returnedOrders),
      subtitle: "Customer returns logged",
      icon: <RotateCcw size={18} />,
    },
    {
      id: "refunded-orders",
      group: "orders",
      title: "Refunded Orders",
      value: String(om.refundedOrders),
      subtitle: "Full or partial refund issued",
      icon: <TrendingDown size={18} />,
    },
    {
      id: "order-growth",
      group: "orders",
      title: "Order Growth %",
      value: orderGrowthValue,
      subtitle: `${om.periodOrders} vs ${om.previousPeriodOrders} prior period`,
      icon: <TrendingUp size={18} />,
      growth: om.orderGrowth,
    },

    // ================= 3. CUSTOMERS (7 KPIs) =================
    {
      id: "total-customers",
      group: "customers",
      featured: true,
      title: "Total Customers",
      value: String(cm.totalCustomers),
      subtitle: `Active in period: ${cm.periodCustomers}`,
      icon: <Users size={18} />,
      growth: cm.customerGrowth,
    },
    {
      id: "new-customers-today",
      group: "customers",
      title: "New Customers Today",
      value: String(cm.newCustomersToday),
      subtitle: "First-time buyers today",
      icon: <UserPlus size={18} />,
    },
    {
      id: "new-customers-month",
      group: "customers",
      title: "New Customers This Month",
      value: String(cm.newCustomersThisMonth),
      subtitle: `In selected period: ${cm.newCustomersInPeriod}`,
      icon: <UserPlus size={18} />,
    },
    {
      id: "returning-customers",
      group: "customers",
      title: "Returning Customers",
      value: String(cm.returningCustomers),
      subtitle: "Placed 2+ orders",
      icon: <UserCheck size={18} />,
    },
    {
      id: "repeat-customer-rate",
      group: "customers",
      featured: true,
      title: "Repeat Customer Rate",
      value: `${cm.repeatCustomerRate}%`,
      subtitle: `${cm.returningCustomers} of ${cm.totalCustomers} customers`,
      icon: <Repeat size={18} />,
      tone: cm.repeatCustomerRate >= 20 ? "positive" : "neutral",
    },
    {
      id: "avg-customer-order-val",
      group: "customers",
      title: "Avg Customer Spend",
      value: formatPrice(cm.averageCustomerOrderValue),
      subtitle: "Lifetime spend per customer",
      icon: <Wallet size={18} />,
    },
    {
      id: "customer-growth",
      group: "customers",
      title: "Customer Growth %",
      value: customerGrowthValue,
      subtitle: `${cm.newCustomersInPeriod} new vs ${cm.customerGrowth.previous} prior`,
      icon: <TrendingUp size={18} />,
      growth: cm.customerGrowth,
    },

    // ================= 4. PRODUCTS & INVENTORY (10 KPIs) =================
    {
      id: "total-products",
      group: "inventory",
      title: "Total Products",
      value: String(pi.totalProducts),
      subtitle: `${pi.activeProducts} active · ${pi.inactiveProducts} inactive`,
      icon: <Package size={18} />,
    },
    {
      id: "active-products",
      group: "inventory",
      title: "Active Products",
      value: String(pi.activeProducts),
      subtitle: "Visible on storefront",
      icon: <CheckCircle2 size={18} />,
    },
    {
      id: "inactive-products",
      group: "inventory",
      title: "Inactive Products",
      value: String(pi.inactiveProducts),
      subtitle: "Hidden from storefront",
      icon: <PackageX size={18} />,
    },
    {
      id: "total-units-sold",
      group: "inventory",
      featured: true,
      title: "Total Units Sold",
      value: String(pi.periodUnitsSold),
      subtitle: `All-time units sold: ${pi.totalUnitsSold}`,
      icon: <Layers size={18} />,
    },
    {
      id: "total-stock-qty",
      group: "inventory",
      title: "Total Stock Quantity",
      value: `${pi.totalStockQuantity.toLocaleString()} units`,
      subtitle: "Across all colour/size variants",
      icon: <Box size={18} />,
    },
    {
      id: "low-stock-products",
      group: "inventory",
      featured: true,
      title: "Low Stock Alerts",
      value: `${pi.lowStockVariantsCount} variants`,
      subtitle: `${pi.lowStockProductsCount} products near threshold`,
      icon: <AlertTriangle size={18} />,
      tone: pi.lowStockVariantsCount > 0 ? "warning" : "positive",
    },
    {
      id: "out-of-stock-products",
      group: "inventory",
      title: "Out of Stock",
      value: `${pi.outOfStockVariantsCount} variants`,
      subtitle: `${pi.outOfStockProductsCount} products completely out`,
      icon: <PackageX size={18} />,
      tone: pi.outOfStockVariantsCount > 0 ? "negative" : "positive",
    },
    {
      id: "best-selling-product",
      group: "inventory",
      title: "Best Selling Product",
      value: pi.bestSellingProduct ? pi.bestSellingProduct.name : "No sales yet",
      subtitle: pi.bestSellingProduct
        ? `${pi.bestSellingProduct.unitsSold} sold · ${formatPrice(pi.bestSellingProduct.revenue)}`
        : "Waiting for eligible orders",
      icon: <Award size={18} />,
    },
    {
      id: "slow-moving-products",
      group: "inventory",
      title: "Slow Moving Products",
      value: String(pi.slowMovingProductsCount),
      subtitle: "0 units sold in selected period",
      icon: <Clock size={18} />,
    },
    {
      id: "inventory-value",
      group: "inventory",
      featured: true,
      title: "Inventory Retail Value",
      value: formatPrice(pi.inventoryRetailValue),
      subtitle:
        pi.inventoryCostValue !== null
          ? `Cost value: ${formatPrice(pi.inventoryCostValue)}`
          : `${pi.totalStockQuantity} total units in stock`,
      icon: <DollarSign size={18} />,
    },
  ];

  const visibleCards =
    activeGroup === "all"
      ? cards
      : activeGroup === "featured"
        ? cards.filter((c) => c.featured)
        : cards.filter((c) => c.group === activeGroup);

  return (
    <section className="adm-kpi-section" aria-label="Business Key Performance Indicators">
      <div className="adm-kpi-filter-bar">
        <div className="adm-seg-group" role="tablist" aria-label="KPI Metric Categories">
          <button
            type="button"
            role="tab"
            aria-selected={activeGroup === "featured"}
            className={`adm-seg-btn ${activeGroup === "featured" ? "is-active" : ""}`}
            onClick={() => setActiveGroup("featured")}
          >
            Key Highlights (12)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeGroup === "revenue"}
            className={`adm-seg-btn ${activeGroup === "revenue" ? "is-active" : ""}`}
            onClick={() => setActiveGroup("revenue")}
          >
            Sales &amp; Revenue (14)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeGroup === "orders"}
            className={`adm-seg-btn ${activeGroup === "orders" ? "is-active" : ""}`}
            onClick={() => setActiveGroup("orders")}
          >
            Orders (12)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeGroup === "customers"}
            className={`adm-seg-btn ${activeGroup === "customers" ? "is-active" : ""}`}
            onClick={() => setActiveGroup("customers")}
          >
            Customers (7)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeGroup === "inventory"}
            className={`adm-seg-btn ${activeGroup === "inventory" ? "is-active" : ""}`}
            onClick={() => setActiveGroup("inventory")}
          >
            Products &amp; Inventory (10)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeGroup === "all"}
            className={`adm-seg-btn ${activeGroup === "all" ? "is-active" : ""}`}
            onClick={() => setActiveGroup("all")}
          >
            All 43 KPIs
          </button>
        </div>

        {sr.costDataStatus === "unconfigured" && onConfigureCosts && (
          <button type="button" className="adm-link-btn" onClick={onConfigureCosts}>
            Configure Product Cost Prices (COGS) →
          </button>
        )}
      </div>

      <div className="adm-kpi-grid">
        {visibleCards.map((card) => (
          <article key={card.id} className="adm-kpi-card">
            <div className="adm-kpi-top">
              <span className="adm-kpi-icon" aria-hidden="true">
                {card.icon}
              </span>
              {renderGrowthBadge(card.growth, card.tone)}
            </div>
            <div className="adm-kpi-body">
              <span className="adm-kpi-title">{card.title}</span>
              <strong className="adm-kpi-value" title={card.value}>
                {card.value}
              </strong>
              <span className="adm-kpi-sub">{card.subtitle}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
