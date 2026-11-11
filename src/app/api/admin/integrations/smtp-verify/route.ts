import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server/admin-auth";
import { sendTestTransactionalEmail, verifySmtpConnection } from "@/lib/server/email";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await verifySmtpConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    action?: "verify" | "send-test";
    to?: string;
  };
  if (body.action === "send-test") {
    const result = await sendTestTransactionalEmail(body.to ?? "");
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }
  const result = await verifySmtpConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
