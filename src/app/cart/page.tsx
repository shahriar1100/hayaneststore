import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { CartContent } from "@/components/cart/cart-content";
import { getAllStoreProducts } from "@/lib/server/store-repository";
import "./cart.css";

export const metadata: Metadata = { title: "Shopping Bag | HayaNest BD" };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const products = await getAllStoreProducts();
  return (
    <>
      <SiteHeader activePage="cart" />
      <main id="main-content" className="page-container cart-page">
        <p className="cart-eyebrow">YOUR SHOPPING BAG</p>
        <h1>Cart</h1>
        <CartContent catalog={products} />
      </main>
      <SiteFooter />
      <MobileBottomNav activePage="cart" />
    </>
  );
}
