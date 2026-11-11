import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { applyPathaoWebhook } from "@/lib/server/courier";
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
    provider: "pathao",
    message: "HayaNest BD Pathao webhook endpoint is ready.",
  });
}

export async function POST(request: Request) {
  try {
    const settings = await getStoreSettings({ bypassCache: true });
    const configuredSecret =
      settings.courier?.pathaoWebhookSecret?.trim() ||
      process.env.PATHAO_WEBHOOK_SECRET?.trim() ||
      "";

    const incomingSignature =
      request.headers.get("x-pathao-signature")?.trim() ||
      request.headers.get("x-pathao-merchant-webhook-integration-secret")?.trim() ||
      "";

    if (configuredSecret) {
      if (!incomingSignature || !constantTimeMatch(incomingSignature, configuredSecret)) {
        return NextResponse.json(
          { status: "error", message: "Unauthorized Pathao webhook signature." },
          { status: 401 },
        );
      }
    }

    const payload = (await request.json().catch(() => ({}))) as {
      type?: string;
      event?: string;
      event_name?: string;
      consignment_id?: string;
      merchant_order_id?: string;
      order_status?: string;
      order_status_slug?: string;
      delivery_fee?: number;
    };

    const responseSecret = configuredSecret || incomingSignature;
    const responseHeaders: Record<string, string> = {};
    if (responseSecret) {
      responseHeaders["X-Pathao-Merchant-Webhook-Integration-Secret"] = responseSecret;
    }

    const isIntegrationHandshake =
      payload.type === "webhook_integration" ||
      payload.event === "webhook_integration" ||
      payload.event_name === "webhook_integration";

    if (isIntegrationHandshake) {
      return NextResponse.json(
        { status: "success", message: "Pathao webhook integration verified." },
        { status: 202, headers: responseHeaders },
      );
    }

    const result = await applyPathaoWebhook(payload);

    return NextResponse.json(
      {
        status: "success",
        matched: result.matched,
        orderId: result.orderId,
        message: result.message,
      },
      { status: 202, headers: responseHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pathao webhook error.";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
