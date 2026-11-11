import type { Metadata } from "next";
import Image from "next/image";
import { Award, Heart, ShieldCheck, Sparkles } from "lucide-react";
import { InfoPageLayout } from "@/components/info/info-page-layout";
import { photos } from "@/data/photos";

export const metadata: Metadata = {
  title: "About HayaNest BD — Modest Beauty, Everyday With You",
  description:
    "Discover the story behind HayaNest BD: thoughtfully crafted modal, chiffon, jersey, and silk hijabs designed in Dhaka for everyday comfort and timeless modesty.",
};

export default function AboutPage() {
  return (
    <InfoPageLayout
      eyebrow="Our Story"
      title="Modest Beauty, Everyday With You"
      subtitle="Founded in Dhaka, HayaNest BD creates elevated hijabs and modest essentials that unite breathable comfort, refined earth-tone palettes, and enduring craftsmanship."
      currentPath="/about"
    >
      {/* Story Split Section */}
      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 20,
          padding: 24,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 24,
          alignItems: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            minHeight: 320,
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid var(--line)",
          }}
        >
          <Image
            src={photos.hero.src}
            alt={photos.hero.alt}
            fill
            sizes="(min-width: 768px) 50vw, 94vw"
            style={{
              objectFit: "cover",
              objectPosition: photos.hero.position || "74% 18%",
            }}
          />
        </div>

        <div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--accent)",
            }}
          >
            Designed for Real Life
          </span>
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 26,
              margin: "8px 0 14px",
            }}
          >
            Crafted for Bangladesh&apos;s Climate &amp; Global Modest Style
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--muted)", margin: "0 0 12px" }}>
            HayaNest BD began with a simple question: why was it so hard to find a hijab that looked
            graceful for an evening invitation yet felt cool and breathable during a warm afternoon
            in Dhaka?
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--muted)", margin: 0 }}>
            We spent months testing yarn weights, baby-hem stitching, and custom dye baths—from
            Dusty Rose and Warm Sand to Espresso Mocha and Olive—so every piece drapes effortlessly
            from the very first wear.
          </p>
        </div>
      </section>

      {/* Core Values */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 16,
        }}
      >
        {[
          {
            icon: Sparkles,
            title: "Breathable Natural Fibers",
            text: "We prioritize airy beechwood modal, soft cotton-blend jersey, and fine georgette that let your skin breathe all day.",
          },
          {
            icon: Award,
            title: "Artisan Hemming",
            text: "Every scarf is finished with neat micro-rolled or eyelash hems and inspected by hand before packaging.",
          },
          {
            icon: Heart,
            title: "Flattering Earth Tones",
            text: "Our curated palette is specifically balanced to complement South Asian skin tones across both casual and formal wardrobes.",
          },
          {
            icon: ShieldCheck,
            title: "Honest Pricing",
            text: "By working directly with textile mills and studios, we deliver luxury-grade hijabs at accessible everyday prices.",
          },
        ].map((val) => {
          const Icon = val.icon;
          return (
            <div
              key={val.title}
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
              <h3
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: 18,
                  margin: "0 0 6px",
                }}
              >
                {val.title}
              </h3>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>
                {val.text}
              </p>
            </div>
          );
        })}
      </section>
    </InfoPageLayout>
  );
}
