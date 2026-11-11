import type { Product } from "@/types/store";
import { formatPrice } from "@/data/store";
import Link from "next/link";
import { ProductPhoto } from "./product-photo";
import { SaveProductButton } from "./save-product-button";
import { ProductCardActions } from "./product-card-actions";

export function ProductCard({ product, variant = "standard", caption, id, onSavedChange }: { product: Product; variant?: "standard" | "compact" | "sale" | "catalog"; caption?: string; id?: string; onSavedChange?: (id: string, saved: boolean) => void }) {
  const discount = product.originalPrice ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;
  const totalStock =
    typeof product.stock === "number"
      ? product.stock
      : product.details?.variants
        ? product.details.variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock ?? 0)), 0)
        : undefined;
  const isOutOfStock = totalStock !== undefined && totalStock <= 0;

  return (
    <article id={id} data-product-id={product.id} className={`product-card product-card-${variant}`}>
      <Link href={`/products/${product.slug}`} className="product-link" aria-label={`View ${product.name}, ${formatPrice(product.price)}${discount ? `, ${discount}% off` : ""}`}>
        <span className="product-image">
          <ProductPhoto photo={product.photo} sizes={variant === "catalog" ? "(min-width: 1328px) 230px, (min-width: 1024px) 19vw, (min-width: 768px) 30vw, 47vw" : variant === "sale" ? "(min-width: 1328px) 190px, (min-width: 1024px) 15vw, (min-width: 768px) 30vw, 31vw" : "(min-width: 1328px) 288px, (min-width: 1024px) 23vw, (min-width: 768px) 30vw, 47vw"} />
          {isOutOfStock ? (
            <span className="discount-badge" style={{ background: "#dc2626" }}>Out of Stock</span>
          ) : (
            discount > 0 && <span className="discount-badge">-{discount}%</span>
          )}
        </span>
        <span className="product-details">
          <span className="product-header-row">
            <span className="product-name">{product.name}</span>
            <span className="product-prices">
              <span className="current-price">{formatPrice(product.price)}</span>
              {product.originalPrice && <del className="original-price"><span className="sr-only">Original price </span>{formatPrice(product.originalPrice)}</del>}
            </span>
          </span>
          {caption && <span className="product-caption">{caption}</span>}
          {product.description && <span className="product-short-desc">{product.description}</span>}
        </span>
      </Link>
      <SaveProductButton productId={product.id} name={product.name} onToggle={onSavedChange} />
      <ProductCardActions productId={product.id} name={product.name} outOfStock={isOutOfStock} />
    </article>
  );
}
