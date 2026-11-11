import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getBackendConfig } from "./env";

export const ADMIN_COOKIE_NAME = "noor_admin_session";

function signToken(email: string): string {
  const { adminSecret } = getBackendConfig();
  const payload = Buffer.from(JSON.stringify({ email, role: "admin" })).toString("base64url");
  const signature = createHmac("sha256", adminSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAdminToken(token: string | undefined): { email: string } | null {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const { adminSecret, adminEmail } = getBackendConfig();
  const expectedSig = createHmac("sha256", adminSecret).update(payload).digest("base64url");

  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string };
    if (!parsed.email || parsed.email.toLowerCase() !== adminEmail.toLowerCase()) return null;
    return { email: parsed.email };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminToken(token);
}

export function createAdminSessionToken(email: string): string {
  return signToken(email);
}
