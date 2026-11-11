"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { catalogProducts } from "@/data/catalog";
import type { CatalogProduct } from "@/types/store";
import { useSavedProducts } from "@/lib/saved-products";
import { ProductCard } from "@/components/product/product-card";

export function SavedProductsContent({ catalog = catalogProducts }: { catalog?: CatalogProduct[] }) {
  const { ids, ready } = useSavedProducts();
  const products = ids.flatMap((id) => {
    const product = catalog.find((p) => p.id === id) ?? catalogProducts.find((p) => p.id === id);
    return product ? [product] : [];
  });

  if (!ready) return <div className="saved-loading" role="status">Loading saved products…</div>;

  if (!products.length) {
    return <section className="saved-empty" aria-labelledby="saved-empty-title">
      <span className="saved-empty-icon"><Heart aria-hidden="true" /></span>
      <h2 id="saved-empty-title">Your wishlist is waiting</h2>
      <p>Save the hijabs and accessories you love, then find them here whenever you are ready.</p>
      <Link href="/shop" className="saved-primary-button">Continue Shopping</Link>
    </section>;
  }

  return <>
    <p className="saved-summary" role="status" aria-live="polite"><strong>{products.length}</strong> {products.length === 1 ? "product" : "products"} saved</p>
    <section className="saved-product-grid" aria-label="Saved products">
      {products.map((product) => <ProductCard key={product.id} product={product} variant="catalog" />)}
    </section>
  </>;
}
