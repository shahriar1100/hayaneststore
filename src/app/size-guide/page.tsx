import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Ruler, Sparkles } from "lucide-react";
import { InfoPageLayout } from "@/components/info/info-page-layout";

export const metadata: Metadata = {
  title: "Hijab Size & Fit Guide — HayaNest BD",
  description:
    "Explore HayaNest BD's hijab dimensions, fabric weights, and coverage guide across Modal, Chiffon, Jersey, and Silk.",
};

const SIZE_CHART = [
  {
    style: "Standard Rectangular",
    dimensions: "180 × 70 cm",
    coverage: "Medium to Full Coverage",
    fabrics: "Modal, Chiffon, Luxury Silk",
    bestFor: "Everyday wraps, shoulder drape, effortless office & occasion wear",
  },
  {
    style: "Maxi Rectangular",
    dimensions: "200 × 80 cm",
    coverage: "Maximum Chest & Back Coverage",
    fabrics: "Premium Modal, Georgette Chiffon",
    bestFor: "Layered styling, extra chest coverage, prayer-friendly wrapping",
  },
  {
    style: "Instant Stretch Wrap",
    dimensions: "175 × 65 cm",
    coverage: "Contoured Snug Coverage",
    fabrics: "Breathable Cotton Jersey",
    bestFor: "Pin-free styling, travel, active wear, all-day comfort",
  },
  {
    style: "Classic Square Scarf",
    dimensions: "110 × 110 cm",
    coverage: "Light to Medium Coverage",
    fabrics: "Satin Silk, Crinkle Chiffon",
    bestFor: "Structured Turkish fold, neat neckline tuck, formal events",
  },
];

const FABRIC_GUIDE = [
  {
    name: "Premium Modal",
    weight: "Lightweight (115 GSM)",
    opacity: "90% Opaque (Fully opaque when folded)",
    texture: "Ultra-soft, airy weave with gentle natural stretch",
    pins: "No-snag magnetic pins recommended",
    href: "/shop?fabric=modal",
  },
  {
    name: "Georgette Chiffon",
    weight: "Light-Medium (125 GSM)",
    opacity: "95% Opaque",
    texture: "Matte pebble grain that holds pleats effortlessly",
    pins: "Undercap + magnetic or straight pins recommended",
    href: "/shop?fabric=chiffon",
  },
  {
    name: "Soft Stretch Jersey",
    weight: "Medium (165 GSM)",
    opacity: "100% Opaque",
    texture: "Smooth four-way stretch knit that stays in place",
    pins: "Completely pin-free friendly",
    href: "/shop?fabric=jersey",
  },
  {
    name: "Mulberry & Crinkle Silk",
    weight: "Featherlight (105 GSM)",
    opacity: "92% Opaque",
    texture: "Luminous sheen with fluid, graceful drape",
    pins: "Use magnetic pins only to protect delicate fibers",
    href: "/shop?fabric=silk",
  },
];

export default function SizeGuidePage() {
  return (
    <InfoPageLayout
      eyebrow="Fit & Dimensions"
      title="Size & Fabric Guide"
      subtitle="Every HayaNest BD hijab is generously cut for graceful drape, comfortable neck coverage, and versatile styling without bulk."
      currentPath="/size-guide"
    >
      {/* Size Chart Table */}
      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 20,
          padding: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Ruler size={20} style={{ color: "var(--accent)" }} />
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 22,
              margin: 0,
            }}
          >
            Standard Hijab Dimensions
          </h2>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
              minWidth: 620,
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "2px solid var(--line)",
                  textAlign: "left",
                  color: "var(--muted)",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                <th style={{ padding: "12px 14px" }}>Cut / Style</th>
                <th style={{ padding: "12px 14px" }}>Dimensions</th>
                <th style={{ padding: "12px 14px" }}>Coverage Level</th>
                <th style={{ padding: "12px 14px" }}>Available Fabrics</th>
                <th style={{ padding: "12px 14px" }}>Best Suited For</th>
              </tr>
            </thead>
            <tbody>
              {SIZE_CHART.map((row) => (
                <tr key={row.style} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "14px", fontWeight: 600, color: "var(--ink)" }}>
                    {row.style}
                  </td>
                  <td style={{ padding: "14px", fontWeight: 700, color: "var(--accent)" }}>
                    {row.dimensions}
                  </td>
                  <td style={{ padding: "14px" }}>{row.coverage}</td>
                  <td style={{ padding: "14px", color: "var(--muted)" }}>{row.fabrics}</td>
                  <td style={{ padding: "14px", color: "var(--muted)" }}>{row.bestFor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Fabric Comparison Grid */}
      <section>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Sparkles size={20} style={{ color: "var(--accent)" }} />
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 22,
              margin: 0,
            }}
          >
            Fabric Weight, Opacity &amp; Drape Comparison
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {FABRIC_GUIDE.map((item) => (
            <div
              key={item.name}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 18,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 14,
              }}
            >
              <div>
                <h3
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    fontSize: 19,
                    margin: "0 0 10px",
                  }}
                >
                  {item.name}
                </h3>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "grid",
                    gap: 8,
                    fontSize: 13,
                    color: "var(--muted)",
                  }}
                >
                  <li>
                    <strong style={{ color: "var(--ink)" }}>Weight:</strong> {item.weight}
                  </li>
                  <li>
                    <strong style={{ color: "var(--ink)" }}>Opacity:</strong> {item.opacity}
                  </li>
                  <li>
                    <strong style={{ color: "var(--ink)" }}>Feel:</strong> {item.texture}
                  </li>
                  <li>
                    <strong style={{ color: "var(--ink)" }}>Styling Note:</strong> {item.pins}
                  </li>
                </ul>
              </div>
              <Link
                href={item.href}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--accent)",
                  textDecoration: "none",
                }}
              >
                Browse {item.name} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Styling Tips */}
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
            margin: "0 0 14px",
          }}
        >
          How to Choose Your Ideal Fit
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {[
            {
              title: "For Humid Dhaka Weather",
              desc: "Choose our 180 × 70 cm Premium Modal hijabs—ultra-breathable, plant-based fibers that stay cool from morning commutes to evening gatherings.",
            },
            {
              title: "For Effortless Pin-Free Days",
              desc: "Our 175 × 65 cm Soft Stretch Jersey hugs comfortably without slipping, making it ideal for long workdays, university classes, or travel.",
            },
            {
              title: "For Weddings & Formal Events",
              desc: "Opt for our Mulberry Silk or Georgette Chiffon paired with HayaNest BD No-Snag Magnetic Pins for an elevated, luminous drape.",
            },
          ].map((tip) => (
            <div
              key={tip.title}
              style={{
                background: "var(--surface-strong)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <CheckCircle2 size={16} style={{ color: "var(--accent)" }} />
                <strong style={{ fontSize: 14 }}>{tip.title}</strong>
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>
                {tip.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </InfoPageLayout>
  );
}
