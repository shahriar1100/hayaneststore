import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { AuthForm } from "@/components/auth/auth-form";
import "../login/auth.css";

export const metadata: Metadata = {
  title: "Create Account | HayaNest BD",
  description: "Create an optional HayaNest BD account to save your delivery details and track orders.",
};

export default function SignupPage() {
  return (
    <div>
      <SiteHeader activePage="account" />
      <main id="main-content" className="page-container auth-page">
        <AuthForm mode="signup" />
      </main>
      <SiteFooter />
      <MobileBottomNav activePage="account" />
    </div>
  );
}
