"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Minus, Plus, ShoppingBag, Truck } from "lucide-react";
import type { ProductVariant } from "@/types/store";
import { formatPrice } from "@/data/store";
import { resolveColourMeta, type ColourOption } from "@/data/shop-options";
import { announceNotice } from "@/components/ui/coming-soon";
import { addProductToCart } from "@/lib/cart-products";
import { trackViewContent } from "@/lib/fpixel";
import { ProductGallery } from "./product-gallery";
import { SaveProductButton } from "./save-product-button";

export function ProductDetails({
  productId,
  name,
  price = 0,
  originalPrice,
  category,
  fabric,
  description,
  material,
  size,
  deliveryNote,
  variants,
  summary,
  specifications,
  delivery,
  customColours,
}: {
  productId: string;
  name: string;
  price?: number;
  originalPrice?: number;
  category?: string;
  fabric?: string | null;
  description?: string;
  material?: string;
  size?: string;
  deliveryNote?: string;
  variants: [ProductVariant, ...ProductVariant[]];
  summary?: ReactNode;
  specifications?: ReactNode;
  delivery?: ReactNode;
  customColours?: ColourOption[];
}) {
  const router = useRouter();

  // Meta Pixel: Track ViewContent for product
  useEffect(() => {
    trackViewContent({
      id: productId,
      name,
      price: price || 0,
      category,
    });
  }, [productId, name, price, category]);

  const [selectedColour, setSelectedColour] = useState(variants[0].colour);
  const [quantity, setQuantity] = useState(1);
  const [cartNotice, setCartNotice] = useState(false);
  const variant = variants.find(({ colour }) => colour === selectedColour) ?? variants[0];
  const colourName = resolveColourMeta(variant.colour, customColours).label;
  const inStock = variant.stock > 0;
  const discount =
    originalPrice && originalPrice > price
      ? Math.round((1 - price / originalPrice) * 100)
      : 0;

  function selectVariant(next: ProductVariant) {
    setSelectedColour(next.colour);
    setQuantity((current) => Math.max(1, Math.min(current, next.stock)));
    setCartNotice(false);
  }

  function changeQuantity(next: number) {
    setQuantity(Math.max(1, Math.min(variant.stock, next)));
    setCartNotice(false);
  }

  function handleAddToBag() {
    if (!inStock) return;
    const result = addProductToCart(productId, quantity, variant.colour);
    setCartNotice(true);
    announceNotice(
      "Added to bag",
      result.persistent
        ? `${quantity} × ${name}${colourName ? ` (${colourName})` : ""} was added to your shopping bag.`
        : `${quantity} × ${name} was added for this visit only.`,
    );
  }

  function handleBuyNow() {
    if (!inStock) return;
    addProductToCart(productId, quantity, variant.colour);
    router.push("/checkout");
  }

  const renderedSummary = summary ?? (
    <div className="product-summary">
      <p className="product-eyebrow">HAYANEST BD · EVERYDAY ELEGANCE</p>
      <h1>{name}</h1>
      <div className="product-detail-prices">
        <span className="product-detail-price">{formatPrice(price)}</span>
        {originalPrice && (
          <del>
            <span className="sr-only">Original price </span>
            {formatPrice(originalPrice)}
          </del>
        )}
        {discount > 0 && <span className="product-saving">Save {discount}%</span>}
        <span className="product-currency">BDT</span>
      </div>
      {description && <p className="product-description">{description}</p>}
    </div>
  );

  const renderedSpecifications = specifications ?? (
    <dl className="product-specifications">
      <div>
        <dt>{fabric ? "Fabric" : "Material"}</dt>
        <dd>{material || "Modal"}</dd>
      </div>
      <div>
        <dt>Size</dt>
        <dd>{size || "180 × 70 cm"}</dd>
      </div>
    </dl>
  );

  const renderedDelivery = delivery ?? (
    <div className="product-delivery">
      <Truck size={22} aria-hidden="true" />
      <div>
        <h2>Delivery</h2>
        <p>{deliveryNote || "Delivery within 1–3 business days inside Dhaka and 3–5 days nationwide."}</p>
      </div>
    </div>
  );

  return (
    <div className="product-detail-layout">
      <ProductGallery photos={variant.gallery} name={name} />
      <div className="product-information">
        {renderedSummary}
        <div className="product-save-action">
          <SaveProductButton productId={productId} name={name} variant="label" />
        </div>
        <fieldset className="product-colours">
          <legend>
            Colour <span>{colourName}</span>
          </legend>
          <div className="product-colour-options">
            {variants.map((option, idx) => {
              const colour = resolveColourMeta(option.colour, customColours);
              return (
                <label className="product-colour-option" key={`${option.colour}-${idx}`}>
                  <input
                    type="radio"
                    name="product-colour"
                    value={option.colour}
                    checked={variant.colour === option.colour}
                    onChange={() => selectVariant(option)}
                  />
                  <span
                    className="product-colour-dot"
                    style={{ background: colour.swatch }}
                    aria-hidden="true"
                  />
                  <span>{colour.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {renderedSpecifications}
        <p
          className={`product-stock ${inStock ? "in-stock" : "out-of-stock"}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="product-stock-dot" aria-hidden="true" />
          {inStock ? `In stock · ${variant.stock} available` : "Out of stock in this colour"}
        </p>
        <p className="product-demo-note">Size and availability shown are demo details.</p>
        <div className="product-purchase-controls">
          <div className="product-quantity">
            <span id="quantity-label">Quantity</span>
            <div
              className="product-quantity-stepper"
              role="group"
              aria-labelledby="quantity-label"
            >
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={!inStock || quantity <= 1}
                onClick={() => changeQuantity(quantity - 1)}
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <output aria-label="Selected quantity" aria-live="polite">
                {quantity}
              </output>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={!inStock || quantity >= variant.stock}
                onClick={() => changeQuantity(quantity + 1)}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="product-purchase-buttons">
            <button
              type="button"
              className="product-add-button"
              disabled={!inStock}
              aria-describedby="cart-feature-note"
              onClick={handleAddToBag}
            >
              <ShoppingBag size={18} aria-hidden="true" />
              Add to Bag
            </button>
            <button
              type="button"
              className="product-buy-now-button"
              disabled={!inStock}
              onClick={handleBuyNow}
            >
              <span>Buy Now</span>
              <span className="product-buy-now-icon" aria-hidden="true">
                <ArrowUpRight size={15} />
              </span>
            </button>
          </div>
        </div>
        <p
          id="cart-feature-note"
          className={`product-cart-note ${cartNotice ? "is-announced" : ""}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {cartNotice
            ? `Added ${quantity} to your shopping bag`
            : "Nationwide delivery available across Bangladesh."}
        </p>
        {renderedDelivery}
      </div>
    </div>
  );
}
