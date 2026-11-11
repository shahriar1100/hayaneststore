import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server/admin-auth";
import {
  buildDashboardAnalytics,
  type DateRangePreset,
} from "@/lib/server/analytics-engine";
import {
  getAllStoreOrders,
  getAllStoreProducts,
  getAllStoreReviews,
  getContactMessages,
  getCustomerAccountsPublic,
  getStoreActivities,
  getStoreCoupons,
  getStoreSettings,
} from "@/lib/server/store-repository";

const VALID_PRESETS: DateRangePreset[] = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "this_month",
  "last_month",
  "this_year",
  "custom",
];

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const rawPreset = searchParams.get("preset") as DateRangePreset | null;
    const preset: DateRangePreset =
      rawPreset && VALID_PRESETS.includes(rawPreset) ? rawPreset : "last_30_days";
    const startDate = searchParams.get("startDate") ?? undefined;
    const endDate = searchParams.get("endDate") ?? undefined;

    const [
      products,
      orders,
      coupons,
      settings,
      activities,
      reviews,
      registeredCustomers,
      contactMessages,
    ] = await Promise.all([
      getAllStoreProducts({ bypassCache: true, includeInactive: true }),
      getAllStoreOrders(),
      getStoreCoupons(),
      getStoreSettings({ bypassCache: true }),
      getStoreActivities(),
      getAllStoreReviews({ status: "all" }),
      getCustomerAccountsPublic(),
      getContactMessages(),
    ]);

    const analytics = buildDashboardAnalytics({
      products,
      orders,
      coupons,
      settings,
      activities,
      preset,
      customStart: startDate,
      customEnd: endDate,
    });

    return NextResponse.json({
      analytics,
      products,
      orders,
      reviews,
      registeredCustomers,
      contactMessages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compute analytics.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
