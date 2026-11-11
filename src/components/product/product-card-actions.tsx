"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { announceNotice } from "@/components/ui/coming-soon";
import { addProductToCart } from "@/lib/cart-products";

export function ProductCardActions({
  productId,
  name,
  outOfStock = false,
}: {
  productId: string;
  name: string;
  outOfStock?: boolean;
}) {
  const router = useRouter();
  const add = () => {
    if (outOfStock) return;
    const result = addProductToCart(productId);
    announceNotice(
      "Added to cart",
      result.persistent ? `${name} was added to your shopping bag.` : `${name} was added for this visit only.`,
    );
  };
  return (
    <div className="product-card-actions" aria-label={`${name} purchase options`}>
      <button
        type="button"
        className="product-card-action product-card-add"
        aria-label={outOfStock ? `${name} is out of stock` : `Add ${name} to cart`}
        disabled={outOfStock}
        onClick={add}
      >
        {outOfStock ? "Out of Stock" : "Add to Cart"}
      </button>
      <button
        type="button"
        className="product-card-action product-card-buy"
        aria-label={`Buy ${name} now`}
        disabled={outOfStock}
        onClick={() => {
          if (outOfStock) return;
          addProductToCart(productId);
          router.push("/cart");
        }}
      >
        <span>Buy Now</span>
        <span className="buy-now-icon" aria-hidden="true">
          <ArrowUpRight />
        </span>
      </button>
    </div>
  );
}
