import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server/admin-auth";
import { updateVariantInventory } from "@/lib/server/store-repository";
import type { ProductColour } from "@/types/store";

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      productId?: string;
      colour?: ProductColour;
      stock?: number;
      costPrice?: number | null;
      lowStockThreshold?: number;
    };

    if (!body.productId || !body.colour || body.stock === undefined) {
      return NextResponse.json(
        { error: "productId, colour, and stock are required." },
        { status: 400 },
      );
    }

    const result = await updateVariantInventory({
      productId: body.productId,
      colour: body.colour,
      stock: Number(body.stock),
      costPrice: body.costPrice,
      lowStockThreshold: body.lowStockThreshold,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update inventory.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
