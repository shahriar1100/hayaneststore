import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  getAdminSession,
} from "@/lib/server/admin-auth";
import { resolveEmailConfig } from "@/lib/server/email";
import { getBackendConfig } from "@/lib/server/env";
import { getStoreSettings } from "@/lib/server/store-repository";

export async function GET() {
  const session = await getAdminSession();
  const config = getBackendConfig();
  const emailConfig = await resolveEmailConfig();
  return NextResponse.json({
    authenticated: Boolean(session),
    email: session?.email ?? null,
    status: {
      supabaseConfigured: config.supabaseConfigured,
      supabaseWriteConfigured: config.supabaseWriteConfigured,
      supabaseUrl: config.supabaseUrl ? config.supabaseUrl.replace(/^https?:\/\//, "") : "",
      cloudinaryConfigured: config.cloudinaryConfigured,
      cloudinaryCloudName: config.cloudinaryCloudName,
      emailConfigured: emailConfig.hasSmtpCreds || emailConfig.hasResend,
      emailSenderReady: emailConfig.senderReady,
      emailProvider: emailConfig.provider,
      emailUser: emailConfig.user,
      emailFrom: emailConfig.from,
      emailFromEmail: emailConfig.fromEmail,
      emailFromName: emailConfig.fromName,
      defaultAdminEmail: config.adminEmail,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const config = getBackendConfig();

    const email = (body.email ?? "").trim();
    const password = body.password ?? "";

    const settings = await getStoreSettings().catch(() => null);
    let passwordMatches = false;

    if (settings?.adminPasswordHash) {
      const computedHash = createHash("sha256").update(`admin-salt-v1:${password}`).digest("hex");
      passwordMatches = computedHash === settings.adminPasswordHash;
    } else {
      passwordMatches = password === config.adminPassword;
    }

    if (
      email.toLowerCase() !== config.adminEmail.toLowerCase() ||
      !passwordMatches
    ) {
      return NextResponse.json(
        { error: "Invalid admin email or password." },
        { status: 401 },
      );
    }

    const token = createAdminSessionToken(config.adminEmail);
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json({
      ok: true,
      email: config.adminEmail,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
