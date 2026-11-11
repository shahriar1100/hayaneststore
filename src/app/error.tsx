"use client";

import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default function GlobalErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="main-content"
      className="page-container"
      style={{
        minHeight: "75dvh",
        paddingTop: 64,
        paddingBottom: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <section
        aria-labelledby="error-page-title"
        style={{
          width: "100%",
          maxWidth: 540,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 24,
          padding: "40px 28px",
          textAlign: "center",
          boxShadow: "0 16px 40px -16px rgb(38 24 14 / 12%)",
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: "50%",
            background: "var(--surface-warm)",
            color: "var(--brand)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <AlertTriangle size={24} aria-hidden="true" />
        </div>

        <h1
          id="error-page-title"
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: "clamp(24px, 3.6vw, 32px)",
            lineHeight: 1.2,
            margin: "0 0 10px",
            color: "var(--ink)",
          }}
        >
          Something Went Wrong
        </h1>

        <p
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: "var(--muted)",
            margin: "0 auto 24px",
            maxWidth: 420,
          }}
        >
          We encountered a temporary issue while loading this page. Please try refreshing or return
          to the HayaNest BD storefront.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 22px",
              borderRadius: 999,
              border: "none",
              background: "var(--ink)",
              color: "var(--page)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RotateCcw size={15} aria-hidden="true" /> Try Again
          </button>

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
            <Home size={15} aria-hidden="true" /> Return Home
          </Link>
        </div>
      </section>
    </main>
  );
}
