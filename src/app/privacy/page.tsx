import type { Metadata } from "next";
import { InfoPageLayout } from "@/components/info/info-page-layout";
import { Lock, Shield, Eye, Database, Bell, UserCheck } from "lucide-react";
import { getStoreSettings } from "@/lib/server/store-repository";

export const metadata: Metadata = {
  title: "Privacy Policy — HayaNest BD",
  description:
    "Learn how HayaNest BD collects, uses, and protects your personal information when shopping for modest wear online in Bangladesh.",
};

export default async function PrivacyPolicyPage() {
  const settings = await getStoreSettings();
  const storeName = settings.storeName || "HayaNest BD";
  const contactEmail = settings.contactEmail || "support@hayanestbd.com";
  const contactPhone = settings.contactPhone || "+880 1700-000000";

  return (
    <InfoPageLayout
      eyebrow="Data Protection & Trust"
      title="Privacy Policy"
      subtitle={`We are committed to safeguarding your personal data and ensuring a secure, transparent shopping experience at ${storeName}.`}
      currentPath="/privacy"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {/* Key Highlights */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "var(--accent)",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              <Shield size={18} />
              <span>Zero Data Selling</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>
              We never sell, rent, or trade your personal phone numbers, delivery addresses, or browsing history to third-party advertisers.
            </p>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "var(--accent)",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              <Lock size={18} />
              <span>Encrypted Checkout</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>
              All order submissions and mobile banking verifications are transmitted through SSL/TLS encryption for maximum privacy.
            </p>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "var(--accent)",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              <UserCheck size={18} />
              <span>Courier Delivery Only</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>
              Your delivery address and phone number are shared solely with our verified courier partners (Steadfast / Pathao) for parcel dispatch.
            </p>
          </div>
        </div>

        {/* Detailed Sections */}
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
              <Eye size={18} style={{ color: "var(--accent)" }} /> 1. Information We Collect
            </h2>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7, margin: 0 }}>
              When you place an order, create an account, or contact our customer support, we may collect:
            </p>
            <ul style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.8, marginTop: 8, paddingLeft: 20 }}>
              <li><strong>Contact Information:</strong> Full name, phone number, email address, and delivery address (including city and district).</li>
              <li><strong>Order History:</strong> Products purchased, sizes, colours, order amounts, payment methods (COD, bKash, Nagad), and delivery status.</li>
              <li><strong>Account Credentials:</strong> If you register an account, your hashed password and saved delivery preferences are stored securely.</li>
              <li><strong>Device &amp; Usage Data:</strong> Anonymized analytical data such as pages visited, device type, and referral sources to help improve store speed and navigation.</li>
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
              <Database size={18} style={{ color: "var(--accent)" }} /> 2. How We Use Your Information
            </h2>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7, margin: 0 }}>
              Your personal information is strictly used for the following operational purposes:
            </p>
            <ul style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.8, marginTop: 8, paddingLeft: 20 }}>
              <li>Processing, packing, and dispatching your orders through nationwide courier logistics.</li>
              <li>Sending automated order confirmation emails, invoices, and delivery tracking updates.</li>
              <li>Verifying Cash on Delivery (COD) orders via SMS or phone call to prevent courier return fraud and bogus bookings.</li>
              <li>Providing customer support and processing size exchanges or warranty requests.</li>
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
              <Bell size={18} style={{ color: "var(--accent)" }} /> 3. Data Retention &amp; Rights
            </h2>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7, margin: 0 }}>
              You have the right to request access to the personal data we hold about you, request corrections to your delivery details, or request account deletion.
            </p>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7, marginTop: 10 }}>
              For privacy inquiries, data removal, or account assistance, please contact our support desk at{" "}
              <a href={`mailto:${contactEmail}`} style={{ color: "var(--accent)", textDecoration: "underline" }}>
                {contactEmail}
              </a>{" "}
              or call <strong>{contactPhone}</strong>.
            </p>
          </div>
        </section>
      </div>
    </InfoPageLayout>
  );
}
