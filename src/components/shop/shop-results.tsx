"use client";

import { useState } from "react";
import { ArrowDown, SearchX } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import type { CatalogProduct } from "@/types/store";
import { colourOptions, fabricOptions } from "@/data/shop-options";
import { PAGE_SIZE } from "@/lib/shop";

export function ShopResults({ products, onClear }: { products: CatalogProduct[]; onClear: () => void }) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [announcement, setAnnouncement] = useState("");
  const visible = products.slice(0, limit);

  function loadMore() {
    const firstNewProduct = products[limit];
    const count = Math.min(PAGE_SIZE, products.length - limit);
    setLimit(limit + PAGE_SIZE);
    setAnnouncement(`${count} more products loaded. Showing ${Math.min(limit + PAGE_SIZE, products.length)} of ${products.length}.`);
    requestAnimationFrame(() => {
      document.getElementById(`shop-product-${firstNewProduct.id}`)?.querySelector("a")?.focus({ preventScroll: true });
    });
  }

  if (!products.length) {
    return <div className="shop-empty"><span className="shop-empty-icon"><SearchX size={32} strokeWidth={1.4} aria-hidden="true" /></span><h2>No pieces found</h2><p>Try a different search, or clear your filters to explore the full collection.</p><button type="button" className="shop-primary-button" onClick={onClear}>Clear Filters</button></div>;
  }

  return <>
    <div className="shop-product-grid" id="shop-products">
      {visible.map((product) => {
        const colour = colourOptions.find((option) => option.value === product.colour)?.label;
        const fabric = fabricOptions.find((option) => option.value === product.fabric)?.label ?? "Accessories";
        return <ProductCard key={product.id} id={`shop-product-${product.id}`} product={product} variant="catalog" caption={`${colour} · ${fabric}`} />;
      })}
    </div>
    <div className="shop-pagination"><p>Showing <strong>{visible.length}</strong> of <strong>{products.length}</strong> products</p><div className="shop-progress" aria-hidden="true"><span style={{ width: `${visible.length / products.length * 100}%` }} /></div>{visible.length < products.length ? <button type="button" className="shop-load-more" onClick={loadMore}>Load More <ArrowDown size={17} aria-hidden="true" /></button> : <p className="shop-all-shown">You’ve seen the whole collection.</p>}</div>
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
  </>;
}
