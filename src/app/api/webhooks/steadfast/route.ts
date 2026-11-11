import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { applySteadfastWebhook } from "@/lib/server/courier";
import { getStoreSettings } from "@/lib/server/store-repository";

export const dynamic = "force-dynamic";

function constantTimeMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: "steadfast",
    message: "HayaNest BD Steadfast webhook endpoint is ready.",
  });
}

export async function POST(request: Request) {
  try {
    const settings = await getStoreSettings({ bypassCache: true });
    const configuredToken =
      settings.courier?.steadfastWebhookToken?.trim() ||
      process.env.STEADFAST_WEBHOOK_TOKEN?.trim() ||
      "";

    if (configuredToken) {
      const authHeader = request.headers.get("authorization") || "";
      const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : authHeader.trim();

      if (!bearerToken || !constantTimeMatch(bearerToken, configuredToken)) {
        return NextResponse.json(
          { status: "error", message: "Unauthorized webhook bearer token." },
          { status: 401 },
        );
      }
    }

    const payload = (await request.json().catch(() => ({}))) as {
      consignment_id?: string | number;
      tracking_code?: string;
      invoice?: string;
      status?: string;
      delivery_status?: string;
      tracking_message?: string;
      notification_type?: string;
    };

    const result = await applySteadfastWebhook(payload);

    return NextResponse.json({
      status: "success",
      matched: result.matched,
      orderId: result.orderId,
      message: result.message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Steadfast webhook error.";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
