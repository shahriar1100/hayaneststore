"use client";

import { Heart } from "lucide-react";
import { toggleSavedProduct, useSavedProducts } from "@/lib/saved-products";
import { announceNotice } from "@/components/ui/coming-soon";

export function SaveProductButton({ productId, name, variant = "icon", onToggle }: {
  productId: string;
  name: string;
  variant?: "icon" | "label";
  onToggle?: (id: string, saved: boolean) => void;
}) {
  const { ids, ready } = useSavedProducts();
  const saved = ids.includes(productId);
  const label = saved ? `Remove ${name} from saved products` : `Save ${name}`;

  return <button type="button" className={`save-product-button save-product-${variant}`} aria-label={label} title={label} aria-pressed={saved} disabled={!ready} onClick={() => {
    const result = toggleSavedProduct(productId);
    announceNotice(result.saved ? "Product saved" : "Product removed", result.persistent
      ? `${name} ${result.saved ? "is now in" : "was removed from"} your saved products.`
      : `${name} ${result.saved ? "saved" : "removed"} for this visit only. Your browser couldn't store the change.`);
    onToggle?.(productId, result.saved);
  }}><Heart aria-hidden="true" fill={saved ? "currentColor" : "none"} />{variant === "label" && <span>{saved ? "Saved" : "Save for later"}</span>}</button>;
}
