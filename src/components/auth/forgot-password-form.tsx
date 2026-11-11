"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Mail, Sparkles } from "lucide-react";
import { requestPasswordResetAsync } from "@/lib/auth";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successData, setSuccessData] = useState<{
    message: string;
    email: string;
    devMode?: boolean;
    devPreview?: { code: string; token: string; resetUrl: string };
  } | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestPasswordResetAsync(cleanEmail);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccessData({
        message: result.message,
        email: cleanEmail,
        devMode: result.devMode,
        devPreview: result.devPreview,
      });
    } catch {
      setError("Failed to send password reset request. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  if (successData) {
    return (
      <div className="auth-shell">
        <section className="auth-card" aria-labelledby="sent-heading">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }} className="auth-eyebrow">
            <Mail size={12} aria-hidden="true" />
            <span>Email Sent</span>
          </div>

          <h1 id="sent-heading">Check your inbox</h1>
          <p className="auth-subtitle">
            We have sent a verification code and password reset instructions to{" "}
            <strong>{successData.email}</strong>.
          </p>

          <div
            style={{
              padding: "16px 18px",
              borderRadius: "14px",
              background: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34, 197, 94, 0.25)",
              color: "var(--ink)",
              marginBottom: "20px",
              fontSize: "13px",
              lineHeight: 1.6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "#166534", marginBottom: "4px" }}>
              <CheckCircle2 size={16} />
              <span>Reset instructions on the way</span>
            </div>
            Please check your spam or promotions folder if you don&apos;t see the email within 1–2 minutes. The link and code expire in 15 minutes.
          </div>

          {/* Dev Mode Banner (only shown when SMTP is not configured) */}
          {successData.devMode && successData.devPreview && (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: "12px",
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px dashed rgba(245, 158, 11, 0.4)",
                marginBottom: "20px",
                fontSize: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "#b45309", marginBottom: "6px" }}>
                <Sparkles size={14} />
                <span>Development Testing Mode (SMTP not configured)</span>
              </div>
              <p style={{ margin: "0 0 6px" }}>
                Your 6-digit verification code is: <strong style={{ fontSize: "15px", letterSpacing: "2px" }}>{successData.devPreview.code}</strong>
              </p>
              <Link
                href={`/reset-password?token=${encodeURIComponent(successData.devPreview.token)}`}
                style={{ fontWeight: 600, color: "var(--link, #8b5cf6)", textDecoration: "underline" }}
              >
                Click here to open Reset Password page directly →
              </Link>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <Link
              href={`/reset-password${successData.devPreview?.token ? `?token=${encodeURIComponent(successData.devPreview.token)}` : ""}`}
              className="auth-submit"
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              Enter Code &amp; Set New Password
            </Link>

            <button
              type="button"
              onClick={() => {
                setSuccessData(null);
                setEmail("");
              }}
              style={{
                background: "transparent",
                border: "1px solid var(--line)",
                padding: "11px",
                borderRadius: "999px",
                fontSize: "13px",
                cursor: "pointer",
                color: "var(--ink)",
              }}
            >
              Use a different email address
            </button>
          </div>

          <div className="auth-footer-links" style={{ marginTop: "24px" }}>
            <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <ArrowLeft size={14} />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <section className="auth-card" aria-labelledby="forgot-heading">
        <span className="auth-eyebrow">Account Security</span>
        <h1 id="forgot-heading">Forgot Password</h1>
        <p className="auth-subtitle">
          Enter the email address registered with your HayaNest BD account. We will send you a secure verification link and code to set a new password.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="forgot-email">Account Email Address *</label>
            <input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
            />
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? "Sending Reset Email…" : "Send Password Reset Link"}
          </button>
        </form>

        <div className="auth-footer-links">
          <span>Remembered your password? </span>
          <Link href="/login">Sign in here →</Link>
        </div>
      </section>
    </div>
  );
}
