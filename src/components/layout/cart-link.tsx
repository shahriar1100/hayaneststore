"use client";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCartProducts } from "@/lib/cart-products";
export function CartLink({ variant, active = false }: { variant: "header" | "bottom"; active?: boolean }) { const { items } = useCartProducts(); const count = items.reduce((total, item) => total + item.quantity, 0); return <Link href="/cart" className={variant === "header" ? `icon-button bag-button ${active ? "active" : ""}` : `bottom-nav-item ${active ? "selected" : ""}`} aria-label={`Shopping bag, ${count} items`} aria-current={active ? "page" : undefined}><span className="relative"><ShoppingBag />{count > 0 && <span className="bag-badge">{count}</span>}</span>{variant === "bottom" && <span>Bag</span>}</Link>; }
