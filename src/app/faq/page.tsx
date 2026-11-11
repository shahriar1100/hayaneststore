import type { Metadata } from "next";
import { HelpCircle } from "lucide-react";
import { InfoPageLayout } from "@/components/info/info-page-layout";

export const metadata: Metadata = {
  title: "Help & Frequently Asked Questions — HayaNest BD",
  description:
    "Answers to common questions about HayaNest BD hijabs, sizing, fabric care, delivery times across Bangladesh, Cash on Delivery, and returns.",
};

const FAQ_GROUPS = [
  {
    category: "Orders & Delivery",
    items: [
      {
        q: "How long does delivery take inside and outside Dhaka?",
        a: "Inside Dhaka Metro, orders arrive within 1–2 business days. Outside Dhaka (all 64 districts across Bangladesh), delivery takes 3–5 business days via our courier partners.",
      },
      {
        q: "How can I track my order status?",
        a: "Visit the 'My Account' page and sign in or use the Phone/Email Order Lookup tool to see real-time updates (Pending, Confirmed, Processing, Shipped, Delivered) and leave product reviews once delivered.",
      },
      {
        q: "Do you offer Cash on Delivery (COD)?",
        a: "Yes! We offer Cash on Delivery nationwide across Bangladesh, as well as bKash and Nagad mobile banking options at checkout.",
      },
    ],
  },
  {
    category: "Fabrics, Sizing & Styling",
    items: [
      {
        q: "Which hijab fabric is best for hot and humid weather?",
        a: "Our Premium Modal hijabs (180 × 70 cm) are spun from breathable beechwood fibers that feel cool against the skin, making them our #1 bestseller for Bangladesh's warm climate.",
      },
      {
        q: "Are HayaNest BD hijabs see-through?",
        a: "Our Jersey and Chiffon hijabs offer 95–100% opacity with a single wrap. Our featherlight Modal and Silk hijabs are 90% opaque and completely opaque when draped or worn with an undercap.",
      },
      {
        q: "Will pins damage my modal or silk hijab?",
        a: "Traditional safety pins can snag fine fibers. We recommend using HayaNest BD Matte No-Snag Magnetic Pins, which hold multiple layers securely without leaving pinholes.",
      },
    ],
  },
  {
    category: "Promotions, Returns & Account",
    items: [
      {
        q: "How do I apply a discount coupon code?",
        a: "On the Shopping Bag or Checkout page, enter your promo code (such as HAYA10 or EID200) in the Coupon box and click Apply. Your discount will be calculated automatically.",
      },
      {
        q: "Can I exchange a hijab if the shade doesn't suit me?",
        a: "Yes. As long as the hijab is unworn, unwashed, and has its original tags intact, you can request a shade or fabric exchange within 7 days of delivery.",
      },
      {
        q: "Can I access my account and order history from a different phone or laptop?",
        a: "Yes! When you register an account or place an order with your phone number and email, your profile and order history are synced to our cloud database so you can sign in from any device.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <InfoPageLayout
      eyebrow="Support Center"
      title="Help & Frequently Asked Questions"
      subtitle="Everything you need to know about ordering, fabrics, nationwide delivery, and exchanges at HayaNest BD."
      currentPath="/faq"
    >
      {FAQ_GROUPS.map((group) => (
        <section
          key={group.category}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <HelpCircle size={20} style={{ color: "var(--accent)" }} />
            <h2
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: 22,
                margin: 0,
              }}
            >
              {group.category}
            </h2>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {group.items.map((item) => (
              <details
                key={item.q}
                open
                style={{
                  background: "var(--surface-strong)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: "16px 18px",
                }}
              >
                <summary
                  style={{
                    fontWeight: 600,
                    fontSize: 15,
                    color: "var(--ink)",
                    cursor: "pointer",
                  }}
                >
                  {item.q}
                </summary>
                <p
                  style={{
                    margin: "10px 0 0",
                    fontSize: 13.5,
                    lineHeight: 1.65,
                    color: "var(--muted)",
                  }}
                >
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </InfoPageLayout>
  );
}
