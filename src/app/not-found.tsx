import Link from "next/link";
import { ArrowLeft, Compass, ShoppingBag } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

export default function NotFound() {
  return (
    <div>
      <SiteHeader />
      <main
        id="main-content"
        className="page-container"
        style={{
          paddingTop: 56,
          paddingBottom: 88,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <section
          aria-labelledby="not-found-title"
          style={{
            width: "100%",
            maxWidth: 580,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 24,
            padding: "44px 28px",
            textAlign: "center",
            boxShadow: "0 16px 40px -16px rgb(38 24 14 / 12%)",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--surface-warm)",
              color: "var(--brand)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Compass size={26} aria-hidden="true" />
          </div>

          <span
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--brand)",
              marginBottom: 8,
            }}
          >
            404 · Page Not Found
          </span>

          <h1
            id="not-found-title"
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: "clamp(26px, 4vw, 36px)",
              lineHeight: 1.2,
              margin: "0 0 12px",
              color: "var(--ink)",
            }}
          >
            We Couldn&apos;t Find That Drape
          </h1>

          <p
            style={{
              fontSize: 14,
              lineHeight: 1.65,
              color: "var(--muted)",
              margin: "0 auto 28px",
              maxWidth: 440,
            }}
          >
            The page or hijab you are looking for may have been moved, sold out, or the link might
            be mistyped. Explore our latest modal, chiffon, jersey, and silk collections below.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <Link
              href="/shop"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 22px",
                borderRadius: 999,
                background: "var(--ink)",
                color: "var(--page)",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <ShoppingBag size={16} aria-hidden="true" /> Explore Shop Catalog
            </Link>

            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 22px",
                borderRadius: 999,
                background: "var(--surface-warm)",
                color: "var(--ink)",
                border: "1px solid var(--line)",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <ArrowLeft size={16} aria-hidden="true" /> Back to Homepage
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
      <MobileBottomNav />
    </div>
  );
}
