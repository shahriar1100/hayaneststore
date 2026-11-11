import { NextResponse } from "next/server";
import { getAllStoreProducts, getStoreSettings } from "@/lib/server/store-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [products, settings] = await Promise.all([
      getAllStoreProducts({ bypassCache: true }),
      getStoreSettings(),
    ]);
    return NextResponse.json({
      ok: true,
      products,
      taxonomy: settings.taxonomy,
      contact: {
        email: settings.contactEmail,
        phone: settings.contactPhone,
        location: settings.contactLocation,
      },
      socialLinks: settings.socialLinks,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to load catalog" },
      { status: 500 },
    );
  }
}
