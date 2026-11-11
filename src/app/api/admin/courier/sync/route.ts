import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server/admin-auth";
import { syncOrderCourierStatuses } from "@/lib/server/courier";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      orderId?: string;
      shipmentId?: string;
    };
    const orderId = body.orderId?.trim();
    if (!orderId) {
      return NextResponse.json({ ok: false, error: "Order ID is required." }, { status: 400 });
    }

    const res = await syncOrderCourierStatuses(orderId, body.shipmentId?.trim() || undefined);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync courier status.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
