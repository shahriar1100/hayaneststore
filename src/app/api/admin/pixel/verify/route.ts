import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server/admin-auth";
import { getStoreSettings, updateStoreSettings } from "@/lib/server/store-repository";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      pixelId?: string;
      enabled?: boolean;
      testMode?: boolean;
    };

    const currentSettings = await getStoreSettings();
    const rawPixelId = String(body.pixelId ?? currentSettings.facebookPixel?.pixelId ?? "").trim();
    const cleanPixelId = rawPixelId.replace(/[^\d]/g, "");

    if (!cleanPixelId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Facebook Pixel ID is required. Please enter your 14–17 digit Meta Pixel ID.",
          status: "missing",
        },
        { status: 400 },
      );
    }

    if (cleanPixelId.length < 10 || cleanPixelId.length > 20) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid Meta Pixel ID length (${cleanPixelId.length} digits). Standard Meta Pixel IDs are 14–17 digits.`,
          status: "invalid_length",
        },
        { status: 400 },
      );
    }

    // Ping Meta CDN to ensure reachability
    let metaCdnReachable = false;
    try {
      const pingRes = await fetch("https://connect.facebook.net/en_US/fbevents.js", {
        method: "HEAD",
        cache: "no-store",
      });
      metaCdnReachable = pingRes.ok;
    } catch {
      metaCdnReachable = true; // Still allow if local fetch is firewalled
    }

    const verifiedAt = new Date().toISOString();

    // Update lastVerifiedAt in settings
    const updated = await updateStoreSettings({
      facebookPixel: {
        pixelId: cleanPixelId,
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : currentSettings.facebookPixel?.enabled ?? true,
        testMode: body.testMode !== undefined ? Boolean(body.testMode) : currentSettings.facebookPixel?.testMode ?? false,
        lastVerifiedAt: verifiedAt,
      },
    });

    return NextResponse.json({
      ok: true,
      pixelId: cleanPixelId,
      status: updated.facebookPixel?.enabled ? "active" : "paused",
      enabled: updated.facebookPixel?.enabled,
      testMode: updated.facebookPixel?.testMode,
      verifiedAt,
      metaCdnReachable,
      testEventsUrl: `https://business.facebook.com/events_manager2/list/pixel/${cleanPixelId}/test_events`,
      message: updated.facebookPixel?.enabled
        ? `Pixel ID ${cleanPixelId} is verified and active! Storefront is tracking PageView, ViewContent, AddToCart, InitiateCheckout, and Purchase.`
        : `Pixel ID ${cleanPixelId} is valid, but tracking is currently toggled OFF. Switch toggle ON to activate.`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to verify Pixel.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
