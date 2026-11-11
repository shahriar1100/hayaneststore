import type {
  CourierConfig,
  CourierProvider,
  FraudCheckResult,
  PathaoStoreSummary,
} from "@/types/store";
import type { OrderDeliveryState, OrderShipment } from "@/lib/orders";
import { buildOrderShipments, resolvePickupHubForSource } from "@/lib/fulfillment";
import {
  findOrderByCourierReference,
  getAllStoreOrders,
  getStoreSettings,
  updateStoreOrder,
  type AdminOrderRecord,
} from "./store-repository";

const STEADFAST_BASE_URL = "https://portal.packzy.com/api/v1";
const PATHAO_LIVE_BASE_URL = "https://api-hermes.pathao.com";
const PATHAO_SANDBOX_BASE_URL = "https://courier-api-sandbox.pathao.com";

const PATHAO_TOKEN_CACHE_KEY = Symbol.for("hayanest.pathaoTokenCache");

type PathaoCachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

function getPathaoTokenCache(): Map<string, PathaoCachedToken> {
  const g = globalThis as typeof globalThis & {
    [PATHAO_TOKEN_CACHE_KEY]?: Map<string, PathaoCachedToken>;
  };
  if (!g[PATHAO_TOKEN_CACHE_KEY]) {
    g[PATHAO_TOKEN_CACHE_KEY] = new Map();
  }
  return g[PATHAO_TOKEN_CACHE_KEY];
}

function getPathaoBaseUrl(config?: Partial<CourierConfig>): string {
  return config?.testMode ? PATHAO_SANDBOX_BASE_URL : PATHAO_LIVE_BASE_URL;
}

/**
 * Normalizes Bangladeshi phone numbers into standard format: 01XXXXXXXXX
 */
export function normalizeBdPhoneNumber(rawPhone: string): string {
  if (!rawPhone) return "";
  let digits = rawPhone.replace(/\D/g, "");
  if (digits.startsWith("8801")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("88")) {
    digits = digits.slice(2);
  }
  if (digits.length > 11 && digits.endsWith("01" + digits.slice(-9))) {
    digits = digits.slice(-11);
  }
  return digits;
}

/**
 * Performs intelligent courier fraud checking by combining:
 * 1. Store's internal customer order history (delivered vs cancelled vs returned).
 * 2. Steadfast / BD Courier live delivery success rate (if API credentials configured).
 */
export async function checkCourierFraud(
  rawPhone: string,
  providedConfig?: CourierConfig,
): Promise<FraudCheckResult> {
  const phone = normalizeBdPhoneNumber(rawPhone);
  if (!phone || phone.length < 11) {
    return {
      phone: rawPhone,
      riskLevel: "unknown",
      notes: "Invalid or incomplete phone number.",
      source: "internal",
    };
  }

  // 1. Calculate Internal Order History
  const allOrders = await getAllStoreOrders();
  const matchingOrders = allOrders.filter(
    (o) => normalizeBdPhoneNumber(o.customer?.phone || "") === phone,
  );

  const internalTotal = matchingOrders.length;
  const internalDelivered = matchingOrders.filter((o) => o.status === "Delivered").length;
  const internalReturned = matchingOrders.filter(
    (o) => o.status === "Returned" || o.deliveryStatus === "Returned",
  ).length;
  const internalCancelled = matchingOrders.filter((o) => o.status === "Cancelled").length;

  const config = providedConfig ?? (await getStoreSettings({ bypassCache: true })).courier;

  // 2. Query Steadfast Courier Fraud API if credentials exist
  let steadfastData: {
    total?: number;
    delivered?: number;
    cancelled?: number;
    returned?: number;
  } | null = null;

  if (config?.steadfastApiKey && config?.steadfastSecretKey) {
    try {
      const res = await fetch(`${STEADFAST_BASE_URL}/fraud_check/${phone}`, {
        method: "GET",
        headers: {
          "Api-Key": config.steadfastApiKey.trim(),
          "Secret-Key": config.steadfastSecretKey.trim(),
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(4500),
      });

      if (res.ok) {
        const json = (await res.json()) as {
          status?: number;
          Total_parcels?: number;
          total_parcels?: number;
          total_delivered?: number;
          total_cancelled?: number;
          success_parcels?: number;
          cancelled_parcels?: number;
          returned_parcels?: number;
          data?: {
            Total_parcels?: number;
            total_parcels?: number;
            total_delivered?: number;
            total_cancelled?: number;
            success_parcels?: number;
            cancelled_parcels?: number;
            returned_parcels?: number;
          };
        };
        const payloadData = json?.data ?? json;
        const rawTotalParcels = payloadData?.total_parcels ?? payloadData?.Total_parcels;
        if (
          payloadData &&
          (rawTotalParcels !== undefined ||
            payloadData.total_delivered !== undefined ||
            payloadData.success_parcels !== undefined)
        ) {
          steadfastData = {
            total: Number(rawTotalParcels ?? 0),
            delivered: Number(payloadData.total_delivered ?? payloadData.success_parcels ?? 0),
            cancelled: Number(payloadData.total_cancelled ?? payloadData.cancelled_parcels ?? 0),
            returned: Number(payloadData.returned_parcels ?? 0),
          };
        }
      }
    } catch {
      // Steadfast API offline or rate-limited; fallback to internal history
    }
  }

  // 3. Synthesize Fraud Score
  if (steadfastData && (steadfastData.total ?? 0) > 0) {
    const total = (steadfastData.total ?? 0) + internalTotal;
    const delivered = (steadfastData.delivered ?? 0) + internalDelivered;
    const returned = (steadfastData.returned ?? 0) + internalReturned;
    const cancelled = (steadfastData.cancelled ?? 0) + internalCancelled;
    const rate = total > 0 ? Math.round((delivered / total) * 100) : 100;

    let riskLevel: FraudCheckResult["riskLevel"] = "safe";
    let notes = `Nationwide Delivery Rate: ${rate}% (${delivered}/${total} completed). Safe buyer.`;

    if (returned >= 3 || rate < 55) {
      riskLevel = "high";
      notes = `High return risk! ${returned} parcels returned previously (${rate}% success rate). Take delivery charge in advance!`;
    } else if (returned >= 1 || rate < 75) {
      riskLevel = "moderate";
      notes = `Moderate risk: ${returned} return(s) on record (${rate}% success rate). Confirm order by call before shipping.`;
    }

    return {
      phone,
      riskLevel,
      successRate: rate,
      totalParcels: total,
      deliveredParcels: delivered,
      cancelledParcels: cancelled,
      returnedParcels: returned,
      totalOrders: total,
      totalCancelled: cancelled + returned,
      storeOrdersCount: internalTotal,
      storeDeliveredCount: internalDelivered,
      storeCancelledCount: internalCancelled + internalReturned,
      courierTotalOrders: steadfastData.total ?? 0,
      courierSuccessOrders: steadfastData.delivered ?? 0,
      courierCancelledOrders: (steadfastData.cancelled ?? 0) + (steadfastData.returned ?? 0),
      notes,
      source: "combined",
    };
  }

  if (internalTotal > 0) {
    const rate = Math.round((internalDelivered / internalTotal) * 100);
    let riskLevel: FraudCheckResult["riskLevel"] = "safe";
    let notes = `Returning customer: ${internalDelivered}/${internalTotal} orders completed on this store.`;

    if (internalReturned >= 2) {
      riskLevel = "high";
      notes = `Warning: ${internalReturned} orders returned on this store. Take advance delivery fee.`;
    } else if (internalReturned === 1 || (internalCancelled >= 2 && internalDelivered === 0)) {
      riskLevel = "moderate";
      notes = `Caution: 1 order returned or cancelled previously. Call to verify.`;
    }

    return {
      phone,
      riskLevel,
      successRate: rate,
      totalParcels: internalTotal,
      deliveredParcels: internalDelivered,
      cancelledParcels: internalCancelled,
      returnedParcels: internalReturned,
      totalOrders: internalTotal,
      totalCancelled: internalCancelled + internalReturned,
      storeOrdersCount: internalTotal,
      storeDeliveredCount: internalDelivered,
      storeCancelledCount: internalCancelled + internalReturned,
      courierTotalOrders: 0,
      courierSuccessOrders: 0,
      courierCancelledOrders: 0,
      notes,
      source: "internal",
    };
  }

  return {
    phone,
    riskLevel: "safe",
    successRate: 100,
    totalParcels: 0,
    deliveredParcels: 0,
    cancelledParcels: 0,
    returnedParcels: 0,
    totalOrders: 0,
    totalCancelled: 0,
    storeOrdersCount: 0,
    storeDeliveredCount: 0,
    storeCancelledCount: 0,
    courierTotalOrders: 0,
    courierSuccessOrders: 0,
    courierCancelledOrders: 0,
    notes: "New customer with a clean record. No previous cancellations or returns detected.",
    source: "internal",
  };
}

// ============================================================================
// PATHAO ALADDIN API v1 CLIENT
// ============================================================================

async function getPathaoAccessToken(
  config: CourierConfig,
  options?: { forceRefresh?: boolean },
): Promise<{ ok: true; accessToken: string } | { ok: false; message: string }> {
  const clientId = config.pathaoClientId?.trim();
  const clientSecret = config.pathaoClientSecret?.trim();
  const username = config.pathaoUsername?.trim();
  const password = config.pathaoPassword?.trim();

  if (!clientId || !clientSecret || !username || !password) {
    return {
      ok: false,
      message:
        "Pathao API credentials incomplete. Enter Client ID, Client Secret, Merchant Email (Username), and Password in Admin -> Shipping.",
    };
  }

  const baseUrl = getPathaoBaseUrl(config);
  const cacheKey = `${baseUrl}::${clientId}::${username}`;
  const cache = getPathaoTokenCache();

  if (!options?.forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAtMs > Date.now() + 60_000) {
      return { ok: true, accessToken: cached.accessToken };
    }
  }

  try {
    const res = await fetch(`${baseUrl}/aladdin/api/v1/issue-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        username,
        password,
        grant_type: "password",
      }),
      signal: AbortSignal.timeout(8000),
    });

    const json = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      message?: string;
      error?: string;
    };

    if (!res.ok || !json.access_token) {
      return {
        ok: false,
        message:
          json.message ||
          json.error ||
          `Pathao authentication failed (HTTP ${res.status}). Check your Pathao API credentials & Sandbox/Live toggle.`,
      };
    }

    const ttlMs = Math.max(300, Number(json.expires_in ?? 3600)) * 1000;
    cache.set(cacheKey, {
      accessToken: json.access_token,
      expiresAtMs: Date.now() + ttlMs,
    });
    return { ok: true, accessToken: json.access_token };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error connecting to Pathao API.",
    };
  }
}

export async function fetchPathaoStores(
  providedConfig?: Partial<CourierConfig>,
): Promise<{ ok: boolean; stores?: PathaoStoreSummary[]; message: string }> {
  const saved = (await getStoreSettings({ bypassCache: true })).courier;
  const merged: CourierConfig = {
    ...(saved ?? {
      provider: "steadfast",
      enabled: false,
      autoFraudCheck: true,
    }),
    ...providedConfig,
  };

  const tokenRes = await getPathaoAccessToken(merged);
  if (!tokenRes.ok) {
    return { ok: false, message: tokenRes.message };
  }

  const baseUrl = getPathaoBaseUrl(merged);
  try {
    let res = await fetch(`${baseUrl}/aladdin/api/v1/stores`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenRes.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 401) {
      const retryToken = await getPathaoAccessToken(merged, { forceRefresh: true });
      if (!retryToken.ok) return { ok: false, message: retryToken.message };
      res = await fetch(`${baseUrl}/aladdin/api/v1/stores`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${retryToken.accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });
    }

    const json = (await res.json().catch(() => ({}))) as {
      message?: string;
      data?: { data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
    };

    if (!res.ok) {
      return {
        ok: false,
        message: json.message || `Failed to load Pathao pickup stores (HTTP ${res.status}).`,
      };
    }

    const rawList = Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.data?.data)
        ? json.data.data
        : [];

    const stores: PathaoStoreSummary[] = rawList
      .map((item) => ({
        storeId: Number(item.store_id ?? 0),
        storeName: String(item.store_name || "Pickup Store"),
        storeAddress: String(item.store_address || ""),
        isActive: item.is_active === 1 || item.is_active === true,
        isDefaultStore: Boolean(item.is_default_store),
      }))
      .filter((s) => s.storeId > 0);

    return {
      ok: true,
      stores,
      message:
        stores.length > 0
          ? `Connected to Pathao! Found ${stores.length} pickup store(s).`
          : "Connected to Pathao, but no pickup stores are created yet inside your Pathao Merchant Panel.",
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Error fetching Pathao stores.",
    };
  }
}

async function dispatchParcelViaSteadfast(params: {
  config: CourierConfig;
  invoice: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  codAmount: number;
  note: string;
}): Promise<{
  ok: boolean;
  trackingCode?: string;
  consignmentId?: string;
  rawStatus?: string;
  message: string;
}> {
  const apiKey = params.config.steadfastApiKey?.trim();
  const secretKey = params.config.steadfastSecretKey?.trim();
  if (!apiKey || !secretKey) {
    return {
      ok: false,
      message:
        "Steadfast API Key & Secret Key are not configured yet. Go to Admin -> Shipping to save your Steadfast credentials.",
    };
  }

  try {
    const response = await fetch(`${STEADFAST_BASE_URL}/create_order`, {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
        "Secret-Key": secretKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        invoice: params.invoice,
        recipient_name: params.recipientName || "Customer",
        recipient_phone: params.recipientPhone,
        recipient_address: (params.recipientAddress || "Dhaka, Bangladesh").slice(0, 245),
        cod_amount: Math.max(0, Math.round(params.codAmount)),
        note: params.note.slice(0, 250),
      }),
      signal: AbortSignal.timeout(8000),
    });

    const rawText = await response.text().catch(() => "");
    let data: {
      status?: number;
      message?: string;
      consignment?: {
        consignment_id?: string | number;
        tracking_code?: string;
        status?: string;
      };
      errors?: Record<string, string[]>;
    } = {};
    if (rawText) {
      try {
        data = JSON.parse(rawText) as typeof data;
      } catch {
        data = {};
      }
    }

    if (response.ok && data?.consignment) {
      const consignmentId = String(data.consignment.consignment_id || "");
      const trackingCode = String(data.consignment.tracking_code || consignmentId);
      return {
        ok: true,
        trackingCode,
        consignmentId,
        rawStatus: data.consignment.status || "in_review",
        message: `Booked on Steadfast! Tracking: ${trackingCode}`,
      };
    }

    const plainTextError = rawText && !rawText.trim().startsWith("{") ? rawText.trim().slice(0, 180) : "";
    const errorMsg =
      data?.message ||
      (data?.errors ? Object.values(data.errors).flat().join(", ") : "") ||
      plainTextError ||
      `Steadfast API error (${response.status}).`;
    const activationHint =
      /inactive|not active/i.test(errorMsg)
        ? " Contact Steadfast Support (09678-045045) to activate merchant parcel booking on your API account."
        : "";
    return { ok: false, message: `Steadfast Error: ${errorMsg}${activationHint}` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error contacting Steadfast.",
    };
  }
}

async function dispatchParcelViaPathao(params: {
  config: CourierConfig;
  storeId: string;
  merchantOrderId: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  amountToCollect: number;
  itemQuantity: number;
  itemDescription: string;
  specialInstruction: string;
}): Promise<{
  ok: boolean;
  trackingCode?: string;
  consignmentId?: string;
  deliveryFee?: number;
  rawStatus?: string;
  message: string;
}> {
  const numericStoreId = Number(params.storeId);
  if (!numericStoreId || Number.isNaN(numericStoreId) || numericStoreId <= 0) {
    return {
      ok: false,
      message:
        "Pathao Store ID is missing for this parcel/pickup hub. Fetch & assign your Pathao Store ID in Admin -> Shipping or enter it on the parcel before dispatching.",
    };
  }

  const tokenRes = await getPathaoAccessToken(params.config);
  if (!tokenRes.ok) {
    return { ok: false, message: tokenRes.message };
  }

  const baseUrl = getPathaoBaseUrl(params.config);
  let safeAddress = params.recipientAddress.trim();
  if (safeAddress.length < 10) {
    safeAddress = `${safeAddress || "Dhaka"}, Bangladesh`;
  }

  const payload = {
    store_id: numericStoreId,
    merchant_order_id: params.merchantOrderId,
    recipient_name: params.recipientName || "Customer",
    recipient_phone: params.recipientPhone,
    recipient_address: safeAddress.slice(0, 220),
    delivery_type: 48,
    item_type: 2,
    special_instruction: params.specialInstruction.slice(0, 250),
    item_quantity: Math.max(1, Math.round(params.itemQuantity)),
    item_weight: "0.5",
    item_description: params.itemDescription.slice(0, 240) || "Modest Wear Apparel",
    amount_to_collect: Math.max(0, Math.round(params.amountToCollect)),
  };

  try {
    let response = await fetch(`${baseUrl}/aladdin/api/v1/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenRes.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(9000),
    });

    if (response.status === 401) {
      const retry = await getPathaoAccessToken(params.config, { forceRefresh: true });
      if (!retry.ok) return { ok: false, message: retry.message };
      response = await fetch(`${baseUrl}/aladdin/api/v1/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${retry.accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(9000),
      });
    }

    const data = (await response.json().catch(() => ({}))) as {
      code?: number;
      message?: string;
      errors?: Record<string, string[]>;
      data?: {
        consignment_id?: string;
        merchant_order_id?: string;
        order_status?: string;
        delivery_fee?: number;
      };
    };

    if (response.ok && data?.data?.consignment_id) {
      const consignmentId = String(data.data.consignment_id);
      return {
        ok: true,
        consignmentId,
        trackingCode: consignmentId,
        deliveryFee: Number(data.data.delivery_fee ?? 0) || undefined,
        rawStatus: String(data.data.order_status || "Pending"),
        message: `Booked on Pathao (Store #${numericStoreId})! Consignment: ${consignmentId}`,
      };
    }

    const errorDetails = data?.errors
      ? Object.values(data.errors).flat().join(", ")
      : data?.message || `Pathao API error (${response.status}).`;
    return { ok: false, message: `Pathao Error: ${errorDetails}` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error contacting Pathao API.",
    };
  }
}

// ============================================================================
// UNIFIED SINGLE / SPLIT SHIPMENT DISPATCH & SYNC
// ============================================================================

export type DispatchCourierOptions = {
  orderId: string;
  shipmentId?: string;
  courierProvider?: CourierProvider | "manual";
  pickupHubId?: string;
  pathaoStoreId?: string;
  codAmountOverride?: number;
  noteOverride?: string;
  manualTrackingCode?: string;
  dispatchAllPending?: boolean;
};

export async function dispatchOrderToCourier(
  orderIdOrOptions: string | DispatchCourierOptions,
  providedConfig?: CourierConfig,
): Promise<{
  ok: boolean;
  trackingCode?: string;
  consignmentId?: string;
  shipment?: OrderShipment;
  shipments?: OrderShipment[];
  order?: AdminOrderRecord | null;
  message: string;
}> {
  const opts: DispatchCourierOptions =
    typeof orderIdOrOptions === "string" ? { orderId: orderIdOrOptions } : orderIdOrOptions;

  const allOrders = await getAllStoreOrders();
  const order = allOrders.find((o) => o.id === opts.orderId);
  if (!order) {
    return { ok: false, message: `Order #${opts.orderId} was not found.` };
  }

  const settings = await getStoreSettings({ bypassCache: true });
  const config = providedConfig ?? settings.courier;
  if (!config) {
    return { ok: false, message: "Courier settings are not configured." };
  }

  const baseShipments = buildOrderShipments(order, config);
  if (baseShipments.length === 0) {
    return { ok: false, message: `Order #${order.id} has no items to ship.` };
  }

  const targets = opts.dispatchAllPending
    ? baseShipments.filter((s) => !s.trackingCode && !s.consignmentId)
    : opts.shipmentId
      ? baseShipments.filter((s) => s.id === opts.shipmentId)
      : [baseShipments.find((s) => !s.trackingCode && !s.consignmentId) ?? baseShipments[0]];

  if (targets.length === 0) {
    return { ok: false, message: "All parcels in this order are already dispatched." };
  }

  const recipientPhone = normalizeBdPhoneNumber(order.customer?.phone || "");
  const recipientAddress = [order.customer?.address, order.customer?.city]
    .filter(Boolean)
    .join(", ");

  const updatedShipments = [...baseShipments];
  const dispatchedResults: OrderShipment[] = [];
  const messages: string[] = [];

  for (const target of targets) {
    const idx = updatedShipments.findIndex((s) => s.id === target.id);
    if (idx < 0) continue;

    if (target.trackingCode || target.consignmentId) {
      messages.push(`${target.id} already dispatched (${target.trackingCode || target.consignmentId}).`);
      continue;
    }

    const effectiveHub = opts.pickupHubId
      ? resolvePickupHubForSource(config.pickupHubs, target.fulfillmentSource, opts.pickupHubId, config)
      : resolvePickupHubForSource(config.pickupHubs, target.fulfillmentSource, target.pickupHubId, config);

    const provider =
      opts.courierProvider ??
      target.courierProvider ??
      effectiveHub.preferredCourier ??
      config.provider ??
      "steadfast";

    const codAmount =
      opts.codAmountOverride !== undefined && !Number.isNaN(Number(opts.codAmountOverride))
        ? Math.max(0, Math.round(Number(opts.codAmountOverride)))
        : order.paymentStatus === "Paid"
          ? 0
          : Math.max(0, Math.round(target.codAmount));

    const itemSummary = target.items
      .map((it) => `${it.quantity}x ${it.name}${it.colour ? ` (${it.colour})` : ""}`)
      .join(", ");

    const pickupParts = [
      effectiveHub.source === "supplier"
        ? `SUPPLIER PICKUP (${effectiveHub.name}${effectiveHub.phone ? ` · ${effectiveHub.phone}` : ""}): ${effectiveHub.address}`
        : "",
      effectiveHub.steadfastPickupNote || "",
      opts.noteOverride?.trim() || order.customer?.notes?.trim() || "",
      `Items: ${itemSummary}`,
    ].filter(Boolean);
    const combinedNote = pickupParts.join(" | ") || "HayaNest BD Modest Wear Delivery";

    if (provider === "manual") {
      const manualCode = opts.manualTrackingCode?.trim();
      if (!manualCode) {
        return {
          ok: false,
          message: "Please enter a manual tracking / consignment code to mark as dispatched.",
        };
      }
      const nextPkg: OrderShipment = {
        ...target,
        pickupHubId: effectiveHub.id,
        pickupHubName: effectiveHub.name,
        pickupAddress: effectiveHub.address,
        pickupPhone: effectiveHub.phone,
        courierProvider: "manual",
        codAmount,
        trackingCode: manualCode,
        consignmentId: manualCode,
        deliveryStatus: "In Transit",
        courierRawStatus: "manual_dispatched",
        courierTrackingMessage: combinedNote,
        dispatchedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedShipments[idx] = nextPkg;
      dispatchedResults.push(nextPkg);
      messages.push(`${target.id} manual tracking saved (${manualCode})`);
      continue;
    }

    if (provider === "pathao") {
      if (!recipientPhone || recipientPhone.length < 11) {
        return { ok: false, message: "Customer phone number must be 11 digits (01XXXXXXXXX) for Pathao Courier dispatch." };
      }
      const storeIdToUse =
        opts.pathaoStoreId?.trim() ||
        target.pathaoStoreId?.trim() ||
        effectiveHub.pathaoStoreId?.trim() ||
        config.pathaoStoreId?.trim() ||
        "";

      const pathaoRes = await dispatchParcelViaPathao({
        config,
        storeId: storeIdToUse,
        merchantOrderId: target.invoiceRef || order.id,
        recipientName: order.customer?.name || "Customer",
        recipientPhone,
        recipientAddress,
        amountToCollect: codAmount,
        itemQuantity: target.items.reduce((s, it) => s + it.quantity, 0),
        itemDescription: itemSummary,
        specialInstruction: combinedNote,
      });

      if (!pathaoRes.ok) {
        if (dispatchedResults.length === 0) {
          return { ok: false, message: pathaoRes.message };
        }
        messages.push(`${target.id} failed: ${pathaoRes.message}`);
        continue;
      }

      const nextPkg: OrderShipment = {
        ...target,
        pickupHubId: effectiveHub.id,
        pickupHubName: effectiveHub.name,
        pickupAddress: effectiveHub.address,
        pickupPhone: effectiveHub.phone,
        courierProvider: "pathao",
        pathaoStoreId: storeIdToUse,
        codAmount,
        deliveryFee: pathaoRes.deliveryFee,
        consignmentId: pathaoRes.consignmentId,
        trackingCode: pathaoRes.trackingCode,
        deliveryStatus: "In Transit",
        courierRawStatus: pathaoRes.rawStatus || "Pending",
        courierTrackingMessage: `Picked up / queued via Pathao Store #${storeIdToUse}`,
        dispatchedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedShipments[idx] = nextPkg;
      dispatchedResults.push(nextPkg);
      messages.push(pathaoRes.message);
      continue;
    }

    // Steadfast Courier
    if (!recipientPhone || recipientPhone.length < 11) {
      return { ok: false, message: "Customer phone number must be 11 digits (01XXXXXXXXX) for Steadfast Courier dispatch." };
    }
    const sfRes = await dispatchParcelViaSteadfast({
      config,
      invoice: target.invoiceRef || order.id,
      recipientName: order.customer?.name || "Customer",
      recipientPhone,
      recipientAddress,
      codAmount,
      note: combinedNote,
    });

    if (!sfRes.ok) {
      if (dispatchedResults.length === 0) {
        return { ok: false, message: sfRes.message };
      }
      messages.push(`${target.id} failed: ${sfRes.message}`);
      continue;
    }

    const nextPkg: OrderShipment = {
      ...target,
      pickupHubId: effectiveHub.id,
      pickupHubName: effectiveHub.name,
      pickupAddress: effectiveHub.address,
      pickupPhone: effectiveHub.phone,
      courierProvider: "steadfast",
      codAmount,
      consignmentId: sfRes.consignmentId,
      trackingCode: sfRes.trackingCode,
      deliveryStatus: "In Transit",
      courierRawStatus: sfRes.rawStatus || "in_review",
      courierTrackingMessage: `Booked via Steadfast (${effectiveHub.name})`,
      dispatchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updatedShipments[idx] = nextPkg;
    dispatchedResults.push(nextPkg);
    messages.push(sfRes.message);
  }

  if (dispatchedResults.length === 0) {
    return {
      ok: false,
      message: messages[0] || "Could not dispatch parcel.",
    };
  }

  const updateRes = await updateStoreOrder({
    id: order.id,
    shipments: updatedShipments,
    reconcileFromShipments: true,
  });

  const firstPkg = dispatchedResults[0];
  return {
    ok: true,
    trackingCode: firstPkg.trackingCode,
    consignmentId: firstPkg.consignmentId,
    shipment: firstPkg,
    shipments: updatedShipments,
    order: updateRes.order,
    message: messages.join(" · "),
  };
}

export async function rebuildOrderShipments(
  orderId: string,
  mode: "split-auto" | "combine-single",
): Promise<{ ok: boolean; shipments?: OrderShipment[]; order?: AdminOrderRecord | null; message: string }> {
  const allOrders = await getAllStoreOrders();
  const order = allOrders.find((o) => o.id === orderId);
  if (!order) {
    return { ok: false, message: `Order #${orderId} was not found.` };
  }

  const alreadyDispatched = (order.shipments ?? []).some((s) =>
    Boolean(s.trackingCode || s.consignmentId),
  );
  if (alreadyDispatched) {
    return {
      ok: false,
      message: "Cannot re-split or combine shipments after a parcel has already been dispatched.",
    };
  }

  const settings = await getStoreSettings({ bypassCache: true });
  const rebuilt = buildOrderShipments(order, settings.courier, {
    forceRebuild: true,
    combineSingle: mode === "combine-single",
  });

  const updateRes = await updateStoreOrder({
    id: order.id,
    shipments: rebuilt,
    reconcileFromShipments: false,
  });

  return {
    ok: true,
    shipments: rebuilt,
    order: updateRes.order,
    message:
      mode === "combine-single"
        ? "Combined items into 1 single parcel."
        : `Organized order into ${rebuilt.length} parcel(s) by fulfillment hub.`,
  };
}

// ============================================================================
// STATUS MAPPING, LIVE SYNC & WEBHOOK HANDLERS
// ============================================================================

export function mapSteadfastStatusToDeliveryState(raw?: string | null): OrderDeliveryState {
  const normalized = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (!normalized) return "In Transit";
  if (normalized === "delivered" || normalized === "delivered_approval_pending") {
    return "Delivered";
  }
  if (normalized === "partial_delivered" || normalized === "partial_delivered_approval_pending") {
    return "Delivered";
  }
  if (normalized === "cancelled" || normalized === "cancelled_approval_pending") {
    return "Cancelled";
  }
  if (normalized.includes("return")) {
    return "Returned";
  }
  if (normalized.includes("out_for_delivery")) {
    return "Out for Delivery";
  }
  return "In Transit";
}

export function mapPathaoStatusToDeliveryState(
  rawStatus?: string | null,
  eventName?: string | null,
): OrderDeliveryState {
  const combined = `${rawStatus || ""} ${eventName || ""}`
    .trim()
    .toLowerCase()
    .replace(/[.\s-]+/g, "_");

  if (!combined) return "In Transit";
  if (
    combined.includes("delivered") &&
    !combined.includes("failed") &&
    !combined.includes("return")
  ) {
    return "Delivered";
  }
  if (combined.includes("exchanged")) {
    return "Delivered";
  }
  if (combined.includes("return")) {
    return "Returned";
  }
  if (combined.includes("cancel")) {
    return "Cancelled";
  }
  if (combined.includes("assigned_for_delivery")) {
    return "Out for Delivery";
  }
  return "In Transit";
}

export async function syncOrderCourierStatuses(
  orderId: string,
  shipmentId?: string,
): Promise<{
  ok: boolean;
  updatedCount: number;
  order?: AdminOrderRecord | null;
  message: string;
}> {
  const allOrders = await getAllStoreOrders();
  const order = allOrders.find((o) => o.id === orderId);
  if (!order) {
    return { ok: false, updatedCount: 0, message: `Order #${orderId} not found.` };
  }

  const settings = await getStoreSettings({ bypassCache: true });
  const config = settings.courier;
  const shipments = buildOrderShipments(order, config);

  let updatedCount = 0;
  const nextShipments = [...shipments];

  for (let i = 0; i < nextShipments.length; i += 1) {
    const pkg = nextShipments[i];
    if (shipmentId && pkg.id !== shipmentId) continue;
    if (!pkg.consignmentId && !pkg.trackingCode) continue;

    if (pkg.courierProvider === "steadfast" && config?.steadfastApiKey && config?.steadfastSecretKey) {
      try {
        const endpoint = pkg.consignmentId
          ? `${STEADFAST_BASE_URL}/status_by_cid/${encodeURIComponent(pkg.consignmentId)}`
          : `${STEADFAST_BASE_URL}/status_by_trackingcode/${encodeURIComponent(pkg.trackingCode || "")}`;
        const res = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Api-Key": config.steadfastApiKey.trim(),
            "Secret-Key": config.steadfastSecretKey.trim(),
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(6000),
        });
        const data = (await res.json().catch(() => ({}))) as { delivery_status?: string };
        if (res.ok && data?.delivery_status) {
          const mapped = mapSteadfastStatusToDeliveryState(data.delivery_status);
          nextShipments[i] = {
            ...pkg,
            deliveryStatus: mapped,
            courierRawStatus: data.delivery_status,
            updatedAt: new Date().toISOString(),
          };
          updatedCount += 1;
        }
      } catch {
        // Continue syncing remaining parcels
      }
    } else if (pkg.courierProvider === "pathao" && config && pkg.consignmentId) {
      const tokenRes = await getPathaoAccessToken(config);
      if (tokenRes.ok) {
        try {
          const baseUrl = getPathaoBaseUrl(config);
          const res = await fetch(
            `${baseUrl}/aladdin/api/v1/orders/${encodeURIComponent(pkg.consignmentId)}/info`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${tokenRes.accessToken}`,
                Accept: "application/json",
              },
              signal: AbortSignal.timeout(6000),
            },
          );
          const json = (await res.json().catch(() => ({}))) as {
            data?: { order_status?: string; delivery_fee?: number };
          };
          if (res.ok && json?.data?.order_status) {
            const mapped = mapPathaoStatusToDeliveryState(json.data.order_status);
            nextShipments[i] = {
              ...pkg,
              deliveryStatus: mapped,
              courierRawStatus: json.data.order_status,
              ...(json.data.delivery_fee ? { deliveryFee: Number(json.data.delivery_fee) } : {}),
              updatedAt: new Date().toISOString(),
            };
            updatedCount += 1;
          }
        } catch {
          // Continue syncing remaining parcels
        }
      }
    }
  }

  if (updatedCount === 0) {
    return {
      ok: true,
      updatedCount: 0,
      order,
      message: "No new updates received from courier API yet (or parcel not dispatched).",
    };
  }

  const updateRes = await updateStoreOrder({
    id: order.id,
    shipments: nextShipments,
    reconcileFromShipments: true,
  });

  return {
    ok: true,
    updatedCount,
    order: updateRes.order,
    message: `Synced live courier status for ${updatedCount} parcel(s).`,
  };
}

export async function applySteadfastWebhook(payload: {
  consignment_id?: string | number;
  tracking_code?: string;
  invoice?: string;
  status?: string;
  delivery_status?: string;
  tracking_message?: string;
}): Promise<{ ok: boolean; matched: boolean; orderId?: string; message: string }> {
  const match = await findOrderByCourierReference({
    consignmentId: payload.consignment_id,
    trackingCode: payload.tracking_code,
    invoiceRef: payload.invoice,
  });

  if (!match) {
    return { ok: true, matched: false, message: "No matching order found for webhook consignment." };
  }

  const settings = await getStoreSettings({ bypassCache: true });
  const shipments = buildOrderShipments(match.order, settings.courier);
  const rawStatus = payload.status || payload.delivery_status || "";
  const nextDeliveryState = mapSteadfastStatusToDeliveryState(rawStatus);

  const nextShipments = shipments.map((pkg) => {
    const isTarget =
      (match.matchedShipmentId && pkg.id === match.matchedShipmentId) ||
      (payload.consignment_id && pkg.consignmentId === String(payload.consignment_id)) ||
      (payload.invoice && pkg.invoiceRef === String(payload.invoice));
    if (!isTarget) return pkg;
    return {
      ...pkg,
      ...(payload.consignment_id && !pkg.consignmentId
        ? { consignmentId: String(payload.consignment_id) }
        : {}),
      ...(payload.tracking_code && !pkg.trackingCode
        ? { trackingCode: String(payload.tracking_code) }
        : {}),
      deliveryStatus: nextDeliveryState,
      ...(rawStatus ? { courierRawStatus: rawStatus } : {}),
      ...(payload.tracking_message ? { courierTrackingMessage: String(payload.tracking_message) } : {}),
      updatedAt: new Date().toISOString(),
    };
  });

  await updateStoreOrder({
    id: match.order.id,
    shipments: nextShipments,
    reconcileFromShipments: true,
  });

  return {
    ok: true,
    matched: true,
    orderId: match.order.id,
    message: `Updated order ${match.order.id} (${nextDeliveryState}).`,
  };
}

export async function applyPathaoWebhook(payload: {
  consignment_id?: string;
  merchant_order_id?: string;
  order_status?: string;
  order_status_slug?: string;
  event?: string;
  event_name?: string;
  delivery_fee?: number;
}): Promise<{ ok: boolean; matched: boolean; orderId?: string; message: string }> {
  const match = await findOrderByCourierReference({
    consignmentId: payload.consignment_id,
    invoiceRef: payload.merchant_order_id,
  });

  if (!match) {
    return { ok: true, matched: false, message: "No matching order found for Pathao consignment." };
  }

  const settings = await getStoreSettings({ bypassCache: true });
  const shipments = buildOrderShipments(match.order, settings.courier);
  const rawStatus = payload.order_status || payload.order_status_slug || "";
  const eventName = payload.event || payload.event_name || "";
  const nextDeliveryState = mapPathaoStatusToDeliveryState(rawStatus, eventName);

  const nextShipments = shipments.map((pkg) => {
    const isTarget =
      (match.matchedShipmentId && pkg.id === match.matchedShipmentId) ||
      (payload.consignment_id && pkg.consignmentId === String(payload.consignment_id)) ||
      (payload.merchant_order_id && pkg.invoiceRef === String(payload.merchant_order_id));
    if (!isTarget) return pkg;
    return {
      ...pkg,
      ...(payload.consignment_id && !pkg.consignmentId
        ? { consignmentId: String(payload.consignment_id) }
        : {}),
      ...(payload.consignment_id && !pkg.trackingCode
        ? { trackingCode: String(payload.consignment_id) }
        : {}),
      ...(payload.delivery_fee ? { deliveryFee: Number(payload.delivery_fee) } : {}),
      deliveryStatus: nextDeliveryState,
      ...(rawStatus || eventName ? { courierRawStatus: rawStatus || eventName } : {}),
      ...(eventName ? { courierTrackingMessage: `Pathao Event: ${eventName}` } : {}),
      updatedAt: new Date().toISOString(),
    };
  });

  await updateStoreOrder({
    id: match.order.id,
    shipments: nextShipments,
    reconcileFromShipments: true,
  });

  return {
    ok: true,
    matched: true,
    orderId: match.order.id,
    message: `Updated order ${match.order.id} (${nextDeliveryState}).`,
  };
}
