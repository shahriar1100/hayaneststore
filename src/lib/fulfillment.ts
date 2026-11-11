import type {
  CourierConfig,
  CourierProvider,
  FulfillmentSource,
  PickupHubConfig,
} from "@/types/store";
import type {
  Order,
  OrderDeliveryState,
  OrderItem,
  OrderShipment,
  OrderStatus,
} from "./orders";

export function getDefaultPickupHubs(options?: {
  contactLocation?: string;
  contactPhone?: string;
  pathaoStoreId?: string;
  defaultInHouseCourier?: CourierProvider;
  defaultSupplierCourier?: CourierProvider;
}): PickupHubConfig[] {
  return [
    {
      id: "own-main",
      name: "My Own Stock (Direct Parcel)",
      source: "in-house",
      contactName: "HayaNest Store Dispatch",
      phone: options?.contactPhone?.trim() || "",
      address: options?.contactLocation?.trim() || "Dhaka, Bangladesh",
      preferredCourier: options?.defaultInHouseCourier ?? "steadfast",
      pathaoStoreId: options?.pathaoStoreId?.trim() || "",
      steadfastPickupNote: "",
      isDefault: true,
    },
    {
      id: "supplier-main",
      name: "Supplier Dropship Hub (Direct from Supplier)",
      source: "supplier",
      contactName: "Partner Supplier",
      phone: "",
      address: "Supplier Warehouse / Shop Address",
      preferredCourier: options?.defaultSupplierCourier ?? "pathao",
      pathaoStoreId: "",
      steadfastPickupNote: "Pickup directly from Supplier Hub",
      isDefault: true,
    },
  ];
}

export function resolveItemFulfillmentSource(item: Pick<OrderItem, "fulfillmentSource">): FulfillmentSource {
  return item.fulfillmentSource === "supplier" ? "supplier" : "in-house";
}

export function resolvePickupHubForSource(
  hubs: PickupHubConfig[] | undefined,
  source: FulfillmentSource,
  pickupHubId?: string,
  courierConfig?: Partial<CourierConfig>,
): PickupHubConfig {
  const list =
    Array.isArray(hubs) && hubs.length > 0
      ? hubs
      : getDefaultPickupHubs({
          pathaoStoreId: courierConfig?.pathaoStoreId,
          defaultInHouseCourier: courierConfig?.defaultInHouseCourier,
          defaultSupplierCourier: courierConfig?.defaultSupplierCourier,
        });

  if (pickupHubId) {
    const exact = list.find((h) => h.id === pickupHubId);
    if (exact) return exact;
  }

  const bySource =
    list.find((h) => h.source === source && h.isDefault) ??
    list.find((h) => h.source === source);

  if (bySource) return bySource;

  return (
    list[0] ??
    getDefaultPickupHubs({
      pathaoStoreId: courierConfig?.pathaoStoreId,
    })[source === "supplier" ? 1 : 0]
  );
}

export function getShipmentGroupKey(
  item: Pick<OrderItem, "fulfillmentSource" | "pickupHubId">,
  courierConfig?: Partial<CourierConfig>,
): string {
  const source = resolveItemFulfillmentSource(item);
  const hub = resolvePickupHubForSource(
    courierConfig?.pickupHubs,
    source,
    item.pickupHubId,
    courierConfig,
  );
  const explicitHubId = item.pickupHubId?.trim();
  const groupId =
    courierConfig?.pickupHubs?.length || !explicitHubId ? hub.id : explicitHubId;
  return `${source}::${groupId}`;
}

export function hasMixedFulfillmentItems(
  items: readonly Pick<OrderItem, "fulfillmentSource" | "pickupHubId">[],
  courierConfig?: Partial<CourierConfig>,
): boolean {
  if (!items || items.length <= 1) return false;
  const keys = new Set(items.map((item) => getShipmentGroupKey(item, courierConfig)));
  return keys.size > 1;
}

export function buildOrderShipments(
  order: Pick<
    Order,
    | "id"
    | "items"
    | "subtotal"
    | "discountAmount"
    | "shippingFee"
    | "total"
    | "status"
    | "paymentStatus"
    | "deliveryStatus"
    | "courierProvider"
    | "courierTrackingCode"
    | "courierConsignmentId"
    | "courierRawStatus"
    | "courierTrackingMessage"
    | "shipments"
  >,
  courierConfig?: Partial<CourierConfig>,
  options?: { forceRebuild?: boolean; combineSingle?: boolean },
): OrderShipment[] {
  if (
    !options?.forceRebuild &&
    !options?.combineSingle &&
    Array.isArray(order.shipments) &&
    order.shipments.length > 0
  ) {
    return order.shipments;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) return [];

  if (options?.combineSingle) {
    const primaryHub = resolvePickupHubForSource(
      courierConfig?.pickupHubs,
      "in-house",
      undefined,
      courierConfig,
    );
    const preferredProvider =
      order.courierProvider && order.courierProvider !== "manual"
        ? order.courierProvider
        : primaryHub.preferredCourier || courierConfig?.defaultInHouseCourier || courierConfig?.provider || "steadfast";
    return [
      {
        id: "PKG-1",
        label: `Parcel 1 · Combined (${primaryHub.name})`,
        fulfillmentSource: "in-house",
        pickupHubId: primaryHub.id,
        pickupHubName: primaryHub.name,
        pickupAddress: primaryHub.address,
        pickupPhone: primaryHub.phone,
        courierProvider: preferredProvider,
        pathaoStoreId: primaryHub.pathaoStoreId || courierConfig?.pathaoStoreId || undefined,
        consignmentId: order.courierConsignmentId,
        trackingCode: order.courierTrackingCode,
        invoiceRef: order.id,
        codAmount: order.paymentStatus === "Paid" ? 0 : Math.max(0, Math.round(Number(order.total ?? 0))),
        items: items.map((it) => ({
          id: it.id,
          slug: it.slug,
          name: it.name,
          colour: it.colour,
          quantity: Math.max(1, Number(it.quantity ?? 1)),
          unitPrice: Number(it.price ?? 0),
        })),
        deliveryStatus: order.deliveryStatus ?? "Pending Dispatch",
        courierRawStatus: order.courierRawStatus,
        courierTrackingMessage: order.courierTrackingMessage,
      },
    ];
  }

  type Bucket = {
    key: string;
    source: FulfillmentSource;
    hub: PickupHubConfig;
    items: OrderItem[];
    itemsSubtotal: number;
  };

  const buckets = new Map<string, Bucket>();
  for (const item of items) {
    const source = resolveItemFulfillmentSource(item);
    const hub = resolvePickupHubForSource(
      courierConfig?.pickupHubs,
      source,
      item.pickupHubId,
      courierConfig,
    );
    const key = `${source}::${hub.id}`;
    const lineTotal = Math.max(0, Number(item.price ?? 0)) * Math.max(1, Number(item.quantity ?? 1));
    const existing = buckets.get(key);
    if (existing) {
      existing.items.push(item);
      existing.itemsSubtotal += lineTotal;
    } else {
      buckets.set(key, {
        key,
        source,
        hub,
        items: [item],
        itemsSubtotal: lineTotal,
      });
    }
  }

  // Sort so "in-house" parcel always leads as Parcel 1 (carries shipping fee naturally)
  const bucketList = Array.from(buckets.values()).sort((a, b) => {
    if (a.source === b.source) return 0;
    return a.source === "in-house" ? -1 : 1;
  });

  const isPaid = order.paymentStatus === "Paid";
  const orderSubtotal = Math.max(
    1,
    bucketList.reduce((acc, b) => acc + b.itemsSubtotal, 0) || Number(order.subtotal ?? 1),
  );
  const targetCodTotal = isPaid ? 0 : Math.max(0, Math.round(Number(order.total ?? 0)));
  const totalDiscount = Math.max(0, Number(order.discountAmount ?? 0));
  const shippingFee = Math.max(0, Number(order.shippingFee ?? 0));

  // Distribute COD amount proportionally so sum(parcel.codAmount) === targetCodTotal
  const codAmounts = bucketList.map((b, idx) => {
    if (isPaid || targetCodTotal === 0) return 0;
    const discountShare = (b.itemsSubtotal / orderSubtotal) * totalDiscount;
    const netItems = Math.max(0, b.itemsSubtotal - discountShare);
    const shippingShare = idx === 0 ? shippingFee : 0;
    return Math.max(0, Math.round(netItems + shippingShare));
  });

  if (!isPaid && bucketList.length > 0 && targetCodTotal > 0) {
    const allocatedSum = codAmounts.reduce((sum, n) => sum + n, 0);
    const diff = targetCodTotal - allocatedSum;
    if (diff !== 0) {
      codAmounts[0] = Math.max(0, codAmounts[0] + diff);
    }
  }

  const totalParcels = bucketList.length;
  return bucketList.map((bucket, idx) => {
    const pkgId = `PKG-${idx + 1}`;
    const invoiceRef = totalParcels > 1 ? `${order.id}-P${idx + 1}` : order.id;

    const legacySingle = totalParcels === 1 && idx === 0;
    const defaultCourier =
      (legacySingle && order.courierProvider ? order.courierProvider : undefined) ??
      bucket.hub.preferredCourier ??
      (bucket.source === "supplier"
        ? courierConfig?.defaultSupplierCourier ||
          (courierConfig?.pathaoEnabled ? "pathao" : "steadfast")
        : courierConfig?.defaultInHouseCourier || courierConfig?.provider || "steadfast");

    const sourceTag = bucket.source === "supplier" ? "Supplier Pickup" : "Own Stock";
    const label =
      totalParcels > 1
        ? `Parcel ${idx + 1}/${totalParcels} · ${bucket.hub.name || sourceTag}`
        : `${bucket.hub.name || sourceTag}`;

    return {
      id: pkgId,
      label,
      fulfillmentSource: bucket.source,
      pickupHubId: bucket.hub.id,
      pickupHubName: bucket.hub.name,
      pickupAddress: bucket.hub.address,
      pickupPhone: bucket.hub.phone,
      courierProvider: defaultCourier,
      pathaoStoreId:
        bucket.hub.pathaoStoreId ||
        (bucket.source === "in-house" ? courierConfig?.pathaoStoreId : "") ||
        undefined,
      consignmentId: legacySingle ? order.courierConsignmentId : undefined,
      trackingCode: legacySingle ? order.courierTrackingCode : undefined,
      invoiceRef,
      codAmount: codAmounts[idx] ?? 0,
      items: bucket.items.map((it) => ({
        id: it.id,
        slug: it.slug,
        name: it.name,
        colour: it.colour,
        quantity: Math.max(1, Number(it.quantity ?? 1)),
        unitPrice: Number(it.price ?? 0),
      })),
      deliveryStatus: legacySingle
        ? (order.deliveryStatus ?? "Pending Dispatch")
        : "Pending Dispatch",
      courierRawStatus: legacySingle ? order.courierRawStatus : undefined,
      courierTrackingMessage: legacySingle ? order.courierTrackingMessage : undefined,
    };
  });
}

export function reconcileOrderFromShipments(
  current: {
    status: OrderStatus;
    paymentMethod: Order["paymentMethod"];
    paymentStatus?: Order["paymentStatus"];
    deliveryStatus?: OrderDeliveryState;
    courierProvider?: Order["courierProvider"];
    courierTrackingCode?: string;
    courierConsignmentId?: string;
    courierRawStatus?: string;
    courierTrackingMessage?: string;
  },
  shipments: OrderShipment[],
): {
  status: OrderStatus;
  deliveryStatus: OrderDeliveryState;
  paymentStatus?: Order["paymentStatus"];
  courierProvider?: Order["courierProvider"];
  courierTrackingCode?: string;
  courierConsignmentId?: string;
  courierRawStatus?: string;
  courierTrackingMessage?: string;
} {
  if (!Array.isArray(shipments) || shipments.length === 0) {
    return {
      status: current.status,
      deliveryStatus: current.deliveryStatus ?? "Pending Dispatch",
      paymentStatus: current.paymentStatus,
      courierProvider: current.courierProvider,
      courierTrackingCode: current.courierTrackingCode,
      courierConsignmentId: current.courierConsignmentId,
      courierRawStatus: current.courierRawStatus,
      courierTrackingMessage: current.courierTrackingMessage,
    };
  }

  const primaryDispatched =
    shipments.find((s) => Boolean(s.trackingCode || s.consignmentId)) ?? shipments[0];

  const states = shipments.map((s) => s.deliveryStatus);
  const allDelivered = states.every((st) => st === "Delivered");
  const allCancelled = states.every((st) => st === "Cancelled");
  const allClosedReturn =
    states.some((st) => st === "Returned") &&
    states.every((st) => st === "Returned" || st === "Cancelled");
  const anyOutForDelivery = states.some((st) => st === "Out for Delivery");
  const anyDispatchedOrActive = shipments.some(
    (s) =>
      s.deliveryStatus === "In Transit" ||
      s.deliveryStatus === "Out for Delivery" ||
      s.deliveryStatus === "Delivered" ||
      Boolean(s.trackingCode || s.consignmentId),
  );

  let nextStatus: OrderStatus = current.status;
  let nextDeliveryStatus: OrderDeliveryState = current.deliveryStatus ?? "Pending Dispatch";
  let nextPaymentStatus = current.paymentStatus;

  if (allDelivered) {
    nextStatus = "Delivered";
    nextDeliveryStatus = "Delivered";
    if (current.paymentMethod === "cod" && nextPaymentStatus !== "Refunded") {
      nextPaymentStatus = "Paid";
    }
  } else if (allCancelled) {
    nextStatus = "Cancelled";
    nextDeliveryStatus = "Cancelled";
  } else if (allClosedReturn) {
    nextStatus = "Returned";
    nextDeliveryStatus = "Returned";
  } else if (anyOutForDelivery) {
    nextStatus = "Shipped";
    nextDeliveryStatus = "Out for Delivery";
  } else if (anyDispatchedOrActive) {
    nextStatus = "Shipped";
    nextDeliveryStatus = "In Transit";
  } else if (
    current.status === "Cancelled" ||
    current.status === "Returned" ||
    current.status === "Refunded"
  ) {
    nextDeliveryStatus =
      current.status === "Cancelled"
        ? "Cancelled"
        : current.status === "Returned"
          ? "Returned"
          : current.deliveryStatus ?? "Pending Dispatch";
  } else {
    nextDeliveryStatus = "Pending Dispatch";
    if (
      current.status !== "Pending" &&
      current.status !== "Confirmed" &&
      current.status !== "Processing"
    ) {
      nextStatus = "Confirmed";
    }
  }

  return {
    status: nextStatus,
    deliveryStatus: nextDeliveryStatus,
    paymentStatus: nextPaymentStatus,
    courierProvider: primaryDispatched?.courierProvider ?? current.courierProvider,
    courierTrackingCode: primaryDispatched?.trackingCode ?? current.courierTrackingCode,
    courierConsignmentId: primaryDispatched?.consignmentId ?? current.courierConsignmentId,
    courierRawStatus: primaryDispatched?.courierRawStatus ?? current.courierRawStatus,
    courierTrackingMessage: primaryDispatched?.courierTrackingMessage ?? current.courierTrackingMessage,
  };
}

export function getCourierTrackingUrl(
  provider?: CourierProvider | "manual" | null,
  trackingCode?: string | null,
  consignmentId?: string | null,
): string | null {
  if (provider === "steadfast") {
    const code = (trackingCode || consignmentId || "").trim();
    if (!code) return null;
    return `https://steadfast.com.bd/t/${encodeURIComponent(code)}`;
  }
  if (provider === "pathao") {
    if (!consignmentId && !trackingCode) return null;
    return "https://merchant.pathao.com/";
  }
  return null;
}
