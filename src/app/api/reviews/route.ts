import { NextResponse } from "next/server";
import { createCustomerReview, getAllStoreReviews } from "@/lib/server/store-repository";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderIdsParam = searchParams.get("orderIds");
    if (orderIdsParam) {
      const targetOrderIds = new Set(
        orderIdsParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
      const allReviews = await getAllStoreReviews({ status: "all" });
      const reviewedKeys = allReviews
        .filter((r) => r.orderId && targetOrderIds.has(r.orderId))
        .map((r) => `${r.orderId}_${r.productId}`);
      return NextResponse.json({
        ok: true,
        reviewedKeys: Array.from(new Set(reviewedKeys)),
      });
    }

    const productId = searchParams.get("productId") ?? undefined;
    const reviews = await getAllStoreReviews({
      productId,
      status: "approved",
    });
    return NextResponse.json({ ok: true, reviews });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load reviews.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, orderId, customerName, customerPhone, rating, title, comment } = body ?? {};

    if (!productId || typeof productId !== "string") {
      return NextResponse.json({ error: "Product ID is required." }, { status: 400 });
    }
    if (!customerName || typeof customerName !== "string" || !customerName.trim()) {
      return NextResponse.json({ error: "Customer name is required." }, { status: 400 });
    }
    const numericRating = Number(rating);
    if (Number.isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5 stars." }, { status: 400 });
    }
    if (!comment || typeof comment !== "string" || !comment.trim()) {
      return NextResponse.json({ error: "Review comment cannot be empty." }, { status: 400 });
    }

    const review = await createCustomerReview({
      productId: productId.trim(),
      orderId: orderId ? String(orderId).trim() : null,
      customerName: customerName.trim(),
      customerPhone: customerPhone ? String(customerPhone).trim() : null,
      rating: numericRating,
      title: title ? String(title).trim() : "",
      comment: comment.trim(),
      status: "pending",
    });

    return NextResponse.json({
      ok: true,
      message: "Thank you! Your review has been submitted for moderation.",
      review,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit review.";
    const isDuplicate = message.includes("ইতিমধ্যে জমা দিয়েছেন") || message.toLowerCase().includes("already");
    return NextResponse.json(
      { error: message, alreadyReviewed: isDuplicate },
      { status: isDuplicate ? 409 : 500 },
    );
  }
}
