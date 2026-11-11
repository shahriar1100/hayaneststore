import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

const INFO_NAV_ITEMS = [
  { label: "About Us", href: "/about" },
  { label: "Size Guide", href: "/size-guide" },
  { label: "Care Instructions", href: "/care-instructions" },
  { label: "Shipping & Returns", href: "/shipping-returns" },
  { label: "Help / FAQs", href: "/faq" },
  { label: "Contact Us", href: "/contact" },
];

interface InfoPageLayoutProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  currentPath: string;
  children: ReactNode;
}

export function InfoPageLayout({
  eyebrow,
  title,
  subtitle,
  currentPath,
  children,
}: InfoPageLayoutProps) {
  return (
    <div>
      <SiteHeader />
      <main id="main-content" className="page-container" style={{ paddingTop: 28, paddingBottom: 72 }}>
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--muted)",
            marginBottom: 20,
          }}
        >
          <Link href="/" style={{ color: "var(--muted)", textDecoration: "none" }}>
            Home
          </Link>
          <ChevronRight size={14} aria-hidden="true" />
          <span style={{ color: "var(--ink)", fontWeight: 600 }}>{title}</span>
        </nav>

        {/* Hero Banner Card */}
        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 24,
            padding: "36px 28px",
            marginBottom: 28,
          }}
        >
          <span
            style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--brand)",
              background: "var(--surface-warm)",
              padding: "6px 12px",
              borderRadius: 999,
              marginBottom: 14,
            }}
          >
            {eyebrow}
          </span>
          <h1
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: "clamp(28px, 4vw, 44px)",
              lineHeight: 1.12,
              margin: "0 0 12px",
              color: "var(--ink)",
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.65,
              color: "var(--muted)",
              maxWidth: 680,
              margin: 0,
            }}
          >
            {subtitle}
          </p>

          {/* Quick Navigation Pills across Info Pages */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 24,
              paddingTop: 20,
              borderTop: "1px solid var(--line)",
            }}
          >
            {INFO_NAV_ITEMS.map((item) => {
              const active = item.href === currentPath;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    textDecoration: "none",
                    background: active ? "var(--ink)" : "var(--surface-soft)",
                    color: active ? "var(--page)" : "var(--ink)",
                    border: active ? "1px solid var(--ink)" : "1px solid var(--line)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </section>

        {/* Main Content */}
        <div style={{ display: "grid", gap: 24 }}>{children}</div>

        {/* Bottom CTA Banner */}
        <section
          style={{
            marginTop: 36,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 20,
            padding: "28px 24px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: 22,
                margin: "0 0 6px",
                color: "var(--ink)",
              }}
            >
              Ready to explore our collection?
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
              Discover breathable modal, effortless jersey, classic chiffon, and luxury silk hijabs.
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link
              href="/shop"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "11px 20px",
                borderRadius: 999,
                background: "var(--ink)",
                color: "var(--page)",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Shop Collection <ArrowRight size={15} />
            </Link>
            {currentPath !== "/contact" && (
              <Link
                href="/contact"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "11px 20px",
                  borderRadius: 999,
                  background: "var(--surface-soft)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Contact Support
              </Link>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
      <MobileBottomNav />
    </div>
  );
}
