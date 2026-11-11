import type { Metadata } from "next";
import { InfoPageLayout } from "@/components/info/info-page-layout";
import { ShieldAlert, ShoppingBag, Truck, RefreshCw, Scale } from "lucide-react";
import { getStoreSettings } from "@/lib/server/store-repository";
import { formatPrice } from "@/data/store";

export const metadata: Metadata = {
  title: "Terms & Conditions — HayaNest BD",
  description:
    "Read the terms, ordering agreement, Cash on Delivery guidelines, and exchange terms for HayaNest BD.",
};

export default async function TermsPage() {
  const settings = await getStoreSettings();
  const storeName = settings.storeName || "HayaNest BD";
  const contactEmail = settings.contactEmail || "support@hayanestbd.com";
  const insideFee = formatPrice(settings.insideDhakaShippingFee);
  const outsideFee = formatPrice(settings.outsideDhakaShippingFee);

  return (
    <InfoPageLayout
      eyebrow="Legal & Customer Agreement"
      title="Terms & Conditions"
      subtitle={`Please review the terms and policies governing orders, deliveries, and exchanges on ${storeName}.`}
      currentPath="/terms"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {/* Notice Card */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 16,
            padding: 20,
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <div
            style={{
              padding: 10,
              background: "rgba(217, 119, 6, 0.1)",
              color: "#d97706",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldAlert size={22} />
          </div>
          <div>
            <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
              Important Notice for Cash on Delivery (COD) Orders
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
              By submitting an order on our store, you confirm that your provided name, active phone number, and delivery address are accurate, and you commit to receiving the parcel upon courier arrival. Refusing parcels without valid reasons harms local small businesses through lost courier delivery and return charges.
            </p>
          </div>
        </div>

        {/* Sections */}
        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 20,
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 8,
                color: "var(--ink)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <ShoppingBag size={18} style={{ color: "var(--accent)" }} /> 1. Ordering &amp; Pricing
            </h2>
            <ul style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.8, margin: 0, paddingLeft: 20 }}>
              <li>All prices displayed on the store are in Bangladeshi Taka (৳ BDT) and include applicable product pricing.</li>
              <li>Order placement generates an automated order ID and sends a confirmation receipt. Our dispatch team may call or WhatsApp you to verify the delivery destination before handing the parcel to our courier partner.</li>
              <li>We reserve the right to cancel or withhold orders with suspicious, unreachable, or fraudulent contact information.</li>
            </ul>
          </div>

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 20 }}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 8,
                color: "var(--ink)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Truck size={18} style={{ color: "var(--accent)" }} /> 2. Delivery &amp; Shipping Charges
            </h2>
            <ul style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.8, margin: 0, paddingLeft: 20 }}>
              <li><strong>Inside Dhaka Metro:</strong> Delivery charge is {insideFee}. Typical delivery window is 24 to 48 hours.</li>
              <li><strong>Outside Dhaka (Nationwide):</strong> Delivery charge is {outsideFee}. Delivered via courier within 3 to 5 business days.</li>
              <li>During Eid festivals, national campaigns, or adverse weather conditions, courier transit times may experience slight delays.</li>
            </ul>
          </div>

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 20 }}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 8,
                color: "var(--ink)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <RefreshCw size={18} style={{ color: "var(--accent)" }} /> 3. Exchanges &amp; Returns Policy
            </h2>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7, margin: 0 }}>
              We take pride in premium fabric quality and meticulous stitching. If you receive a wrong colour, incorrect size, or defective item:
            </p>
            <ul style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.8, marginTop: 8, paddingLeft: 20 }}>
              <li>Notify our customer service team within <strong>7 days</strong> of parcel receipt.</li>
              <li>Items must remain unworn, unwashed, and with all original tags and packaging intact.</li>
              <li>For genuine factory defects or shipping errors on our part, return and reshipping courier costs will be completely covered by HayaNest BD.</li>
            </ul>
          </div>

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 20 }}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 8,
                color: "var(--ink)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Scale size={18} style={{ color: "var(--accent)" }} /> 4. Governing Law &amp; Inquiries
            </h2>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7, margin: 0 }}>
              These terms are governed in accordance with the laws of Bangladesh. If you have any inquiries regarding these terms, please contact our support team at{" "}
              <a href={`mailto:${contactEmail}`} style={{ color: "var(--accent)", textDecoration: "underline" }}>
                {contactEmail}
              </a>.
            </p>
          </div>
        </section>
      </div>
    </InfoPageLayout>
  );
}
