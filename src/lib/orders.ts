"use client";

import { useSyncExternalStore } from "react";
import type { CourierProvider, FulfillmentSource } from "@/types/store";

export const ORDERS_STORAGE_KEY = "noor-orders";
export type OrderDeliveryZone = "inside-dhaka" | "outside-dhaka";
export type OrderPaymentMethod = "cod" | "bkash" | "nagad";

export type OrderStatus =
  | "Pending"
  | "Confirmed"
  | "Processing"
  | "Shipped"
  | "Delivered"
  | "Cancelled"
  | "Returned"
  | "Refunded";

export type OrderItem = {
  id: string;
  slug: string;
  name: string;
  price: number;
  quantity: number;
  colour?: string;
  photo: { src: string; alt: string };
  fulfillmentSource?: FulfillmentSource;
  pickupHubId?: string;
  pickupHubName?: string;
};

export type OrderDeliveryState =
  | "Pending Dispatch"
  | "In Transit"
  | "Out for Delivery"
  | "Delivered"
  | "Returned"
  | "Cancelled";

export type OrderShipmentItemRef = {
  id: string;
  slug?: string;
  name: string;
  colour?: string;
  quantity: number;
  unitPrice: number;
};

export type OrderShipment = {
  id: string;
  label: string;
  fulfillmentSource: FulfillmentSource;
  pickupHubId?: string;
  pickupHubName?: string;
  pickupAddress?: string;
  pickupPhone?: string;
  courierProvider?: CourierProvider | "manual";
  pathaoStoreId?: string;
  consignmentId?: string;
  trackingCode?: string;
  invoiceRef?: string;
  codAmount: number;
  deliveryFee?: number;
  items: OrderShipmentItemRef[];
  deliveryStatus: OrderDeliveryState;
  courierRawStatus?: string;
  courierTrackingMessage?: string;
  dispatchedAt?: string;
  updatedAt?: string;
};

export type Order = {
  id: string;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    city: string;
    notes?: string;
  };
  deliveryZone: OrderDeliveryZone;
  paymentMethod: OrderPaymentMethod;
  paymentPhone?: string;
  paymentTrxId?: string;
  items: OrderItem[];
  subtotal: number;
  discountAmount?: number;
  couponCode?: string | null;
  shippingFee: number;
  total: number;
  status: OrderStatus;
  paymentStatus?: "Paid" | "Pending" | "Failed" | "Refunded" | "Partially Refunded";
  deliveryStatus?: OrderDeliveryState;
  courierProvider?: CourierProvider | "manual";
  courierTrackingCode?: string;
  courierConsignmentId?: string;
  courierRawStatus?: string;
  courierTrackingMessage?: string;
  shipments?: OrderShipment[];
};

type OrdersState = { orders: readonly Order[]; ready: boolean; persistent: boolean };
const serverState: OrdersState = { orders: [], ready: false, persistent: true };
let state = serverState;
let lastRaw: string | null | undefined;
const listeners = new Set<() => void>();

function parse(raw: string | null): Order[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Order =>
      Boolean(item && typeof item === "object" && "id" in item && "items" in item),
    );
  } catch {
    return [];
  }
}

function snapshot(): OrdersState {
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!state.ready || raw !== lastRaw) {
      lastRaw = raw;
      state = { orders: parse(raw), ready: true, persistent: true };
    }
  } catch {
    state = { ...state, ready: true, persistent: false };
  }
  return state;
}

function write(orders: readonly Order[]) {
  const next = { orders, ready: true, persistent: true };
  try {
    const raw = JSON.stringify(orders);
    localStorage.setItem(ORDERS_STORAGE_KEY, raw);
    lastRaw = raw;
  } catch {
    next.persistent = false;
  }
  state = next;
  listeners.forEach((listener) => listener());
  return next;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === ORDERS_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function placeOrder(
  input: Omit<Order, "id" | "createdAt" | "status"> & { status?: OrderStatus },
) {
  const current = snapshot();
  const code = String(Date.now()).slice(-6);

  // All new orders (COD as well as manual bKash / Nagad Send Money) start as Pending
  // until Admin verifies payment / confirms the order.
  const initialStatus: OrderStatus = input.status ?? "Pending";
  const initialPaymentStatus: NonNullable<Order["paymentStatus"]> = "Pending";

  const order: Order = {
    ...input,
    id: `HN-${code}`,
    createdAt: new Date().toISOString(),
    status: initialStatus,
    paymentStatus: input.paymentStatus ?? initialPaymentStatus,
    deliveryStatus: input.deliveryStatus ?? "Pending Dispatch",
  };

  const result = write([order, ...current.orders]);
  const syncPromise =
    typeof window !== "undefined"
      ? fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(order),
        })
          .then(async (res) => {
            if (!res.ok) {
              const errData = (await res.json().catch(() => ({}))) as { error?: string };
              return { ok: false as const, error: errData.error || "Could not place order." };
            }
            const data = (await res.json().catch(() => ({}))) as { order?: Order };
            if (data.order) {
              const latest = snapshot();
              write(latest.orders.map((o) => (o.id === order.id ? data.order! : o)));
            }
            return { ok: true as const, order: data.order ?? order };
          })
          .catch(() => ({ ok: true as const, order }))
      : Promise.resolve({ ok: true as const, order });

  return { order, persistent: result.persistent, syncPromise };
}

export function removeLocalOrder(orderId: string) {
  const current = snapshot();
  write(current.orders.filter((o) => o.id !== orderId));
}

export type OrderStatusTransition = {
  order: Order;
  previousStatus: OrderStatus;
  previousPaymentStatus?: Order["paymentStatus"];
};

export async function syncCustomerOrders(customerFilter?: {
  phone?: string;
  email?: string;
}): Promise<OrderStatusTransition[]> {
  if (typeof window === "undefined") return [];
  const current = snapshot();

  let sessionPhone = customerFilter?.phone ?? "";
  let sessionEmail = customerFilter?.email ?? "";

  if (!sessionPhone && !sessionEmail) {
    try {
      const rawSession = window.localStorage.getItem("noor:auth-user:v1");
      if (rawSession) {
        const parsedSession = JSON.parse(rawSession) as { phone?: string; email?: string };
        sessionPhone = parsedSession.phone?.trim() ?? "";
        sessionEmail = parsedSession.email?.trim() ?? "";
      }
    } catch {
      // Ignore storage read error
    }
  }

  const ids = current.orders.map((o) => o.id).join(",");
  if (!ids && !sessionPhone && !sessionEmail) return [];

  try {
    const params = new URLSearchParams();
    if (ids) params.set("ids", ids);
    if (sessionPhone) params.set("phone", sessionPhone);
    if (sessionEmail) params.set("email", sessionEmail);

    const response = await fetch(`/api/orders?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { ok: boolean; orders?: Order[] };
    if (!data.ok || !Array.isArray(data.orders)) return [];

    const serverMap = new Map<string, Order>();
    for (const serverOrder of data.orders) {
      serverMap.set(serverOrder.id, serverOrder);
    }

    let hasChanges = false;
    const transitions: OrderStatusTransition[] = [];
    const localIdSet = new Set(current.orders.map((o) => o.id));

    const updated = current.orders.map((localOrder) => {
      const serverMatch = serverMap.get(localOrder.id);
      const shipmentsChanged =
        Boolean(serverMatch) &&
        JSON.stringify(serverMatch?.shipments ?? null) !== JSON.stringify(localOrder.shipments ?? null);
      if (
        serverMatch &&
        (serverMatch.status !== localOrder.status ||
          serverMatch.paymentStatus !== localOrder.paymentStatus ||
          serverMatch.deliveryStatus !== localOrder.deliveryStatus ||
          serverMatch.courierProvider !== localOrder.courierProvider ||
          serverMatch.courierTrackingCode !== localOrder.courierTrackingCode ||
          serverMatch.courierConsignmentId !== localOrder.courierConsignmentId ||
          serverMatch.courierRawStatus !== localOrder.courierRawStatus ||
          serverMatch.courierTrackingMessage !== localOrder.courierTrackingMessage ||
          serverMatch.paymentTrxId !== localOrder.paymentTrxId ||
          serverMatch.paymentPhone !== localOrder.paymentPhone ||
          shipmentsChanged)
      ) {
        hasChanges = true;
        const nextOrder: Order = {
          ...localOrder,
          items: Array.isArray(serverMatch.items) && serverMatch.items.length > 0 ? serverMatch.items : localOrder.items,
          status: serverMatch.status,
          paymentStatus: serverMatch.paymentStatus ?? localOrder.paymentStatus,
          deliveryStatus: serverMatch.deliveryStatus ?? localOrder.deliveryStatus,
          paymentPhone: serverMatch.paymentPhone ?? localOrder.paymentPhone,
          paymentTrxId: serverMatch.paymentTrxId ?? localOrder.paymentTrxId,
          courierProvider: serverMatch.courierProvider ?? localOrder.courierProvider,
          courierTrackingCode: serverMatch.courierTrackingCode ?? localOrder.courierTrackingCode,
          courierConsignmentId: serverMatch.courierConsignmentId ?? localOrder.courierConsignmentId,
          courierRawStatus: serverMatch.courierRawStatus ?? localOrder.courierRawStatus,
          courierTrackingMessage: serverMatch.courierTrackingMessage ?? localOrder.courierTrackingMessage,
          shipments: serverMatch.shipments ?? localOrder.shipments,
        };
        if (
          serverMatch.status !== localOrder.status ||
          serverMatch.paymentStatus !== localOrder.paymentStatus
        ) {
          transitions.push({
            order: nextOrder,
            previousStatus: localOrder.status,
            previousPaymentStatus: localOrder.paymentStatus,
          });
        }
        return nextOrder;
      }
      return localOrder;
    });

    // Merge any orders found on the server for this customer's phone/email that were placed on another device
    for (const serverOrder of data.orders) {
      if (!localIdSet.has(serverOrder.id)) {
        updated.push(serverOrder);
        localIdSet.add(serverOrder.id);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      updated.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      write(updated);
    }
    return transitions;
  } catch {
    // Offline or network error; keep existing orders
    return [];
  }
}

export function useOrders() {
  return useSyncExternalStore(subscribe, snapshot, () => serverState);
}
