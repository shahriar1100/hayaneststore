import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server/admin-auth";
import {
  getStoreSettings,
  updateStoreSettings,
  type AdminSettingsRecord,
} from "@/lib/server/store-repository";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getStoreSettings({ bypassCache: true });
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const patch = (await request.json()) as Partial<AdminSettingsRecord>;
    const settings = await updateStoreSettings(patch);
    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
