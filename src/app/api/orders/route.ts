import { NextResponse } from "next/server";
import type { Order } from "@/lib/orders";
import { getAdminSession } from "@/lib/server/admin-auth";
import {
  getStoreOrdersByCustomer,
  getStoreSettings,
  recordCustomerOrder,
} from "@/lib/server/store-repository";
import { sendOrderConfirmationEmail, sendAdminNewOrderNotification } from "@/lib/server/email";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawIds = searchParams.get("ids") ?? "";
    const phone = searchParams.get("phone") ?? undefined;
    const email = searchParams.get("email") ?? undefined;

    const ids = rawIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length === 0 && !phone && !email) {
      return NextResponse.json({ ok: true, orders: [] });
    }

    const orders = await getStoreOrdersByCustomer({ ids, phone, email });
    return NextResponse.json({ ok: true, orders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve orders.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const order = (await request.json()) as Order;
    if (!order?.id || !order?.customer?.name || !order?.customer?.phone) {
      return NextResponse.json({ error: "Invalid order payload." }, { status: 400 });
    }

    const adminSession = await getAdminSession();
    const isAdminPos = Boolean(adminSession);
    const paymentMethod = order.paymentMethod || "cod";

    if (paymentMethod !== "cod" && paymentMethod !== "bkash" && paymentMethod !== "nagad") {
      return NextResponse.json({ error: "Unsupported payment method." }, { status: 400 });
    }

    const cleanPaymentPhone = order.paymentPhone?.trim() || undefined;
    const cleanPaymentTrxId = order.paymentTrxId?.trim().toUpperCase() || undefined;

    if (!isAdminPos && (paymentMethod === "bkash" || paymentMethod === "nagad")) {
      const settings = await getStoreSettings({ bypassCache: true });
      const channel = settings.manualPayment?.[paymentMethod];
      const channelLabel = paymentMethod === "bkash" ? "bKash" : "Nagad";
      if (channel && !channel.enabled) {
        return NextResponse.json(
          { error: `${channelLabel} payment is currently unavailable. Please choose another payment method.` },
          { status: 400 },
        );
      }
      if (!cleanPaymentPhone || cleanPaymentPhone.replace(/\D/g, "").length < 6) {
        return NextResponse.json(
          { error: `Please enter the ${channelLabel} sender phone number you used to send money.` },
          { status: 400 },
        );
      }
      if (!cleanPaymentTrxId || cleanPaymentTrxId.length < 5) {
        return NextResponse.json(
          { error: `Please enter a valid ${channelLabel} Transaction ID (TrxID).` },
          { status: 400 },
        );
      }
    }

    const sanitizedOrder: Order = {
      ...order,
      paymentMethod,
      paymentPhone: cleanPaymentPhone,
      paymentTrxId: cleanPaymentTrxId,
      status: isAdminPos ? (order.status ?? "Confirmed") : "Pending",
      paymentStatus: isAdminPos ? (order.paymentStatus ?? "Pending") : "Pending",
      deliveryStatus: isAdminPos ? (order.deliveryStatus ?? "Pending Dispatch") : "Pending Dispatch",
    };

    const result = await recordCustomerOrder(sanitizedOrder);

    // Trigger confirmation email in the background without blocking the checkout response
    if (result.order.customer?.email && result.order.customer.email.includes("@")) {
      void sendOrderConfirmationEmail({ order: result.order, to: result.order.customer.email }).catch(() => {});
    }
    void sendAdminNewOrderNotification({ order: result.order }).catch(() => {});

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record order.";
    const isStockError =
      message.toLowerCase().includes("stock") ||
      message.toLowerCase().includes("unavailable") ||
      message.includes("স্টক");
    return NextResponse.json({ error: message }, { status: isStockError ? 400 : 500 });
  }
}
