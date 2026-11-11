import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server/admin-auth";
import {
  deleteStoreProduct,
  getAllStoreProducts,
  seedSupabaseCatalog,
  upsertStoreProduct,
  type AdminProductInput,
} from "@/lib/server/store-repository";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const products = await getAllStoreProducts({ bypassCache: true, includeInactive: true });
  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as AdminProductInput;
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Product name is required." }, { status: 400 });
    }
    if (!body.imageSrc?.trim()) {
      return NextResponse.json({ error: "Product image is required." }, { status: 400 });
    }
    if (Number.isNaN(Number(body.price)) || Number(body.price) < 0) {
      return NextResponse.json({ error: "Valid product price is required." }, { status: 400 });
    }

    const result = await upsertStoreProduct(body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save product.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await seedSupabaseCatalog();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to seed Supabase.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Product ID is required." }, { status: 400 });
  }

  try {
    const result = await deleteStoreProduct(id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete product.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
