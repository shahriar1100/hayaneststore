"use client";

import { useState } from "react";
import { formatPrice } from "@/data/store";
import type {
  CategoryPerformancePoint,
  DashboardAnalyticsResponse,
  TimeSeriesPoint,
} from "@/lib/server/analytics-engine";

const STATUS_COLORS: Record<string, string> = {
  Delivered: "#1b7f4b",
  Confirmed: "#2563eb",
  Processing: "#7c3aed",
  Shipped: "#0891b2",
  Pending: "#d97706",
  Cancelled: "#dc2626",
  Returned: "#ea580c",
  Refunded: "#be123c",
};

export function RevenueAnalyticsChart({
  charts,
}: {
  charts: DashboardAnalyticsResponse["charts"];
}) {
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly" | "yearly">(
    "daily",
  );
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const series: TimeSeriesPoint[] =
    granularity === "daily"
      ? charts.dailySeries
      : granularity === "weekly"
        ? charts.weeklySeries
        : granularity === "monthly"
          ? charts.monthlySeries
          : charts.yearlySeries;

  const maxVal = Math.max(
    1,
    ...series.map((p) => Math.max(p.revenue, p.previousRevenue)),
  );
  const totalCur = series.reduce((s, p) => s + p.revenue, 0);
  const totalPrev = series.reduce((s, p) => s + p.previousRevenue, 0);
  const hasAnyRevenue = series.some((p) => p.revenue > 0 || p.previousRevenue > 0);

  const width = 680;
  const height = 230;
  const padL = 52;
  const padR = 18;
  const padT = 18;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const getX = (idx: number) =>
    Math.round(
      (series.length <= 1 ? padL + plotW / 2 : padL + (idx / (series.length - 1)) * plotW) * 100,
    ) / 100;
  const getY = (val: number) =>
    Math.round((padT + plotH - (val / maxVal) * plotH) * 100) / 100;

  const currentPoints = series.map((p, idx) => `${getX(idx)},${getY(p.revenue)}`).join(" ");
  const prevPoints = series
    .map((p, idx) => `${getX(idx)},${getY(p.previousRevenue)}`)
    .join(" ");

  const areaPath =
    series.length > 0
      ? `M ${getX(0)},${padT + plotH} L ${currentPoints.replace(/ /g, " L ")} L ${getX(
          series.length - 1,
        )},${padT + plotH} Z`
      : "";

  const activePoint = hoverIdx !== null && series[hoverIdx] ? series[hoverIdx] : null;

  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <div>
          <h3>Revenue Analytics</h3>
          <p className="adm-panel-sub">
            Current period ({formatPrice(totalCur)}) vs previous equivalent period (
            {formatPrice(totalPrev)})
          </p>
        </div>
        <div className="adm-seg-group" role="group" aria-label="Revenue chart granularity">
          {(["daily", "weekly", "monthly", "yearly"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`adm-seg-btn ${granularity === mode ? "is-active" : ""}`}
              onClick={() => {
                setGranularity(mode);
                setHoverIdx(null);
              }}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {!hasAnyRevenue ? (
        <div className="adm-chart-empty">
          <p>No revenue recorded in this period (৳0).</p>
          <span>Place or record an order to visualize real-time revenue trends.</span>
        </div>
      ) : (
        <div className="adm-chart-wrap">
          {activePoint && (
            <div className="adm-chart-tooltip">
              <strong>{activePoint.key}</strong>
              <span>Current: {formatPrice(activePoint.revenue)}</span>
              <span>Previous: {formatPrice(activePoint.previousRevenue)}</span>
              <span>Orders: {activePoint.orders}</span>
            </div>
          )}
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="adm-svg-chart"
            role="img"
            aria-label="Revenue analytics area chart"
          >
            <defs>
              <linearGradient id="admRevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9d5930" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#9d5930" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padT + plotH * (1 - ratio);
              const val = Math.round(maxVal * ratio);
              return (
                <g key={ratio}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={width - padR}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.09"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padL - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="currentColor"
                    opacity="0.6"
                  >
                    ৳{val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                  </text>
                </g>
              );
            })}

            {areaPath && <path d={areaPath} fill="url(#admRevGrad)" />}

            {series.length > 1 && (
              <polyline
                fill="none"
                stroke="#8c827a"
                strokeWidth="1.75"
                strokeDasharray="4 4"
                points={prevPoints}
              />
            )}

            {series.length > 1 && (
              <polyline
                fill="none"
                stroke="#9d5930"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={currentPoints}
              />
            )}

            {series.map((p, idx) => {
              const cx = getX(idx);
              const cy = getY(p.revenue);
              const showLabel =
                series.length <= 8 ||
                idx === 0 ||
                idx === series.length - 1 ||
                idx % Math.ceil(series.length / 6) === 0;
              return (
                <g
                  key={p.key}
                  onMouseEnter={() => setHoverIdx(idx)}
                  onMouseLeave={() => setHoverIdx(null)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={cx - plotW / Math.max(2, series.length * 2)}
                    y={padT}
                    width={plotW / Math.max(1, series.length)}
                    height={plotH}
                    fill="transparent"
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={hoverIdx === idx ? 5 : 3}
                    fill="#9d5930"
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
                  {showLabel && (
                    <text
                      x={cx}
                      y={height - 10}
                      textAnchor="middle"
                      fontSize="10"
                      fill="currentColor"
                      opacity="0.65"
                    >
                      {p.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="adm-chart-legend">
            <span>
              <i className="adm-dot" style={{ background: "#9d5930" }} /> Current Period Revenue
            </span>
            <span>
              <i className="adm-dot" style={{ background: "#8c827a" }} /> Previous Period Baseline
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function SalesAnalyticsChart({
  charts,
}: {
  charts: DashboardAnalyticsResponse["charts"];
}) {
  const [metric, setMetric] = useState<"sales" | "orders" | "aov">("sales");
  const series = charts.dailySeries.slice(-14);
  const values = series.map((p) =>
    metric === "sales" ? p.sales : metric === "orders" ? p.orders : p.aov,
  );
  const maxVal = Math.max(1, ...values);
  const hasData = values.some((v) => v > 0);

  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <div>
          <h3>Sales &amp; Order Trends</h3>
          <p className="adm-panel-sub">
            Track gross product sales, order volume, and average order value over time
          </p>
        </div>
        <div className="adm-seg-group" role="group" aria-label="Sales metric selector">
          <button
            type="button"
            className={`adm-seg-btn ${metric === "sales" ? "is-active" : ""}`}
            onClick={() => setMetric("sales")}
          >
            Sales (৳)
          </button>
          <button
            type="button"
            className={`adm-seg-btn ${metric === "orders" ? "is-active" : ""}`}
            onClick={() => setMetric("orders")}
          >
            Orders
          </button>
          <button
            type="button"
            className={`adm-seg-btn ${metric === "aov" ? "is-active" : ""}`}
            onClick={() => setMetric("aov")}
          >
            AOV (৳)
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="adm-chart-empty">
          <p>No {metric === "orders" ? "orders" : "sales"} recorded in the selected window.</p>
          <span>Real order activity will populate this bar chart automatically.</span>
        </div>
      ) : (
        <div className="adm-bar-chart-grid">
          {series.map((p) => {
            const val = metric === "sales" ? p.sales : metric === "orders" ? p.orders : p.aov;
            const heightPct = Math.max(4, Math.round((val / maxVal) * 100));
            const formatted = metric === "orders" ? `${val} ord` : formatPrice(val);
            return (
              <div key={p.key} className="adm-bar-col" title={`${p.key}: ${formatted}`}>
                <div className="adm-bar-track">
                  <div
                    className="adm-bar-fill"
                    style={{ height: `${val === 0 ? 2 : heightPct}%` }}
                  />
                </div>
                <span className="adm-bar-label">{p.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function OrderStatusDonutChart({
  distribution,
}: {
  distribution: DashboardAnalyticsResponse["charts"]["orderStatusDistribution"];
}) {
  const activeSlices = distribution.filter((d) => d.count > 0);
  const totalOrders = activeSlices.reduce((s, d) => s + d.count, 0);

  const radius = 58;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <div>
          <h3>Order Status Distribution</h3>
          <p className="adm-panel-sub">Real-time breakdown of orders by fulfillment stage</p>
        </div>
      </div>

      {totalOrders === 0 ? (
        <div className="adm-chart-empty">
          <p>0 orders in selected date range.</p>
          <span>Status distribution will appear once orders are placed.</span>
        </div>
      ) : (
        <div className="adm-donut-layout">
          <div className="adm-donut-svg-wrap">
            <svg viewBox="0 0 160 160" className="adm-donut-svg" role="img" aria-label="Order status donut chart">
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke="currentColor"
                strokeOpacity="0.08"
                strokeWidth="20"
              />
              {activeSlices.map((slice, idx) => {
                const offsetPercent = activeSlices
                  .slice(0, idx)
                  .reduce((sum, prev) => sum + prev.percentage, 0);
                const dashLen = ((slice.percentage / 100) * circumference).toFixed(2);
                const totalCirc = circumference.toFixed(2);
                const strokeDasharray = `${dashLen} ${totalCirc}`;
                const strokeDashoffset = (-((offsetPercent / 100) * circumference)).toFixed(2);
                return (
                  <circle
                    key={slice.status}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="transparent"
                    stroke={STATUS_COLORS[slice.status] || "#9d5930"}
                    strokeWidth="20"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    transform="rotate(-90 80 80)"
                    aria-label={`${slice.status}: ${slice.count} orders (${slice.percentage}%)`}
                  />
                );
              })}
              <text x="80" y="76" textAnchor="middle" fontSize="20" fontWeight="700" fill="currentColor">
                {totalOrders}
              </text>
              <text x="80" y="94" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.65">
                Total Orders
              </text>
            </svg>
          </div>

          <div className="adm-donut-legend">
            {distribution.map((item) => (
              <div key={item.status} className="adm-donut-legend-row">
                <span className="adm-donut-legend-left">
                  <i
                    className="adm-dot"
                    style={{ background: STATUS_COLORS[item.status] || "#9d5930" }}
                  />
                  <span>{item.status}</span>
                </span>
                <span className="adm-donut-legend-right">
                  <strong>{item.count}</strong> ({item.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function CategoryPerformanceChart({
  categories,
}: {
  categories: CategoryPerformancePoint[];
}) {
  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <div>
          <h3>Product Category &amp; Fabric Performance</h3>
          <p className="adm-panel-sub">
            Dynamically aggregated from catalog &amp; eligible order items
          </p>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="adm-chart-empty">
          <p>No product categories found in catalog.</p>
        </div>
      ) : (
        <div className="adm-cat-list">
          {categories.map((cat) => (
            <div key={cat.key} className="adm-cat-item">
              <div className="adm-cat-row-top">
                <div>
                  <strong>{cat.name}</strong>
                  <span className="adm-cat-meta">
                    {cat.productCount} products · {cat.stockQuantity} in stock
                  </span>
                </div>
                <div className="adm-cat-stats">
                  <strong>{formatPrice(cat.revenue)}</strong>
                  <span>{cat.unitsSold} sold</span>
                </div>
              </div>
              <div className="adm-progress-track">
                <div
                  className="adm-progress-fill"
                  style={{ width: `${Math.max(4, Math.min(100, cat.sharePercent))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PaymentAnalyticsChart({
  paymentStatuses,
  paymentMethods,
}: {
  paymentStatuses: DashboardAnalyticsResponse["charts"]["paymentStatusBreakdown"];
  paymentMethods: DashboardAnalyticsResponse["charts"]["paymentMethodBreakdown"];
}) {
  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <div>
          <h3>Payment &amp; Method Analytics</h3>
          <p className="adm-panel-sub">
            Settlement status and revenue by payment channel (COD, bKash, Nagad)
          </p>
        </div>
      </div>

      <div className="adm-payment-split">
        <div>
          <h4 className="adm-subhead">By Payment Status</h4>
          <div className="adm-mini-stat-list">
            {paymentStatuses.map((ps) => (
              <div key={ps.status} className="adm-mini-stat-row">
                <span>{ps.status}</span>
                <span>
                  <strong>{ps.count}</strong> · {formatPrice(ps.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="adm-subhead">Revenue by Payment Method</h4>
          <div className="adm-cat-list">
            {paymentMethods.map((pm) => (
              <div key={pm.method} className="adm-cat-item">
                <div className="adm-cat-row-top">
                  <strong>{pm.label}</strong>
                  <span>
                    <strong>{formatPrice(pm.revenue)}</strong> ({pm.count} orders)
                  </span>
                </div>
                <div className="adm-progress-track">
                  <div
                    className="adm-progress-fill"
                    style={{ width: `${Math.max(3, pm.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CustomerAnalyticsChart({
  customersMetrics,
  series,
}: {
  customersMetrics: DashboardAnalyticsResponse["customersMetrics"];
  series: TimeSeriesPoint[];
}) {
  const recent = series.slice(-10);
  const maxCust = Math.max(
    1,
    ...recent.map((p) => p.newCustomers + p.returningCustomers),
  );

  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <div>
          <h3>Customer Acquisition &amp; Retention</h3>
          <p className="adm-panel-sub">
            New vs returning customers · Repeat rate: {customersMetrics.repeatCustomerRate}%
          </p>
        </div>
      </div>

      <div className="adm-cust-summary-pills">
        <div className="adm-cust-pill">
          <span>New in Period</span>
          <strong>{customersMetrics.newCustomersInPeriod}</strong>
        </div>
        <div className="adm-cust-pill">
          <span>Returning in Period</span>
          <strong>{customersMetrics.returningCustomersInPeriod}</strong>
        </div>
        <div className="adm-cust-pill">
          <span>Avg Customer Spend</span>
          <strong>{formatPrice(customersMetrics.averageCustomerOrderValue)}</strong>
        </div>
      </div>

      {customersMetrics.totalCustomers === 0 ? (
        <div className="adm-chart-empty">
          <p>No customer records yet.</p>
          <span>Customer acquisition and repeat purchase trends appear as orders arrive.</span>
        </div>
      ) : (
        <div className="adm-bar-chart-grid">
          {recent.map((p) => {
            const total = p.newCustomers + p.returningCustomers;
            const heightPct = Math.max(4, Math.round((total / maxCust) * 100));
            return (
              <div
                key={p.key}
                className="adm-bar-col"
                title={`${p.key}: ${p.newCustomers} new, ${p.returningCustomers} returning`}
              >
                <div className="adm-bar-track">
                  <div
                    className="adm-bar-fill"
                    style={{
                      height: `${total === 0 ? 2 : heightPct}%`,
                      background: p.returningCustomers > 0 ? "#2563eb" : "#9d5930",
                    }}
                  />
                </div>
                <span className="adm-bar-label">{p.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
