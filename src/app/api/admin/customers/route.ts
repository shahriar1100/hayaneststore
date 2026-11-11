import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server/admin-auth";
import {
  adminResetCustomerPassword,
  getCustomerAccountsPublic,
} from "@/lib/server/store-repository";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized admin session." }, { status: 401 });
  }
  const customers = await getCustomerAccountsPublic();
  return NextResponse.json({ customers });
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized admin session." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      phone?: string;
      newPassword?: string;
    };

    if (!body.id || !body.newPassword) {
      return NextResponse.json(
        { ok: false, error: "Customer ID and new password are required." },
        { status: 400 },
      );
    }

    const result = await adminResetCustomerPassword({
      id: body.id,
      phone: body.phone,
      newPassword: body.newPassword,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, user: result.user });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to reset customer password.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
