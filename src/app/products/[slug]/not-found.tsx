import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import "./product.css";

export default function ProductNotFound() {
  return <><SiteHeader activePage="shop" /><main id="main-content" className="page-container product-not-found"><p className="product-eyebrow">HAYANEST BD COLLECTION</p><h1>Product not found</h1><p>This piece is no longer available. Explore the collection to find another favourite.</p><Link href="/shop" className="product-back-link">Back to Shop</Link></main><SiteFooter /><MobileBottomNav activePage="shop" /></>;
}
