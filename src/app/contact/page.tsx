import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageSquare, Phone } from "lucide-react";
import { InfoPageLayout } from "@/components/info/info-page-layout";
import { ContactForm } from "@/components/info/contact-form";
import { demoContact } from "@/data/store";
import { getStoreSettings } from "@/lib/server/store-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact Us — HayaNest BD Customer Care",
  description:
    "Get in touch with HayaNest BD's Dhaka studio for order assistance, fabric advice, exchanges, or bridal gift inquiries.",
};

export default async function ContactPage() {
  const settings = await getStoreSettings();
  const contactPhone = settings.contactPhone?.trim() || demoContact.phone;
  const contactEmail = settings.contactEmail?.trim() || demoContact.email;
  const contactLocation = settings.contactLocation?.trim() || demoContact.location;

  return (
    <InfoPageLayout
      eyebrow="Customer Care"
      title="Contact Us"
      subtitle="Have a question about an order, fabric shade, or exchange? Our Dhaka support team is here to help you every day."
      currentPath="/contact"
    >
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* Contact Channels */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 20,
            padding: 24,
            display: "grid",
            gap: 18,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 22,
              margin: 0,
            }}
          >
            Direct Support Channels
          </h2>

          {[
            {
              icon: Phone,
              label: "Phone & WhatsApp Support",
              value: contactPhone,
              note: "Available Saturday – Thursday, 10:00 AM – 8:00 PM (BST)",
            },
            {
              icon: Mail,
              label: "Customer Care Email",
              value: contactEmail,
              note: "We respond to all emails within 12–24 hours",
            },
            {
              icon: MapPin,
              label: "Dispatch & Design Studio",
              value: contactLocation,
              note: "Nationwide courier dispatch across all 64 districts",
            },
            {
              icon: Clock,
              label: "Same-Day Dispatch Cutoff",
              value: "4:00 PM Daily",
              note: "Orders placed before 4 PM ship out the same afternoon",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                  background: "var(--surface-strong)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <span style={{ fontSize: 12, color: "var(--muted)", display: "block" }}>
                    {item.label}
                  </span>
                  <strong style={{ fontSize: 15, color: "var(--ink)", display: "block" }}>
                    {item.value}
                  </strong>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{item.note}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Message Form */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <MessageSquare size={20} style={{ color: "var(--accent)" }} />
            <h2
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: 22,
                margin: 0,
              }}
            >
              Send Us a Message
            </h2>
          </div>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--muted)" }}>
            Fill out the form below and our team will get back to you promptly.
          </p>
          <ContactForm />
        </div>
      </section>
    </InfoPageLayout>
  );
}
