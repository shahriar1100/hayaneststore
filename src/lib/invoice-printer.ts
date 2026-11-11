import type { Order } from "@/lib/orders";
import type { AdminOrderRecord } from "@/lib/server/store-repository";

type StoreDetails = {
  storeName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactLocation?: string;
};

function escHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Opens a clean, print-optimized cash memo / invoice window and triggers window.print().
 * Designed for standard A4 paper, half-sheet, or POS parcel attachment.
 */
export function printOrderInvoice(order: Order | AdminOrderRecord, store?: StoreDetails): void {
  const printWindow = window.open("", "_blank", "width=850,height=900,menubar=no,toolbar=no");
  if (!printWindow) {
    alert("Please allow popups for this site to print order invoices.");
    return;
  }

  const storeName = store?.storeName || "HayaNest BD";
  const storePhone = store?.contactPhone || "+880 1700-000000";
  const storeEmail = store?.contactEmail || "support@hayanest.com";
  const storeLocation = store?.contactLocation || "Dhaka, Bangladesh";

  const orderDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleDateString("en-GB");

  const paymentMethodLabel =
    order.paymentMethod === "cod"
      ? "Cash on Delivery (COD)"
      : `${order.paymentMethod.toUpperCase()} (Manual Send Money)`;

  const resolvedPaymentStatus = order.paymentStatus || "Pending";
  const amountDueOrUnverified = resolvedPaymentStatus !== "Paid" ? order.total : 0;
  const shipments = Array.isArray(order.shipments) ? order.shipments : [];
  const hasSplitParcels = shipments.length > 1;
  const trackedSummary = shipments
    .filter((s) => Boolean(s.trackingCode || s.consignmentId))
    .map((s) => {
      const courierName =
        s.courierProvider === "pathao"
          ? "Pathao"
          : s.courierProvider === "manual"
            ? "Courier"
            : "Steadfast";
      return `${s.id} (${courierName}): ${s.trackingCode || s.consignmentId}`;
    })
    .join(" · ");
  const headerTrackingLine =
    trackedSummary ||
    (order.courierTrackingCode
      ? `${order.courierProvider ? `${order.courierProvider.toUpperCase()}: ` : ""}${order.courierTrackingCode}${
          order.courierConsignmentId && order.courierConsignmentId !== order.courierTrackingCode
            ? ` (CN: ${order.courierConsignmentId})`
            : ""
        }`
      : "");

  const itemsHtml = order.items
    .map(
      (item, idx) => `
      <tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">
          <strong style="color: #0f172a;">${escHtml(item.name)}</strong>
          ${item.colour ? `<div style="font-size: 11px; color: #64748b;">Colour: ${escHtml(item.colour)}</div>` : ""}
          ${
            item.fulfillmentSource === "supplier" || hasSplitParcels
              ? `<div style="font-size: 10.5px; color: ${item.fulfillmentSource === "supplier" ? "#b45309" : "#0f766e"}; font-weight: 600;">${
                  item.fulfillmentSource === "supplier"
                    ? `Supplier Hub${item.pickupHubName ? ` (${escHtml(item.pickupHubName)})` : ""}`
                    : `Own Stock${item.pickupHubName ? ` (${escHtml(item.pickupHubName)})` : ""}`
                }</div>`
              : ""
          }
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">৳${item.price}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">৳${item.price * item.quantity}</td>
      </tr>
    `,
    )
    .join("");

  const shipmentsHtml = hasSplitParcels
    ? `
      <div style="margin-bottom: 24px;">
        <div class="section-label" style="margin-bottom: 8px;">Parcel Split &amp; Dispatch Summary (${shipments.length} Parcels)</div>
        <table style="margin-bottom: 0;">
          <thead>
            <tr>
              <th style="text-align: left;">Parcel Ref</th>
              <th style="text-align: left;">Hub Source</th>
              <th style="text-align: left;">Courier / Tracking</th>
              <th style="text-align: left;">Items</th>
              <th style="text-align: right;">COD (৳)</th>
            </tr>
          </thead>
          <tbody>
            ${shipments
              .map((pkg) => {
                const courierLabel =
                  pkg.courierProvider === "pathao"
                    ? "Pathao"
                    : pkg.courierProvider === "manual"
                      ? "Manual"
                      : "Steadfast";
                const track = pkg.trackingCode || pkg.consignmentId || "Pending Dispatch";
                const pkgItems = pkg.items
                  .map((it) => `${it.quantity}× ${escHtml(it.name)}${it.colour ? ` (${escHtml(it.colour)})` : ""}`)
                  .join(", ");
                return `
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
                      <strong>${escHtml(pkg.id)}</strong>
                      ${pkg.invoiceRef ? `<div style="font-size: 10.5px; color: #64748b;">Ref: ${escHtml(pkg.invoiceRef)}</div>` : ""}
                    </td>
                    <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
                      <strong style="color: ${pkg.fulfillmentSource === "supplier" ? "#b45309" : "#0f766e"};">
                        ${pkg.fulfillmentSource === "supplier" ? "Supplier Hub" : "Own Stock"}
                      </strong>
                      ${pkg.pickupHubName ? `<div style="font-size: 11px; color: #64748b;">${escHtml(pkg.pickupHubName)}</div>` : ""}
                    </td>
                    <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px;">
                      <strong>${courierLabel}</strong>: ${escHtml(track)}
                      <div style="font-size: 10.5px; color: #64748b;">State: ${escHtml(pkg.deliveryStatus)}</div>
                    </td>
                    <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px;">${pkgItems}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">৳${pkg.codAmount}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `
    : "";

  const invoiceHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Invoice #${escHtml(order.id)} — ${escHtml(storeName)}</title>
      <style>
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff !important; }
          .no-print { display: none !important; }
          @page { margin: 12mm 15mm; size: auto; }
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          color: #0f172a;
          background: #f8fafc;
          margin: 0;
          padding: 24px;
        }
        .invoice-card {
          max-width: 780px;
          margin: 0 auto;
          background: #fff;
          border-radius: 12px;
          border: 1px solid #cbd5e1;
          padding: 36px 40px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 20px;
          margin-bottom: 24px;
        }
        .brand-title {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: 0.08em;
          margin: 0;
          color: #0f172a;
          font-family: Georgia, serif;
        }
        .brand-tagline {
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #64748b;
          margin-top: 4px;
        }
        .invoice-meta {
          text-align: right;
        }
        .invoice-title {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0;
        }
        .meta-text {
          font-size: 13px;
          color: #475569;
          margin-top: 4px;
        }
        .two-cols {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 16px 20px;
        }
        .section-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #64748b;
          margin-bottom: 6px;
        }
        .info-name {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .info-text {
          font-size: 13px;
          color: #334155;
          line-height: 1.5;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background: #0f172a;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 10px 8px;
        }
        .summary-box {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 28px;
        }
        .summary-table {
          width: 320px;
          border-collapse: collapse;
        }
        .summary-table td {
          padding: 6px 12px;
          font-size: 13px;
        }
        .summary-table .total-row td {
          border-top: 2px solid #0f172a;
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          padding-top: 10px;
        }
        .cod-badge {
          display: inline-block;
          background: #fef3c7;
          border: 1px solid #f59e0b;
          color: #92400e;
          font-size: 13px;
          font-weight: 700;
          padding: 8px 14px;
          border-radius: 8px;
          margin-top: 8px;
        }
        .footer-note {
          border-top: 1px dashed #cbd5e1;
          padding-top: 18px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          font-size: 12px;
          color: #64748b;
        }
        .signature-line {
          width: 180px;
          border-top: 1px solid #64748b;
          text-align: center;
          padding-top: 4px;
          font-size: 11px;
        }
        .print-btn-bar {
          text-align: center;
          margin-bottom: 16px;
        }
        .print-btn {
          background: #0f172a;
          color: #fff;
          border: none;
          padding: 10px 24px;
          font-size: 14px;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
        }
        .print-btn:hover { background: #334155; }
      </style>
    </head>
    <body>
      <div class="print-btn-bar no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Print Invoice / Packing Slip</button>
      </div>

      <div class="invoice-card">
        <div class="header">
          <div>
            <h1 class="brand-title">${escHtml(storeName)}</h1>
            <div class="brand-tagline">Everyday Elegance · Modest Wear</div>
            <div class="meta-text" style="margin-top: 8px;">
              ${escHtml(storeLocation)}<br>
              Phone: ${escHtml(storePhone)} · Email: ${escHtml(storeEmail)}
            </div>
          </div>
          <div class="invoice-meta">
            <h2 class="invoice-title">CASH MEMO</h2>
            <div class="meta-text"><strong>Invoice No:</strong> #${escHtml(order.id)}</div>
            <div class="meta-text"><strong>Date:</strong> ${escHtml(orderDate)}</div>
            <div class="meta-text"><strong>Payment:</strong> ${escHtml(paymentMethodLabel)}</div>
            ${headerTrackingLine ? `<div class="meta-text" style="color: #0284c7;"><strong>Tracking:</strong> ${escHtml(headerTrackingLine)}</div>` : ""}
          </div>
        </div>

        <div class="two-cols">
          <div>
            <div class="section-label">Deliver To / Customer</div>
            <div class="info-name">${escHtml(order.customer.name)}</div>
            <div class="info-text">
              <strong>Phone:</strong> ${escHtml(order.customer.phone)}<br>
              <strong>Address:</strong> ${escHtml(order.customer.address)}, ${escHtml(order.customer.city)}<br>
              ${order.customer.email ? `<strong>Email:</strong> ${escHtml(order.customer.email)}<br>` : ""}
              <strong>Zone:</strong> ${order.deliveryZone === "inside-dhaka" ? "Inside Dhaka" : "Outside Dhaka"}
            </div>
          </div>
          <div>
            <div class="section-label">Order & Parcel Notes</div>
            <div class="info-text">
              <strong>Order Status:</strong> ${escHtml(order.status)}<br>
              <strong>Payment Status:</strong> ${escHtml(resolvedPaymentStatus)}<br>
              ${order.courierProvider ? `<strong>Courier Provider:</strong> ${escHtml(order.courierProvider.toUpperCase())}<br>` : ""}
              ${order.courierConsignmentId ? `<strong>Consignment ID:</strong> ${escHtml(order.courierConsignmentId)}<br>` : ""}
              ${order.paymentPhone ? `<strong>Sender Number:</strong> ${escHtml(order.paymentPhone)}<br>` : ""}
              ${order.paymentTrxId ? `<strong>Transaction ID (TrxID):</strong> ${escHtml(order.paymentTrxId)}<br>` : ""}
              ${order.customer.notes ? `<strong>Customer Note:</strong> ${escHtml(order.customer.notes)}<br>` : ""}
              ${
                amountDueOrUnverified > 0
                  ? order.paymentMethod === "cod"
                    ? `<div class="cod-badge">💵 Cash to Collect: ৳${amountDueOrUnverified}</div>`
                    : `<div class="cod-badge">⏳ Payment Pending Verification: ৳${amountDueOrUnverified}</div>`
                  : `<div style="color: #16a34a; font-weight: 700; margin-top: 8px;">✅ Fully Paid (No cash to collect)</div>`
              }
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th style="text-align: left;">Item Description</th>
              <th style="width: 60px; text-align: center;">Qty</th>
              <th style="width: 100px; text-align: right;">Unit Price</th>
              <th style="width: 110px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="summary-box">
          <table class="summary-table">
            <tr>
              <td style="color: #64748b;">Subtotal:</td>
              <td style="text-align: right; font-weight: 600;">৳${order.subtotal}</td>
            </tr>
            ${
              order.discountAmount
                ? `<tr>
                <td style="color: #16a34a;">Discount ${order.couponCode ? `(${escHtml(order.couponCode)})` : ""}:</td>
                <td style="text-align: right; color: #16a34a; font-weight: 600;">-৳${order.discountAmount}</td>
              </tr>`
                : ""
            }
            <tr>
              <td style="color: #64748b;">Delivery Charge:</td>
              <td style="text-align: right; font-weight: 600;">৳${order.shippingFee}</td>
            </tr>
            <tr class="total-row">
              <td>Total Amount:</td>
              <td style="text-align: right;">৳${order.total}</td>
            </tr>
          </table>
        </div>

        ${shipmentsHtml}

        <div class="footer-note">
          <div>
            <strong>Terms & Policy:</strong><br>
            Please check the parcel in front of the delivery agent.<br>
            Thank you for being a valued customer of ${escHtml(storeName)}!
          </div>
          <div class="signature-line">
            Authorized Signature
          </div>
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 400);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(invoiceHtml);
  printWindow.document.close();
  printWindow.focus();
}
