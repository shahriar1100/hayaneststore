"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogOut, ShieldCheck, ShoppingBag, UserCheck } from "lucide-react";
import { announceNotice } from "@/components/ui/coming-soon";
import { loginUserAsync, logoutUser, signupUserAsync, useAuth } from "@/lib/auth";
import { syncCustomerOrders, useOrders } from "@/lib/orders";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { user, ready } = useAuth();
  const { orders } = useOrders();
  const latestOrderCustomer = orders[0]?.customer;

  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const effectiveName = name ?? latestOrderCustomer?.name ?? "";
  const effectivePhone = phone ?? latestOrderCustomer?.phone ?? "";
  const effectiveEmail = email ?? latestOrderCustomer?.email ?? "";
  const effectiveCity = city ?? latestOrderCustomer?.city ?? "Dhaka";
  const effectiveAddress = address ?? latestOrderCustomer?.address ?? "";

  if (!ready) {
    return <p className="checkout-status">Loading account status…</p>;
  }

  if (user) {
    return (
      <div className="auth-shell">
        <section className="auth-card" aria-labelledby="signed-in-heading">
          <span className="auth-eyebrow">Signed In</span>
          <h1 id="signed-in-heading">Welcome, {user.name}</h1>
          <p className="auth-subtitle">
            You are signed in with <strong>{user.phone}</strong>
            {user.email ? ` (${user.email})` : ""}. Your orders and delivery details are linked to your account.
          </p>

          <div className="confirmation-actions" style={{ justifyContent: "flex-start" }}>
            <Link href="/account" className="auth-submit">
              <UserCheck size={16} aria-hidden="true" />
              Go to My Account
            </Link>
            <Link href="/shop" className="checkout-secondary" style={{ borderRadius: "999px" }}>
              <ShoppingBag size={16} aria-hidden="true" />
              Continue Shopping
            </Link>
          </div>

          <div className="auth-footer-links">
            <span>Want to switch accounts?</span>
            <button
              type="button"
              onClick={() => {
                logoutUser();
                announceNotice("Signed out", "You are now browsing as a guest.");
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--link)", fontWeight: 600 }}
            >
              <LogOut size={15} aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </section>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (mode === "login") {
        const result = await loginUserAsync({ identifier, password });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        await syncCustomerOrders({ phone: result.user.phone, email: result.user.email });
        announceNotice("Signed in", `Welcome back, ${result.user.name}!`);
        router.push("/account");
      } else {
        if (!effectiveEmail?.trim() || !effectiveEmail.includes("@") || !effectiveEmail.includes(".")) {
          setError("A valid email address is required for account creation and password recovery.");
          setSubmitting(false);
          return;
        }
        const result = await signupUserAsync({
          name: effectiveName,
          phone: effectivePhone,
          email: effectiveEmail.trim().toLowerCase(),
          city: effectiveCity,
          address: effectiveAddress,
          password,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        await syncCustomerOrders({ phone: result.user.phone, email: result.user.email });
        announceNotice("Account created", `Welcome to HayaNest BD, ${result.user.name}!`);
        router.push("/account");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-guest-notice">
        <ShieldCheck size={20} aria-hidden="true" />
        <div>
          <strong>Guest Shopping is Always Open — Login is Optional</strong>
          <p>
            You can browse and purchase any product without an account. Sign in or create an account only if you want
            to save your delivery details and track orders easily.
          </p>
        </div>
      </div>

      <section className="auth-card" aria-labelledby="auth-heading">
        <span className="auth-eyebrow">{mode === "login" ? "Member Access" : "Optional Account"}</span>
        <h1 id="auth-heading">{mode === "login" ? "Sign In to HayaNest BD" : "Create Your Account"}</h1>
        <p className="auth-subtitle">
          {mode === "login"
            ? "Access your saved delivery addresses, wishlist, and order history."
            : latestOrderCustomer
              ? "We pre-filled your recent order details below — just set a password to save your account!"
              : "Save your contact and delivery address for faster 1-click checkout on future orders."}
        </p>

        <div className="auth-tabs">
          <Link href="/login" className={`auth-tab ${mode === "login" ? "active" : ""}`}>
            Login
          </Link>
          <Link href="/signup" className={`auth-tab ${mode === "signup" ? "active" : ""}`}>
            Sign Up
          </Link>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "login" ? (
            <div className="auth-field">
              <label htmlFor="auth-identifier">Phone Number or Email *</label>
              <input
                id="auth-identifier"
                type="text"
                required
                autoComplete="username"
                placeholder="01XXXXXXXXX or you@example.com"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="auth-field">
                <label htmlFor="auth-name">Full Name *</label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="e.g. Ayesha Rahman"
                  value={effectiveName}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div className="auth-field-row">
                <div className="auth-field">
                  <label htmlFor="auth-phone">Phone Number *</label>
                  <input
                    id="auth-phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="01XXXXXXXXX"
                    value={effectivePhone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="auth-email">Email Address *</label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={effectiveEmail}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </div>

              <div className="auth-field-row">
                <div className="auth-field">
                  <label htmlFor="auth-city">City (Optional)</label>
                  <input
                    id="auth-city"
                    type="text"
                    placeholder="Dhaka"
                    value={effectiveCity}
                    onChange={(event) => setCity(event.target.value)}
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="auth-address">Default Delivery Address (Optional)</label>
                  <input
                    id="auth-address"
                    type="text"
                    placeholder="House, Road, Area"
                    value={effectiveAddress}
                    onChange={(event) => setAddress(event.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="auth-field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <label htmlFor="auth-password" style={{ margin: 0 }}>
                {mode === "login" ? "Password *" : "Create Password (min 4 characters) *"}
              </label>
              {mode === "login" && (
                <Link
                  href="/forgot-password"
                  style={{
                    fontSize: 12,
                    color: "var(--link, #8b5cf6)",
                    textDecoration: "underline",
                    fontWeight: 500,
                  }}
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <div className="auth-password-wrap">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={4}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="auth-password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="auth-footer-links">
          <span>
            {mode === "login" ? "New to HayaNest BD? " : "Already have an account? "}
            <Link href={mode === "login" ? "/signup" : "/login"}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </Link>
          </span>
          <Link href="/shop">Continue as Guest →</Link>
        </div>
      </section>
    </div>
  );
}
