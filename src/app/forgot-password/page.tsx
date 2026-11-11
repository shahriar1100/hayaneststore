import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import "@/app/login/auth.css";

export const metadata: Metadata = {
  title: "Forgot Password | HayaNest BD",
  description: "Reset your HayaNest BD account password securely using your email address.",
};

export default function ForgotPasswordPage() {
  return (
    <div>
      <SiteHeader activePage="account" />
      <main id="main-content" className="page-container auth-page">
        <ForgotPasswordForm />
      </main>
      <SiteFooter />
      <MobileBottomNav activePage="account" />
    </div>
  );
}
