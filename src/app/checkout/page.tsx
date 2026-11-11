import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { CheckoutContent } from "@/components/checkout/checkout-content";
import { getAllStoreProducts, getStoreSettings } from "@/lib/server/store-repository";
import "./checkout.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout | HayaNest BD",
  description: "Complete your HayaNest BD hijab and modest accessories order.",
};

export default async function CheckoutPage() {
  const [products, settings] = await Promise.all([
    getAllStoreProducts({ bypassCache: true }),
    getStoreSettings({ bypassCache: true }),
  ]);

  return (
    <>
      <SiteHeader activePage="cart" />
      <main id="main-content" className="page-container checkout-page">
        <p className="checkout-eyebrow">SECURE CHECKOUT</p>
        <h1>Checkout</h1>
        <CheckoutContent
          catalog={products}
          shippingFees={{
            insideDhaka: settings.insideDhakaShippingFee,
            outsideDhaka: settings.outsideDhakaShippingFee,
          }}
          paymentSettings={settings.manualPayment}
          supportPhone={settings.contactPhone}
        />
      </main>
      <SiteFooter />
      <MobileBottomNav activePage="cart" />
    </>
  );
}
