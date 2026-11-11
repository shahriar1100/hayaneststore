import { NextResponse } from "next/server";
import {
  resetCustomerPassword,
  verifyPasswordResetTokenOrCode,
} from "@/lib/server/store-repository";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") || searchParams.get("code") || "";

  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token or verification code." }, { status: 400 });
  }

  const result = await verifyPasswordResetTokenOrCode(token);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, email: result.email, name: result.name });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      tokenOrCode?: string;
      newPassword?: string;
    };

    const tokenOrCode = body.tokenOrCode?.trim();
    const newPassword = body.newPassword;

    if (!tokenOrCode) {
      return NextResponse.json(
        { ok: false, error: "Reset token or verification code is required." },
        { status: 400 },
      );
    }

    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json(
        { ok: false, error: "New password must be at least 4 characters long." },
        { status: 400 },
      );
    }

    const resetResult = await resetCustomerPassword(tokenOrCode, newPassword);
    if (!resetResult.ok) {
      return NextResponse.json({ ok: false, error: resetResult.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: "Your password has been reset successfully! You can now sign in with your new password.",
      email: resetResult.email,
      phone: resetResult.phone,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to reset password.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
