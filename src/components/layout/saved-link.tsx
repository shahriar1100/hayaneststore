"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useSavedProducts } from "@/lib/saved-products";

export function SavedLink({ variant, active = false }: { variant: "header" | "bottom"; active?: boolean }) {
  const { ids } = useSavedProducts();
  const hasSavedProducts = ids.length > 0;
  return <Link href="/saved" className={variant === "header" ? "icon-button header-wishlist saved-nav-link" : `bottom-nav-item ${active ? "selected" : ""}`} aria-label={`Saved products, ${ids.length} ${ids.length === 1 ? "item" : "items"}`} aria-current={active ? "page" : undefined}><span className="saved-nav-icon"><Heart aria-hidden="true" fill={hasSavedProducts || active ? "currentColor" : "none"} />{hasSavedProducts && <span className="saved-count" aria-hidden="true">{ids.length}</span>}</span>{variant === "bottom" && <span>Saved</span>}</Link>;
}
