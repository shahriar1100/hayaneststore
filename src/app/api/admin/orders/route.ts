import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server/admin-auth";
import {
  getAllStoreOrders,
  updateStoreOrder,
  type AdminDeliveryStatus,
  type AdminOrderStatus,
  type AdminPaymentStatus,
} from "@/lib/server/store-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orders = await getAllStoreOrders();
  return NextResponse.json({ orders });
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      status?: AdminOrderStatus;
      paymentStatus?: AdminPaymentStatus;
      deliveryStatus?: AdminDeliveryStatus;
      refundAmount?: number;
    };
    if (!body.id) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    }
    const result = await updateStoreOrder({
      id: body.id,
      status: body.status,
      paymentStatus: body.paymentStatus,
      deliveryStatus: body.deliveryStatus,
      refundAmount: body.refundAmount,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update order.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
