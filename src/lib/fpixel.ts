"use client";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
    __NOOR_PIXEL_TEST_MODE__?: boolean;
  }
}

/**
 * Dispatches an event to Facebook/Meta Pixel safely.
 * If fbq is loaded, fires the event.
 * If testMode is enabled, logs clearly to console with styled badges.
 */
export function trackPixel(event: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  const isTestMode = Boolean(window.__NOOR_PIXEL_TEST_MODE__);

  if (typeof window.fbq === "function") {
    try {
      if (data) {
        window.fbq("track", event, data);
      } else {
        window.fbq("track", event);
      }
    } catch (e) {
      if (isTestMode) {
        console.warn("[Meta Pixel Error]", e);
      }
    }
  }

  if (isTestMode) {
    console.info(
      `%c[Meta Pixel]%c Event '${event}' fired`,
      "background:#1877f2;color:#ffffff;font-weight:bold;padding:2px 8px;border-radius:4px;",
      "color:#1877f2;font-weight:bold;",
      data || {},
    );
  }
}

/**
 * Track PageView
 */
export function trackPageView() {
  trackPixel("PageView");
}

/**
 * Track ViewContent (Product View)
 */
export function trackViewContent(product: {
  id: string;
  name: string;
  price: number;
  category?: string;
}) {
  trackPixel("ViewContent", {
    content_ids: [product.id],
    content_name: product.name,
    content_category: product.category || "Hijab",
    content_type: "product",
    value: product.price,
    currency: "BDT",
  });
}

/**
 * Track AddToCart
 */
export function trackAddToCart(product: {
  id: string;
  name?: string;
  price?: number;
  quantity?: number;
  colour?: string;
}) {
  trackPixel("AddToCart", {
    content_ids: [product.id],
    content_name: product.name || product.id,
    content_type: "product",
    value: (product.price || 0) * (product.quantity || 1),
    currency: "BDT",
    quantity: product.quantity || 1,
    colour: product.colour,
  });
}

/**
 * Track InitiateCheckout
 */
export function trackInitiateCheckout(itemsCount: number, totalValue: number) {
  trackPixel("InitiateCheckout", {
    num_items: itemsCount,
    value: totalValue,
    currency: "BDT",
    content_type: "product",
  });
}

/**
 * Track Purchase
 */
export function trackPurchase(order: {
  id: string;
  total: number;
  itemsCount?: number;
}) {
  trackPixel("Purchase", {
    content_type: "product",
    value: order.total,
    currency: "BDT",
    order_id: order.id,
    num_items: order.itemsCount || 1,
  });
}

/**
 * Send test ping for verification
 */
export function trackTestPing(pixelId: string) {
  if (typeof window === "undefined") return false;
  if (typeof window.fbq === "function") {
    window.fbq("trackCustom", "AdminTestPing", {
      pixel_id: pixelId,
      timestamp: new Date().toISOString(),
      source: "HayaNest BD Admin Verification",
    });
    return true;
  }
  return false;
}
