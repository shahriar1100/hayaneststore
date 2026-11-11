import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server/admin-auth";
import { dispatchOrderToCourier, rebuildOrderShipments } from "@/lib/server/courier";
import type { CourierProvider } from "@/types/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: "dispatch" | "split-auto" | "combine-single";
      orderId?: string;
      shipmentId?: string;
      courierProvider?: CourierProvider | "manual";
      pickupHubId?: string;
      pathaoStoreId?: string;
      codAmountOverride?: number;
      noteOverride?: string;
      manualTrackingCode?: string;
      dispatchAllPending?: boolean;
    };

    const orderId = body.orderId?.trim();
    if (!orderId) {
      return NextResponse.json({ ok: false, error: "Order ID is required." }, { status: 400 });
    }

    if (body.action === "split-auto" || body.action === "combine-single") {
      const rebuilt = await rebuildOrderShipments(orderId, body.action);
      if (!rebuilt.ok) {
        return NextResponse.json(
          { ok: false, success: false, message: rebuilt.message, error: rebuilt.message },
          { status: 400 },
        );
      }
      return NextResponse.json({
        ...rebuilt,
        success: true,
      });
    }

    const result = await dispatchOrderToCourier({
      orderId,
      shipmentId: body.shipmentId?.trim() || undefined,
      courierProvider: body.courierProvider,
      pickupHubId: body.pickupHubId?.trim() || undefined,
      pathaoStoreId: body.pathaoStoreId?.trim() || undefined,
      codAmountOverride: body.codAmountOverride,
      noteOverride: body.noteOverride,
      manualTrackingCode: body.manualTrackingCode,
      dispatchAllPending: Boolean(body.dispatchAllPending),
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, success: false, message: result.message, error: result.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ...result,
      success: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to dispatch order to courier.";
    return NextResponse.json({ ok: false, success: false, message, error: message }, { status: 500 });
  }
}
