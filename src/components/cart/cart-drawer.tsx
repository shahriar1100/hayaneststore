"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, Trash2, X } from "lucide-react";
import { catalogProducts } from "@/data/catalog";
import { formatPrice } from "@/data/store";
import type { CatalogProduct } from "@/types/store";
import { ProductPhoto } from "@/components/product/product-photo";
import { setCartQuantity, useCartProducts } from "@/lib/cart-products";

export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogProduct[]>(catalogProducts);
  const close = () => setOpen(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { items } = useCartProducts();

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("noor:open-cart", show);
    return () => window.removeEventListener("noor:open-cart", show);
  }, []);

  useEffect(() => {
    if (!open && items.length === 0) return;
    let active = true;
    void fetch("/api/catalog", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; products?: CatalogProduct[] } | null) => {
        if (active && data?.ok && Array.isArray(data.products)) {
          setCatalog(data.products);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", key);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  const rows = items.flatMap((item) => {
    const product =
      catalog.find(({ id }) => id === item.id) ??
      catalogProducts.find(({ id }) => id === item.id);
    if (!product) return [];
    const availableStock =
      typeof product.stock === "number"
        ? Math.max(0, product.stock)
        : product.details.variants.reduce(
            (sum, v) => sum + Math.max(0, Number(v.stock ?? 0)),
            0,
          );
    return [
      {
        product,
        quantity: item.quantity,
        colour: item.colour || product.colour,
        availableStock,
      },
    ];
  });

  const subtotal = rows.reduce(
    (sum, row) => sum + row.product.price * row.quantity,
    0,
  );

  if (!open) return null;

  return (
    <div
      className="cart-drawer-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <aside
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
      >
        <header className="cart-drawer-header">
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={close}
            aria-label="Close shopping bag"
          >
            <ArrowLeft />
          </button>
          <div>
            <h2 id="cart-drawer-title">Your Shopping Bag</h2>
            <p>{items.reduce((sum, item) => sum + item.quantity, 0)} items</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={close}
            aria-label="Close"
          >
            <X />
          </button>
        </header>
        <div className="cart-drawer-list">
          {rows.length ? (
            rows.map(({ product, quantity, colour, availableStock }) => (
              <article className="drawer-cart-item" key={product.id}>
                <Link
                  href={`/products/${product.slug}`}
                  className="drawer-item-thumb"
                  onClick={close}
                  aria-label={product.name}
                >
                  <ProductPhoto photo={product.photo} sizes="82px" />
                </Link>
                <div>
                  <h3>
                    <Link href={`/products/${product.slug}`} onClick={close}>
                      {product.name}
                    </Link>
                  </h3>
                  <p>
                    {formatPrice(product.price)}
                    {colour ? (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 11,
                          textTransform: "capitalize",
                        }}
                      >
                        · {colour}
                      </span>
                    ) : null}
                  </p>
                  <div className="drawer-quantity">
                    <button
                      type="button"
                      onClick={() => setCartQuantity(product.id, quantity - 1)}
                      disabled={quantity <= 1}
                      aria-label={`Decrease ${product.name} quantity`}
                    >
                      <Minus />
                    </button>
                    <output>{quantity}</output>
                    <button
                      type="button"
                      onClick={() =>
                        setCartQuantity(
                          product.id,
                          Math.min(availableStock, quantity + 1),
                        )
                      }
                      disabled={availableStock <= 0 || quantity >= availableStock}
                      aria-label={`Increase ${product.name} quantity`}
                    >
                      <Plus />
                    </button>
                  </div>
                </div>
                <div className="drawer-line-total">
                  <strong>{formatPrice(product.price * quantity)}</strong>
                  <button
                    type="button"
                    onClick={() => setCartQuantity(product.id, 0)}
                    aria-label={`Remove ${product.name}`}
                  >
                    <Trash2 />
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="drawer-empty">
              <h3>Your shopping bag is empty</h3>
              <p>Discover something beautiful for your collection.</p>
              <Link href="/shop" onClick={close}>
                Explore Collection
              </Link>
            </div>
          )}
        </div>
        {rows.length > 0 && (
          <footer className="cart-drawer-summary">
            <div>
              <span>Subtotal</span>
              <strong>{formatPrice(subtotal)}</strong>
            </div>
            <p>Shipping calculated at checkout.</p>
            <Link
              href="/checkout"
              className="drawer-checkout"
              onClick={close}
            >
              Proceed to Checkout
            </Link>
            <Link href="/cart" className="drawer-continue" onClick={close}>
              View Shopping Bag
            </Link>
          </footer>
        )}
      </aside>
    </div>
  );
}
