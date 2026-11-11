import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAdminSession } from "@/lib/server/admin-auth";
import { getBackendConfig } from "@/lib/server/env";
import { getStoreSettings, updateStoreSettings } from "@/lib/server/store-repository";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      currentPassword?: string;
      newPassword?: string;
    };

    const currentPassword = (body.currentPassword ?? "").trim();
    const newPassword = (body.newPassword ?? "").trim();

    if (!currentPassword) {
      return NextResponse.json(
        { ok: false, error: "Please enter your current admin password." },
        { status: 400 },
      );
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { ok: false, error: "New password must be at least 6 characters long." },
        { status: 400 },
      );
    }

    const config = getBackendConfig();
    const settings = await getStoreSettings().catch(() => null);

    let isCurrentValid = false;
    if (settings?.adminPasswordHash) {
      const computedHash = createHash("sha256").update(`admin-salt-v1:${currentPassword}`).digest("hex");
      isCurrentValid = computedHash === settings.adminPasswordHash;
    } else {
      isCurrentValid = currentPassword === config.adminPassword;
    }

    if (!isCurrentValid) {
      return NextResponse.json(
        { ok: false, error: "Incorrect current password. Please try again." },
        { status: 400 },
      );
    }

    // 1. Generate new hash and persist to database/store settings
    const newHash = createHash("sha256").update(`admin-salt-v1:${newPassword}`).digest("hex");
    await updateStoreSettings({ adminPasswordHash: newHash });

    // 2. Synchronize .env.local on disk if available
    try {
      const envPath = path.join(process.cwd(), ".env.local");
      const envContent = await readFile(envPath, "utf8");
      let updatedEnv = envContent;
      if (updatedEnv.includes("ADMIN_PASSWORD=")) {
        updatedEnv = updatedEnv.replace(/ADMIN_PASSWORD=.*$/m, `ADMIN_PASSWORD=${newPassword}`);
      } else {
        updatedEnv += `\nADMIN_PASSWORD=${newPassword}`;
      }
      await writeFile(envPath, updatedEnv, "utf8");
    } catch {
      // Ignored if running in read-only environment like Vercel
    }

    return NextResponse.json({
      ok: true,
      message: "Admin password has been updated successfully!",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update admin password.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
