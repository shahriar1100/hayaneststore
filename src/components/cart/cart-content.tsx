"use client";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { catalogProducts } from "@/data/catalog";
import { formatPrice } from "@/data/store";
import type { CatalogProduct } from "@/types/store";
import { ProductPhoto } from "@/components/product/product-photo";
import { setCartQuantity, useCartProducts } from "@/lib/cart-products";

function getAvailableStock(product: CatalogProduct): number {
  if (typeof product.stock === "number") return Math.max(0, product.stock);
  return product.details.variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock ?? 0)), 0);
}

export function CartContent({ catalog = catalogProducts }: { catalog?: CatalogProduct[] }) {
  const { items, ready } = useCartProducts();
  const rows = items.flatMap((item) => {
    const product = catalog.find(({ id }) => id === item.id) ?? catalogProducts.find(({ id }) => id === item.id);
    return product
      ? [
          {
            product,
            quantity: item.quantity,
            colour: item.colour,
            availableStock: getAvailableStock(product),
          },
        ]
      : [];
  });
  const subtotal = rows.reduce((total, row) => total + row.product.price * row.quantity, 0);
  if (!ready) return <p className="cart-status">Loading your cart…</p>;
  if (!rows.length) return <section className="cart-empty"><ShoppingBag /><h2>Your shopping bag is empty</h2><p>Discover something beautiful for your collection.</p><Link href="/shop" className="cart-primary">Explore Collection</Link></section>;
  return (
    <section className="cart-content">
      <div className="cart-items">
        {rows.map(({ product, quantity, colour, availableStock }) => (
          <article className="cart-item" key={product.id}>
            <Link href={`/products/${product.slug}`} className="cart-item-thumb" aria-label={product.name}>
              <ProductPhoto photo={product.photo} sizes="86px" />
            </Link>
            <div>
              <h2>
                <Link href={`/products/${product.slug}`}>{product.name}</Link>
              </h2>
              <p>
                {formatPrice(product.price)}
                {colour ? (
                  <span style={{ textTransform: "capitalize", marginLeft: 8, opacity: 0.8 }}>
                    · Colour: {colour}
                  </span>
                ) : null}
                {availableStock <= 0 ? (
                  <span style={{ color: "#dc2626", fontWeight: 600, marginLeft: 8 }}>· Out of stock</span>
                ) : quantity > availableStock ? (
                  <span style={{ color: "#d97706", fontWeight: 600, marginLeft: 8 }}>
                    · Only {availableStock} available
                  </span>
                ) : null}
              </p>
              <div className="cart-quantity">
                <button
                  type="button"
                  disabled={quantity <= 1}
                  onClick={() => setCartQuantity(product.id, quantity - 1)}
                  aria-label={`Decrease ${product.name} quantity`}
                >
                  <Minus />
                </button>
                <output>{quantity}</output>
                <button
                  type="button"
                  disabled={availableStock <= 0 || quantity >= availableStock}
                  onClick={() => setCartQuantity(product.id, Math.min(availableStock, quantity + 1))}
                  aria-label={`Increase ${product.name} quantity`}
                >
                  <Plus />
                </button>
                <button
                  type="button"
                  className="cart-remove"
                  onClick={() => setCartQuantity(product.id, 0)}
                  aria-label={`Remove ${product.name}`}
                >
                  <Trash2 />
                </button>
              </div>
            </div>
            <strong>{formatPrice(product.price * quantity)}</strong>
          </article>
        ))}
      </div>
      <aside className="cart-total">
        <span>Subtotal</span>
        <strong>{formatPrice(subtotal)}</strong>
        <p>Shipping is calculated at checkout.</p>
        <Link href="/checkout" className="cart-primary">
          Proceed to Checkout
        </Link>
        <Link href="/shop" className="cart-continue">
          Continue Shopping
        </Link>
      </aside>
    </section>
  );
}
