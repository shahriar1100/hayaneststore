"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { resetPasswordWithTokenAsync } from "@/lib/auth";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") || searchParams.get("code") || "";

  const [tokenOrCode, setTokenOrCode] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [precheckStatus, setPrecheckStatus] = useState<{
    checkedFor: string;
    ok: boolean;
    email?: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    const clean = initialToken.replace(/\s+/g, "").trim();
    if (!clean) return;
    let active = true;
    void fetch(`/api/auth/reset-password?token=${encodeURIComponent(clean)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          email?: string;
          error?: string;
        };
        if (!active) return;
        if (res.ok && data.ok) {
          setPrecheckStatus({
            checkedFor: clean,
            ok: true,
            email: data.email,
          });
        } else {
          setPrecheckStatus({
            checkedFor: clean,
            ok: false,
            message:
              data.error || "This reset link or verification code is invalid or has expired.",
          });
        }
      })
      .catch(() => {
        // Ignore network precheck errors and let submit validate normally.
      });
    return () => {
      active = false;
    };
  }, [initialToken]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const cleanToken = tokenOrCode.trim();
    if (!cleanToken) {
      setError("Please provide the reset token or 6-digit verification code from your email.");
      return;
    }

    if (newPassword.length < 4) {
      setError("Password must be at least 4 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match. Please re-enter.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await resetPasswordWithTokenAsync(cleanToken, newPassword);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(true);
      if (result.email) setVerifiedEmail(result.email);
    } catch {
      setError("Failed to reset password. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="auth-shell">
        <section className="auth-card" aria-labelledby="success-heading">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }} className="auth-eyebrow">
            <ShieldCheck size={12} aria-hidden="true" />
            <span>Password Updated</span>
          </div>

          <h1 id="success-heading">Password reset successful!</h1>
          <p className="auth-subtitle">
            Your account password has been updated. You can now sign in using your {verifiedEmail ? `email (${verifiedEmail})` : "new credentials"}.
          </p>

          <div
            style={{
              padding: "16px 18px",
              borderRadius: "14px",
              background: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34, 197, 94, 0.25)",
              color: "var(--ink)",
              marginBottom: "24px",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <CheckCircle2 size={20} style={{ color: "#16a34a", flexShrink: 0 }} />
            <span>Your new password is now active across all devices.</span>
          </div>

          <Link
            href="/login"
            className="auth-submit"
            style={{ display: "block", textAlign: "center", textDecoration: "none" }}
          >
            Sign In with New Password →
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <section className="auth-card" aria-labelledby="reset-heading">
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }} className="auth-eyebrow">
          <KeyRound size={12} aria-hidden="true" />
          <span>New Password</span>
        </div>

        <h1 id="reset-heading">Create New Password</h1>
        <p className="auth-subtitle">
          Enter your 6-digit verification code or reset token from your email and choose a strong new password.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {precheckStatus &&
            precheckStatus.checkedFor === tokenOrCode.replace(/\s+/g, "").trim() && (
              <div
                style={{
                  padding: "10px 13px",
                  borderRadius: 10,
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  background: precheckStatus.ok
                    ? "rgba(34, 197, 94, 0.08)"
                    : "rgba(220, 38, 38, 0.1)",
                  border: precheckStatus.ok
                    ? "1px solid rgba(34, 197, 94, 0.28)"
                    : "1px solid rgba(220, 38, 38, 0.32)",
                  color: precheckStatus.ok ? "#166534" : "#b91c1c",
                }}
              >
                {precheckStatus.ok
                  ? `Reset session verified for ${precheckStatus.email || "your account"}. Choose your new password below.`
                  : precheckStatus.message}
              </div>
            )}
          <div className="auth-field">
            <label htmlFor="reset-token-input">Verification Code or Reset Token *</label>
            <input
              id="reset-token-input"
              type="text"
              required
              placeholder="e.g. 6-digit code (482910) or token from email"
              value={tokenOrCode}
              onChange={(e) => {
                setTokenOrCode(e.target.value);
                setError("");
              }}
            />
            <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
              Found in the password reset email sent to your inbox.
            </span>
          </div>

          <div className="auth-field">
            <label htmlFor="reset-new-password">New Password (min 4 characters) *</label>
            <div className="auth-password-wrap">
              <input
                id="reset-new-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={4}
                autoComplete="new-password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError("");
                }}
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

          <div className="auth-field">
            <label htmlFor="reset-confirm-password">Confirm New Password *</label>
            <div className="auth-password-wrap">
              <input
                id="reset-confirm-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={4}
                autoComplete="new-password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
              />
            </div>
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? "Resetting Password…" : "Save New Password"}
          </button>
        </form>

        <div className="auth-footer-links">
          <span>Need a new code? </span>
          <Link href="/forgot-password">Request another email →</Link>
        </div>
      </section>
    </div>
  );
}
