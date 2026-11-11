import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server/admin-auth";
import {
  deleteStoreReview,
  getAllStoreReviews,
  updateStoreReview,
} from "@/lib/server/store-repository";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") ?? "all") as "all" | "pending" | "approved" | "rejected";
    const productId = searchParams.get("productId") ?? undefined;

    const reviews = await getAllStoreReviews({
      status,
      productId,
    });
    return NextResponse.json({ ok: true, reviews });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load reviews.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { id, status } = body ?? {};

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Review ID is required." }, { status: 400 });
    }
    if (!status || !["pending", "approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Valid status ('pending', 'approved', 'rejected') is required." },
        { status: 400 },
      );
    }

    const result = await updateStoreReview(id, status);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update review status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Review ID is required." }, { status: 400 });

  try {
    const result = await deleteStoreReview(id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete review.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
