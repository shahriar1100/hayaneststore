import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { AuthForm } from "@/components/auth/auth-form";
import "./auth.css";

export const metadata: Metadata = {
  title: "Sign In | HayaNest BD",
  description: "Sign in to your HayaNest BD account or continue shopping as a guest.",
};

export default function LoginPage() {
  return (
    <div>
      <SiteHeader activePage="account" />
      <main id="main-content" className="page-container auth-page">
        <AuthForm mode="login" />
      </main>
      <SiteFooter />
      <MobileBottomNav activePage="account" />
    </div>
  );
}
