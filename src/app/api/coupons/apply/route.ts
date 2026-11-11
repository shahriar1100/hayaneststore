import { NextResponse } from "next/server";
import { applyStoreCoupon } from "@/lib/server/store-repository";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, subtotal } = body ?? {};

    if (!code || typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ ok: false, message: "Please enter a coupon code." }, { status: 400 });
    }

    const numericSubtotal = Math.max(0, Number(subtotal) || 0);
    const result = await applyStoreCoupon(code, numericSubtotal);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to apply coupon.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
