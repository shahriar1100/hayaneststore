import { Suspense } from "react";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import "@/app/login/auth.css";

export const metadata: Metadata = {
  title: "Reset Password | HayaNest BD",
  description: "Set a new secure password for your HayaNest BD account.",
};

export default function ResetPasswordPage() {
  return (
    <div>
      <SiteHeader activePage="account" />
      <main id="main-content" className="page-container auth-page">
        <Suspense fallback={<p className="checkout-status">Loading password reset form…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </main>
      <SiteFooter />
      <MobileBottomNav activePage="account" />
    </div>
  );
}
