import { NextResponse } from "next/server";
import {
  changeCustomerAccountPassword,
  registerCustomerAccount,
  updateCustomerAccountProfile,
  verifyCustomerAccount,
} from "@/lib/server/store-repository";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "signup" | "login" | "update-profile" | "change-password";
      id?: string;
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
      city?: string;
      password?: string;
      currentPassword?: string;
      newPassword?: string;
      identifier?: string;
    };

    if (body.action === "signup") {
      if (!body.name?.trim() || !body.phone?.trim()) {
        return NextResponse.json(
          { ok: false, error: "Please enter your full name and phone number." },
          { status: 400 },
        );
      }
      const cleanEmail = body.email?.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
        return NextResponse.json(
          { ok: false, error: "A valid email address is required for account creation and password recovery." },
          { status: 400 },
        );
      }
      if (!body.password || body.password.length < 4) {
        return NextResponse.json(
          { ok: false, error: "Password must be at least 4 characters long." },
          { status: 400 },
        );
      }
      const result = await registerCustomerAccount({
        id: body.id,
        name: body.name,
        phone: body.phone,
        email: body.email,
        address: body.address,
        city: body.city,
        password: body.password,
      });
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, code: result.code, error: result.error },
          { status: 409 },
        );
      }
      return NextResponse.json({ ok: true, user: result.user });
    }

    if (body.action === "login") {
      if (!body.identifier?.trim() || !body.password) {
        return NextResponse.json(
          { ok: false, error: "Please enter your phone/email and password." },
          { status: 400 },
        );
      }
      const result = await verifyCustomerAccount(body.identifier, body.password);
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, code: result.code, error: result.error },
          { status: 401 },
        );
      }
      return NextResponse.json({ ok: true, user: result.user });
    }

    if (body.action === "update-profile") {
      if (!body.id) {
        return NextResponse.json(
          { ok: false, error: "User ID is required." },
          { status: 400 },
        );
      }
      const user = await updateCustomerAccountProfile({
        id: body.id,
        name: body.name,
        phone: body.phone,
        email: body.email,
        address: body.address,
        city: body.city,
      });
      return NextResponse.json({ ok: true, user });
    }

    if (body.action === "change-password") {
      if (!body.id || !body.currentPassword || !body.newPassword) {
        return NextResponse.json(
          { ok: false, error: "Current password and new password are required." },
          { status: 400 },
        );
      }
      const result = await changeCustomerAccountPassword({
        id: body.id,
        phone: body.phone,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
      });
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Invalid auth action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication request failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
