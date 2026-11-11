import type { Metadata } from "next";
import { Droplets, ShieldCheck, Sparkles, Sun, Wind } from "lucide-react";
import { InfoPageLayout } from "@/components/info/info-page-layout";

export const metadata: Metadata = {
  title: "Fabric Care Instructions — HayaNest BD",
  description:
    "Learn how to wash, steam, and store your HayaNest BD Modal, Chiffon, Jersey, and Silk hijabs so they stay soft and vibrant for years.",
};

const FABRIC_CARE = [
  {
    fabric: "Premium Modal",
    wash: "Hand wash in cold water with mild liquid detergent, or machine wash on delicate inside a mesh laundry bag.",
    dry: "Lay flat or hang over a padded hanger in the shade. Never wring or twist wet modal fibers.",
    iron: "Use a garment steamer or low-heat iron on the reverse side while slightly damp.",
    avoid: "Avoid bleach, fabric softeners, and velcro or sharp safety pins that can pull delicate yarns.",
  },
  {
    fabric: "Everyday Georgette Chiffon",
    wash: "Machine wash cold on gentle cycle inside a mesh bag, or hand wash separately by color group.",
    dry: "Air dry hanging—chiffon dries within 30–45 minutes and naturally releases most creases.",
    iron: "Low heat or gentle steam. Avoid pressing directly with high heat.",
    avoid: "Avoid rough surfaces and heavy metal brooches; pair with HayaNest BD magnetic pins for zero pinholes.",
  },
  {
    fabric: "Soft Stretch Jersey",
    wash: "Cold gentle machine wash or hand wash with similar shades.",
    dry: "Dry flat on a clean towel to preserve the natural 4-way elasticity and prevent stretching.",
    iron: "Light steam only if needed; jersey naturally resists wrinkling.",
    avoid: "Do not tumble dry on high heat or hang vertically when soaked with water.",
  },
  {
    fabric: "Luxury Crinkle & Satin Silk",
    wash: "Hand wash gently in cool water using silk-safe pH-neutral wash, or dry clean for formal pieces.",
    dry: "Gently roll in a clean towel to blot excess moisture, then air dry away from direct sunlight.",
    iron: "Steam from 15 cm distance or iron on Silk setting using a pressing cloth.",
    avoid: "Never spray perfume or hairspray directly onto silk fabric as alcohol can leave watermarks.",
  },
];

export default function CareInstructionsPage() {
  return (
    <InfoPageLayout
      eyebrow="Garment Longevity"
      title="Care Instructions"
      subtitle="Thoughtful care keeps your hijabs soft, breathable, and true to shade wear after wear. Follow our fabric-specific guide below."
      currentPath="/care-instructions"
    >
      {/* 4 Core Principles */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {[
          {
            icon: Droplets,
            title: "Cold Water Wash",
            text: "Always use cool water (below 30°C) and a gentle, bleach-free detergent to protect natural dyes.",
          },
          {
            icon: Wind,
            title: "Shade Air-Drying",
            text: "Dry indoors or in shaded airflow. Direct midday sun can gradually fade delicate earth and rose tones.",
          },
          {
            icon: Sparkles,
            title: "Steam Over Iron",
            text: "A handheld steamer relaxes creases in seconds without flattening the airy texture of modal or silk.",
          },
          {
            icon: ShieldCheck,
            title: "Use Magnetic Pins",
            text: "Replace sharp safety pins with matte magnetic pins to prevent snags and keep weaves intact.",
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 18,
                padding: 20,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <Icon size={20} />
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: 18,
                  margin: "0 0 6px",
                }}
              >
                {card.title}
              </h2>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>
                {card.text}
              </p>
            </div>
          );
        })}
      </section>

      {/* Fabric-by-Fabric Care Cards */}
      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 20,
          padding: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <Sun size={20} style={{ color: "var(--accent)" }} />
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 22,
              margin: 0,
            }}
          >
            Fabric-by-Fabric Care Guide
          </h2>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          {FABRIC_CARE.map((item) => (
            <div
              key={item.fabric}
              style={{
                background: "var(--surface-strong)",
                border: "1px solid var(--line)",
                borderRadius: 16,
                padding: 20,
              }}
            >
              <h3
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: 19,
                  margin: "0 0 12px",
                  color: "var(--ink)",
                }}
              >
                {item.fabric}
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 14,
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                <div>
                  <strong style={{ display: "block", color: "var(--ink)", marginBottom: 4 }}>
                    Washing
                  </strong>
                  <span style={{ color: "var(--muted)" }}>{item.wash}</span>
                </div>
                <div>
                  <strong style={{ display: "block", color: "var(--ink)", marginBottom: 4 }}>
                    Drying
                  </strong>
                  <span style={{ color: "var(--muted)" }}>{item.dry}</span>
                </div>
                <div>
                  <strong style={{ display: "block", color: "var(--ink)", marginBottom: 4 }}>
                    Steaming &amp; Ironing
                  </strong>
                  <span style={{ color: "var(--muted)" }}>{item.iron}</span>
                </div>
                <div>
                  <strong style={{ display: "block", color: "var(--ink)", marginBottom: 4 }}>
                    What to Avoid
                  </strong>
                  <span style={{ color: "var(--muted)" }}>{item.avoid}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </InfoPageLayout>
  );
}
