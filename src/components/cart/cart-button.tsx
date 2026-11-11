"use client";
import { ShoppingBag } from "lucide-react";
import { useCartProducts } from "@/lib/cart-products";
export function CartButton() { const { items } = useCartProducts(); const count = items.reduce((sum, item) => sum + item.quantity, 0); return <button type="button" className="icon-button bag-button" aria-label={`Open shopping bag, ${count} ${count === 1 ? "item" : "items"}`} onClick={() => window.dispatchEvent(new Event("noor:open-cart"))}><ShoppingBag />{count > 0 && <span className="bag-badge" aria-hidden="true">{count}</span>}</button>; }
