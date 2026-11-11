"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import type { FacebookPixelConfig } from "@/types/store";
import { trackPageView, trackAddToCart } from "@/lib/fpixel";

type Props = {
  pixelConfig?: FacebookPixelConfig;
};

export function FacebookPixelTracker({ pixelConfig }: Props) {
  const pathname = usePathname();
  const firstRender = useRef(true);
  const [badgeDismissed, setBadgeDismissed] = useState(false);
  const [lastEventFired, setLastEventFired] = useState<string>("Initialized");

  const pixelId = pixelConfig?.pixelId?.trim() || "";
  const isEnabled = Boolean(pixelConfig?.enabled && pixelId.length >= 10);
  const isTestMode = Boolean(pixelConfig?.testMode);
  const showTestBadge = isEnabled && isTestMode && !badgeDismissed;

  // Set global test mode flag
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__NOOR_PIXEL_TEST_MODE__ = isTestMode;
    }
  }, [isTestMode]);

  // Track PageView on route navigation
  useEffect(() => {
    if (!isEnabled) return;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    trackPageView();
    setLastEventFired(`PageView: ${pathname}`);
  }, [pathname, isEnabled]);

  // Listen to cart additions across the storefront
  useEffect(() => {
    if (!isEnabled) return;

    const handleCartAdd = (e: Event) => {
      const customEvent = e as CustomEvent<{
        id: string;
        name?: string;
        price?: number;
        quantity?: number;
        colour?: string;
      }>;
      if (customEvent.detail?.id) {
        trackAddToCart(customEvent.detail);
        setLastEventFired(`AddToCart: ${customEvent.detail.name || customEvent.detail.id}`);
      }
    };

    window.addEventListener("noor:cart-product-added", handleCartAdd);
    return () => {
      window.removeEventListener("noor:cart-product-added", handleCartAdd);
    };
  }, [isEnabled]);

  if (!isEnabled) return null;

  return (
    <>
      {/* Meta Pixel Base Code */}
      <Script
        id="fb-pixel-base"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>

      {/* Visual Diagnostic Pill for Test Mode / Verification */}
      {showTestBadge && (
        <div
          style={{
            position: "fixed",
            bottom: "82px",
            left: "16px",
            zIndex: 9999,
            backgroundColor: "#0f172a",
            color: "#ffffff",
            padding: "8px 12px",
            borderRadius: "999px",
            fontSize: "11px",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#22c55e",
              boxShadow: "0 0 8px #22c55e",
              display: "inline-block",
            }}
          />
          <span>Meta Pixel: {pixelId}</span>
          <span style={{ opacity: 0.6 }}>|</span>
          <span style={{ color: "#93c5fd" }}>{lastEventFired}</span>
          <button
            type="button"
            onClick={() => setBadgeDismissed(true)}
            style={{
              marginLeft: "4px",
              background: "transparent",
              border: 0,
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "12px",
              padding: "0 4px",
            }}
            title="Dismiss badge"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
