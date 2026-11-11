import type { Metadata } from "next";
import { Clock, MapPin, PackageCheck, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import { InfoPageLayout } from "@/components/info/info-page-layout";
import { getStoreSettings } from "@/lib/server/store-repository";
import { formatPrice } from "@/data/store";

export const metadata: Metadata = {
  title: "Shipping, Delivery & Returns — HayaNest BD",
  description:
    "Nationwide delivery across Bangladesh, Inside & Outside Dhaka shipping rates, Cash on Delivery, and 7-day easy returns.",
};

export default async function ShippingReturnsPage() {
  const settings = await getStoreSettings();

  return (
    <InfoPageLayout
      eyebrow="Delivery & Exchanges"
      title="Shipping & Returns"
      subtitle="Fast, carefully packaged delivery across Bangladesh with Cash on Delivery, mobile banking support, and a hassle-free 7-day exchange policy."
      currentPath="/shipping-returns"
    >
      {/* Shipping Zones */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 18,
        }}
      >
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--accent)",
              }}
            >
              <Truck size={16} /> Inside Dhaka Metro
            </span>
            <strong
              style={{
                fontSize: 22,
                fontFamily: "var(--font-display), Georgia, serif",
                color: "var(--ink)",
              }}
            >
              {formatPrice(settings.insideDhakaShippingFee)}
            </strong>
          </div>
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 20,
              margin: "12px 0 8px",
            }}
          >
            Express City Delivery (1–2 Business Days)
          </h2>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: "var(--muted)" }}>
            Orders placed before 4:00 PM are dispatched the same day via dedicated Dhaka courier
            partners. Cash on Delivery (COD), bKash, and Nagad are accepted at checkout.
          </p>
        </div>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--accent)",
              }}
            >
              <MapPin size={16} /> Outside Dhaka (Nationwide)
            </span>
            <strong
              style={{
                fontSize: 22,
                fontFamily: "var(--font-display), Georgia, serif",
                color: "var(--ink)",
              }}
            >
              {formatPrice(settings.outsideDhakaShippingFee)}
            </strong>
          </div>
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 20,
              margin: "12px 0 8px",
            }}
          >
            All 64 Districts (3–5 Business Days)
          </h2>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: "var(--muted)" }}>
            Doorstep home delivery across Chattogram, Sylhet, Rajshahi, Khulna, Barishal, Rangpur,
            Mymensingh, and all sub-districts with full SMS and account tracking.
          </p>
        </div>
      </section>

      {/* Order Dispatch & Tracking */}
      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 20,
          padding: 24,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 22,
            margin: "0 0 16px",
          }}
        >
          How Your Order Travels
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 14,
          }}
        >
          {[
            {
              icon: Clock,
              step: "1. Quality Inspection",
              desc: "Every hijab is hand-inspected for weave perfection and wrapped in protective tissue paper.",
            },
            {
              icon: PackageCheck,
              step: "2. Same-Day Dispatch",
              desc: "Orders confirmed before 4 PM leave our Dhaka studio the same afternoon.",
            },
            {
              icon: Truck,
              step: "3. Live Status Updates",
              desc: "Track your order status (Processing, Shipped, Delivered) anytime from your My Account page.",
            },
            {
              icon: ShieldCheck,
              step: "4. Doorstep Inspection",
              desc: "Verify your package seal upon delivery before completing Cash on Delivery payment.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                style={{
                  background: "var(--surface-strong)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <Icon size={18} style={{ color: "var(--accent)", marginBottom: 8 }} />
                <strong style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
                  {item.step}
                </strong>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--muted)" }}>
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Returns & Exchanges Section */}
      <section
        id="returns"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 20,
          padding: 24,
          scrollMarginTop: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <RefreshCw size={20} style={{ color: "var(--accent)" }} />
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 22,
              margin: 0,
            }}
          >
            7-Day Easy Returns &amp; Exchanges Policy
          </h2>
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--muted)", margin: "0 0 18px" }}>
          We want you to love every piece you wear. If a shade doesn&apos;t match your outfit or you
          prefer a different fabric, you can request an exchange or return within{" "}
          <strong style={{ color: "var(--ink)" }}>7 days of delivery</strong>.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          <div
            style={{
              background: "var(--surface-strong)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 18,
            }}
          >
            <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>Eligible for Return / Exchange</h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 13,
                lineHeight: 1.7,
                color: "var(--muted)",
              }}
            >
              <li>Unworn, unwashed hijabs with original HayaNest BD tag and packaging intact</li>
              <li>Free instant replacement if you receive an incorrect item or manufacturing defect</li>
              <li>Shade or fabric exchange within 7 days of receiving your parcel</li>
            </ul>
          </div>

          <div
            style={{
              background: "var(--surface-strong)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 18,
            }}
          >
            <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>Non-Returnable Items</h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 13,
                lineHeight: 1.7,
                color: "var(--muted)",
              }}
            >
              <li>Hijab undercaps and opened pin sets (for hygiene protection)</li>
              <li>Items with pinholes, perfume scent, makeup transfer, or washing signs</li>
              <li>Clearance items marked as Final Sale</li>
            </ul>
          </div>
        </div>
      </section>
    </InfoPageLayout>
  );
}
