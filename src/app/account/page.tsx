import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { AccountContent } from "@/components/account/account-content";
import { getAllStoreProducts } from "@/lib/server/store-repository";
import "./account.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My Account | HayaNest BD" };

export default async function AccountPage() {
  const products = await getAllStoreProducts();
  return (
    <>
      <SiteHeader activePage="account" />
      <main id="main-content" className="page-container account-page">
        <Suspense>
          <AccountContent catalog={products} />
        </Suspense>
      </main>
      <SiteFooter />
      <MobileBottomNav activePage="account" />
    </>
  );
}
