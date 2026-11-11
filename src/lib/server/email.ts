import nodemailer from "nodemailer";
import type { Order } from "@/lib/orders";
import { getStoreSettings } from "@/lib/server/store-repository";

type SendResetEmailParams = {
  to: string;
  name: string;
  resetUrl: string;
  resetCode: string;
};

type EmailResult = {
  ok: boolean;
  devMode: boolean;
  message: string;
  resetUrl?: string;
  resetCode?: string;
};

/**
 * Creates a nodemailer transporter if SMTP credentials are provided.
 * Environment variables:
 * - SMTP_HOST
 * - SMTP_PORT (default 587 or 465)
 * - SMTP_SECURE ('true' for 465, 'false' for 587/other)
 * - SMTP_USER
 * - SMTP_PASS
 * - SMTP_FROM (e.g. '"HayaNest BD" <no-reply@hayanestbd.com>')
 */
function getTransporter() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }
  return null;
}

export function extractEmailAddress(raw: string): string {
  const bracketMatch = raw.match(/<([^>]+)>/);
  if (bracketMatch?.[1]) return bracketMatch[1].trim().toLowerCase();
  const bareMatch = raw.match(/([^\s<>"]+@[^\s<>"]+)/);
  return (bareMatch?.[1] || raw).trim().toLowerCase();
}

export type ResolvedEmailConfig = {
  host: string;
  port: number;
  user: string;
  provider: string;
  hasResend: boolean;
  hasSmtpCreds: boolean;
  from: string;
  fromEmail: string;
  fromName: string;
  usesBrevoLoginFrom: boolean;
  senderReady: boolean;
  contactEmail: string;
};

export async function resolveEmailConfig(): Promise<ResolvedEmailConfig> {
  const settings = await getStoreSettings({ bypassCache: true }).catch(() => null);
  const host = process.env.SMTP_HOST?.trim() || "";
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER?.trim() || "";
  const pass = process.env.SMTP_PASS?.trim() || "";
  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasSmtpCreds = Boolean(host && user && pass);
  const provider = host.includes("brevo")
    ? "Brevo"
    : hasResend
      ? "Resend"
      : host
        ? "Custom SMTP"
        : "None";

  const settingsFromEmail = settings?.emailSettings?.fromEmail?.trim() || "";
  const settingsFromName =
    settings?.emailSettings?.fromName?.trim() || settings?.storeName || "HayaNest BD";
  const envFrom = process.env.SMTP_FROM?.trim() || "";

  let from = "";
  if (
    settingsFromEmail &&
    settingsFromEmail.includes("@") &&
    settingsFromEmail.includes(".") &&
    !settingsFromEmail.toLowerCase().endsWith("@smtp-brevo.com")
  ) {
    from = `"${settingsFromName.replace(/"/g, "")}" <${settingsFromEmail}>`;
  } else if (envFrom) {
    from = envFrom;
  } else if (settingsFromEmail) {
    from = `"${settingsFromName.replace(/"/g, "")}" <${settingsFromEmail}>`;
  } else if (hasResend) {
    from = "HayaNest BD <onboarding@resend.dev>";
  } else {
    from = `"HayaNest BD" <no-reply@hayanestbd.com>`;
  }

  const fromEmail = extractEmailAddress(from);
  const usesBrevoLoginFrom = fromEmail.endsWith("@smtp-brevo.com");
  const senderReady = Boolean(
    fromEmail && fromEmail.includes("@") && fromEmail.includes(".") && !usesBrevoLoginFrom,
  );
  const contactEmail = settings?.contactEmail?.trim() || "support@hayanestbd.com";

  return {
    host,
    port,
    user,
    provider,
    hasResend,
    hasSmtpCreds,
    from,
    fromEmail,
    fromName: settingsFromName,
    usesBrevoLoginFrom,
    senderReady,
    contactEmail,
  };
}

export type SmtpVerifyStatus = {
  ok: boolean;
  handshakeOk: boolean;
  configured: boolean;
  provider: string;
  host: string;
  port: number;
  user: string;
  from: string;
  fromEmail: string;
  fromName: string;
  verified: boolean;
  usesBrevoLoginFrom: boolean;
  message: string;
};

/**
 * Checks whether SMTP / Resend is configured and tests the live SMTP handshake
 * without sending an actual transactional email.
 */
export async function verifySmtpConnection(): Promise<SmtpVerifyStatus> {
  const cfg = await resolveEmailConfig();
  const transporter = getTransporter();

  if (!transporter) {
    if (cfg.hasResend) {
      return {
        ok: true,
        handshakeOk: true,
        configured: true,
        provider: "Resend",
        host: "api.resend.com",
        port: 443,
        user: "",
        from: cfg.from,
        fromEmail: cfg.fromEmail,
        fromName: cfg.fromName,
        verified: true,
        usesBrevoLoginFrom: cfg.usesBrevoLoginFrom,
        message: "Resend API key is configured.",
      };
    }
    return {
      ok: false,
      handshakeOk: false,
      configured: false,
      provider: cfg.provider,
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      from: cfg.from,
      fromEmail: cfg.fromEmail,
      fromName: cfg.fromName,
      verified: false,
      usesBrevoLoginFrom: cfg.usesBrevoLoginFrom,
      message: "SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are not configured.",
    };
  }

  try {
    const handshakeOk = Boolean(await transporter.verify());
    const ok = handshakeOk && cfg.senderReady;
    return {
      ok,
      handshakeOk,
      configured: true,
      provider: cfg.provider,
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      from: cfg.from,
      fromEmail: cfg.fromEmail,
      fromName: cfg.fromName,
      verified: ok,
      usesBrevoLoginFrom: cfg.usesBrevoLoginFrom,
      message: !handshakeOk
        ? "SMTP verification returned false."
        : cfg.usesBrevoLoginFrom
          ? "SMTP handshake succeeded, BUT Sender (From) is set to Brevo's relay login (@smtp-brevo.com), which enforces SPF (-all) & DMARC (p=reject) and CANNOT reach customer inboxes. Verify an email in Brevo -> Senders, Domains & IPs -> Senders, enter it below, and save."
          : `SMTP relay & Verified Sender (${cfg.fromEmail}) verified and ready to deliver.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SMTP handshake failed.";
    return {
      ok: false,
      handshakeOk: false,
      configured: cfg.hasSmtpCreds,
      provider: cfg.provider,
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      from: cfg.from,
      fromEmail: cfg.fromEmail,
      fromName: cfg.fromName,
      verified: false,
      usesBrevoLoginFrom: cfg.usesBrevoLoginFrom,
      message: msg,
    };
  }
}

export async function sendTestTransactionalEmail(
  rawTo: string,
): Promise<{
  ok: boolean;
  message: string;
  from?: string;
  messageId?: string;
  smtpResponse?: string;
}> {
  const to = rawTo.trim().toLowerCase();
  if (!to || !to.includes("@") || !to.includes(".")) {
    return { ok: false, message: "Please enter a valid recipient email address." };
  }

  const cfg = await resolveEmailConfig();
  if (cfg.usesBrevoLoginFrom) {
    return {
      ok: false,
      from: cfg.from,
      message:
        "Cannot deliver while Sender (From) is set to @smtp-brevo.com (SPF -all & DMARC p=reject). Save your Verified Sender email from Brevo first.",
    };
  }

  const subject = "HayaNest BD — SMTP Delivery Verification";
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="margin: 0 0 8px; color: #541438;">HayaNest BD Email Test Passed</h2>
      <p style="font-size: 14px; color: #334155; line-height: 1.6;">
        This test confirms your transactional email configuration is working and delivering emails properly from <strong>${cfg.fromEmail}</strong>.
      </p>
      <p style="font-size: 12px; color: #64748b; margin-top: 16px;">
        Customer password reset codes and order invoices will now be delivered via ${cfg.provider}.
      </p>
    </div>
  `;

  if (cfg.hasResend) {
    try {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: cfg.from, to: [to], subject, html }),
      });
      if (resendRes.ok) {
        return { ok: true, from: cfg.from, message: `Test email sent via Resend to ${to}.` };
      }
      const errBody = await resendRes.text().catch(() => "");
      return {
        ok: false,
        from: cfg.from,
        message: `Resend API error HTTP ${resendRes.status}${errBody ? `: ${errBody}` : ""}`,
      };
    } catch (err) {
      return {
        ok: false,
        from: cfg.from,
        message: err instanceof Error ? err.message : "Resend request failed.",
      };
    }
  }

  const transporter = getTransporter();
  if (!transporter) {
    return {
      ok: false,
      message: "SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are not configured.",
    };
  }

  try {
    const info = await transporter.sendMail({
      from: cfg.from,
      replyTo: cfg.fromEmail || undefined,
      to,
      subject,
      text: `HayaNest BD test email delivered from ${cfg.fromEmail}. Password resets and order invoices are operational.`,
      html,
    });
    if (Array.isArray(info.accepted) && info.accepted.length === 0) {
      return {
        ok: false,
        from: cfg.from,
        message: `SMTP rejected recipient: ${(info.rejected || []).join(", ") || "unknown error"}`,
      };
    }
    return {
      ok: true,
      from: cfg.from,
      messageId: info.messageId,
      smtpResponse: info.response,
      message: `Test email accepted by ${cfg.provider} for ${to} from ${cfg.fromEmail}! Check your Inbox (and Spam/Brevo Logs).`,
    };
  } catch (err) {
    return {
      ok: false,
      from: cfg.from,
      message: err instanceof Error ? err.message : "SMTP sendMail failed.",
    };
  }
}

/**
 * Sends a password reset email using SMTP, Resend API, or development fallback.
 */
export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
  resetCode,
}: SendResetEmailParams): Promise<EmailResult> {
  const brandName = "HayaNest BD";
  const cfg = await resolveEmailConfig();
  const fromAddress = cfg.from;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password — ${brandName}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
        .wrapper { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { background: #541438; color: #ffffff; padding: 28px 32px; text-align: center; }
        .header h1 { margin: 0; font-family: Georgia, serif; font-size: 26px; letter-spacing: 2px; }
        .header p { margin: 6px 0 0; font-size: 12px; opacity: 0.8; letter-spacing: 1px; text-transform: uppercase; color: #c59b6d; }
        .body { padding: 32px; }
        .greeting { font-size: 17px; font-weight: 600; margin-bottom: 12px; }
        .copy { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
        .code-box { background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 18px; text-align: center; margin: 24px 0; }
        .code-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 6px; }
        .code-val { font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a; font-family: monospace; }
        .btn-wrap { text-align: center; margin: 28px 0; }
        .btn { display: inline-block; background: #541438; color: #ffffff !important; text-decoration: none; padding: 13px 30px; border-radius: 999px; font-size: 14px; font-weight: 600; letter-spacing: 0.5px; }
        .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5; }
        .warning { font-size: 12px; color: #dc2626; background: #fef2f2; padding: 10px 14px; border-radius: 8px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>HayaNest BD</h1>
          <p>Everything She Loves</p>
        </div>
        <div class="body">
          <div class="greeting">Salam / Hello, ${name || "Valued Customer"}!</div>
          <p class="copy">
            We received a request to reset the password for your <strong>HayaNest BD</strong> account associated with this email address (${to}).
          </p>

          <div class="code-box">
            <div class="code-label">Your 6-Digit Password Reset Code</div>
            <div class="code-val">${resetCode}</div>
          </div>

          <div class="btn-wrap">
            <a href="${resetUrl}" class="btn" target="_blank">Reset Password Directly</a>
          </div>

          <p class="copy" style="font-size: 13px;">
            Or copy and paste this link into your browser:<br>
            <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
          </p>

          <div class="warning">
            ⏰ This link and verification code will expire in <strong>15 minutes</strong>. If you did not make this request, you can safely ignore this email; your account remains secure.
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} HayaNest BD. All rights reserved.<br>
          Dhaka, Bangladesh · ${cfg.contactEmail}
        </div>
      </div>
    </body>
    </html>
  `;

  const hasResend = cfg.hasResend;
  const transporter = getTransporter();
  const hasSmtp = Boolean(transporter);
  let lastErrorMessage = "";

  // 1. Try Resend API if RESEND_API_KEY is configured
  if (hasResend) {
    try {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [to],
          subject: "Reset your HayaNest BD account password",
          html: htmlContent,
        }),
      });
      if (resendRes.ok) {
        return {
          ok: true,
          devMode: false,
          message: `Password reset email sent to ${to}.`,
        };
      }
      lastErrorMessage = `Resend API responded with HTTP ${resendRes.status}`;
    } catch (err) {
      lastErrorMessage = err instanceof Error ? err.message : "Resend request failed.";
      console.warn("[Resend API Error]", err);
    }
  }

  // 2. Try SMTP Transporter if configured
  if (transporter) {
    if (cfg.usesBrevoLoginFrom) {
      lastErrorMessage =
        "Password reset email cannot be delivered yet because the store's sender (SMTP_FROM) is set to Brevo's login address (@smtp-brevo.com), which fails SPF/DMARC delivery. Admin: set a Verified Sender email in Admin -> Integrations -> Brevo (or .env.local SMTP_FROM).";
    } else {
      try {
        const info = await transporter.sendMail({
          from: fromAddress,
          replyTo: cfg.fromEmail || undefined,
          to,
          subject: "Reset your HayaNest BD account password",
          text: `Your password reset code is ${resetCode}. Or reset directly at: ${resetUrl} (expires in 15 minutes).`,
          html: htmlContent,
        });
        if (Array.isArray(info.accepted) && info.accepted.length === 0) {
          throw new Error(
            `SMTP rejected recipient ${(info.rejected || []).join(", ") || to}`,
          );
        }
        return {
          ok: true,
          devMode: false,
          message: `Password reset email sent to ${to}.`,
        };
      } catch (err) {
        lastErrorMessage = err instanceof Error ? err.message : "SMTP sendMail failed.";
        console.warn("[SMTP Error]", err);
      }
    }
  }

  // Never leak reset tokens or verification codes to the HTTP response when an email
  // provider is configured (and fail closed in production).
  if (hasResend || hasSmtp || process.env.NODE_ENV === "production") {
    return {
      ok: false,
      devMode: false,
      message:
        lastErrorMessage ||
        "Email delivery service is temporarily unavailable. Please verify SMTP credentials or contact support.",
    };
  }

  // 3. Fallback for Local Development & Testing ONLY when no email provider is configured
  console.info(
    `\n%c======================================================\n` +
      `[DEV EMAIL NOTIFICATION] Password Reset for: ${to}\n` +
      `Verification Code: ${resetCode}\n` +
      `Reset URL: ${resetUrl}\n` +
      `Expires in 15 minutes.\n` +
      `======================================================\n`,
    "color: #16a34a; font-weight: bold;",
  );

  return {
    ok: true,
    devMode: true,
    message: `Password reset code sent. (Dev mode: check console or use code ${resetCode})`,
    resetUrl,
    resetCode,
  };
}

/**
 * Sends an order confirmation email to the customer.
 */
export async function sendOrderConfirmationEmail({
  order,
  to,
}: {
  order: Order;
  to: string;
}): Promise<{ ok: boolean; devMode: boolean; message: string }> {
  const cfg = await resolveEmailConfig();
  const fromAddress = cfg.from;

  const itemsRows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
          <strong style="color: #111827;">${item.name}</strong><br>
          <span style="font-size: 12px; color: #6b7280;">Colour: ${item.colour} · Qty: ${item.quantity}</span>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right; color: #111827; font-weight: 600;">
          ৳${item.price * item.quantity}
        </td>
      </tr>
    `,
    )
    .join("");

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Order Confirmed — HayaNest BD</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 24px; color: #1f2937;">
      <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
        <div style="background: #541438; padding: 32px 28px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 26px; letter-spacing: 0.12em; font-family: Georgia, serif;">HayaNest BD</h1>
          <p style="margin: 6px 0 0 0; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #c59b6d;">Everything She Loves · Order Confirmation</p>
        </div>
        <div style="padding: 32px 28px;">
          <h2 style="font-size: 18px; color: #111827; margin: 0 0 8px 0;">Thank you for your order, ${order.customer.name}!</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0 0 20px 0;">
            We've received your order <strong>#${order.id}</strong>. We are carefully packing your modest essentials with love.
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Order ID:</strong> #${order.id}</p>
            <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Payment Method:</strong> ${order.paymentMethod === "cod" ? "Cash on Delivery (COD)" : `${order.paymentMethod.toUpperCase()} (Manual Send Money)`}</p>
            <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Payment Status:</strong> ${order.paymentStatus === "Paid" ? "Verified · Paid" : "Pending Verification"}</p>
            ${order.paymentPhone ? `<p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Sender Number:</strong> ${order.paymentPhone}</p>` : ""}
            ${order.paymentTrxId ? `<p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Transaction ID (TrxID):</strong> ${order.paymentTrxId}</p>` : ""}
            <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Delivery Zone:</strong> ${order.deliveryZone === "inside-dhaka" ? "Inside Dhaka (৳" + order.shippingFee + ")" : "Outside Dhaka (৳" + order.shippingFee + ")"}</p>
            <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Delivery Address:</strong> ${order.customer.address}, ${order.customer.city}</p>
            <p style="margin: 0; font-size: 13px;"><strong>Phone:</strong> ${order.customer.phone}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="border-bottom: 2px solid #e5e7eb; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">
                <th style="padding-bottom: 8px;">Item</th>
                <th style="padding-bottom: 8px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
            <tfoot>
              <tr>
                <td style="padding: 8px 0; color: #4b5563; font-size: 14px;">Subtotal</td>
                <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px;">৳${order.subtotal}</td>
              </tr>
              ${
                order.discountAmount
                  ? `<tr>
                  <td style="padding: 4px 0; color: #16a34a; font-size: 14px;">Discount ${order.couponCode ? `(${order.couponCode})` : ""}</td>
                  <td style="padding: 4px 0; text-align: right; color: #16a34a; font-size: 14px;">-৳${order.discountAmount}</td>
                </tr>`
                  : ""
              }
              <tr>
                <td style="padding: 4px 0; color: #4b5563; font-size: 14px;">Delivery Fee</td>
                <td style="padding: 4px 0; text-align: right; color: #111827; font-size: 14px;">৳${order.shippingFee}</td>
              </tr>
              <tr style="border-top: 2px solid #111827;">
                <td style="padding: 12px 0; color: #111827; font-size: 16px; font-weight: 700;">Grand Total</td>
                <td style="padding: 12px 0; text-align: right; color: #111827; font-size: 18px; font-weight: 700;">৳${order.total}</td>
              </tr>
            </tfoot>
          </table>

          <div style="background: #f1f5f9; border-radius: 10px; padding: 12px; font-size: 13px; color: #475569; margin-top: 16px;">
            🚚 <strong>Delivery Timeline:</strong> Inside Dhaka 1–3 business days · Outside Dhaka 3–5 business days nationwide.
          </div>
        </div>
        <div style="background: #f8fafc; padding: 18px 28px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
          &copy; ${new Date().getFullYear()} HayaNest BD · Dhaka, Bangladesh
        </div>
      </div>
    </body>
    </html>
  `;

  // 1. Resend API
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [to],
          subject: `Order Confirmed: #${order.id} — HayaNest BD`,
          html: htmlContent,
        }),
      });
      if (res.ok) {
        return { ok: true, devMode: false, message: `Order confirmation sent to ${to}.` };
      }
    } catch (err) {
      console.warn("[Resend Order Email Error]", err);
    }
  }

  // 2. SMTP
  const transporter = getTransporter();
  if (transporter && !cfg.usesBrevoLoginFrom) {
    try {
      await transporter.sendMail({
        from: fromAddress,
        replyTo: cfg.fromEmail || undefined,
        to,
        subject: `Order Confirmed: #${order.id} — HayaNest BD`,
        html: htmlContent,
      });
      return { ok: true, devMode: false, message: `Order confirmation sent to ${to}.` };
    } catch (err) {
      console.warn("[SMTP Order Email Error]", err);
    }
  }

  // 3. Fallback dev log
  console.info(
    `[DEV EMAIL NOTIFICATION] Order Confirmed: #${order.id} for ${to} (৳${order.total})`,
  );
  return { ok: true, devMode: true, message: `Order confirmation prepared (Dev mode)` };
}

/**
 * Sends a new order notification email to the store admin.
 */
export async function sendAdminNewOrderNotification({
  order,
  adminEmail,
}: {
  order: Order;
  adminEmail?: string;
}): Promise<{ ok: boolean; devMode: boolean; message: string }> {
  const cfg = await resolveEmailConfig();
  const targetEmail = adminEmail?.trim() || process.env.ADMIN_EMAIL || "admin@hayanestbd.com";
  const fromAddress = cfg.from;

  const htmlContent = `
    <h2>🛒 New Order #${order.id} Received!</h2>
    <p><strong>Customer:</strong> ${order.customer.name} (${order.customer.phone})</p>
    <p><strong>Address:</strong> ${order.customer.address}, ${order.customer.city}</p>
    <p><strong>Total Amount:</strong> ৳${order.total} (${order.paymentMethod.toUpperCase()} · Payment: ${order.paymentStatus || "Pending"})</p>
    ${order.paymentPhone ? `<p><strong>Sender Wallet Number:</strong> ${order.paymentPhone}</p>` : ""}
    ${order.paymentTrxId ? `<p><strong>Transaction ID (TrxID):</strong> ${order.paymentTrxId}</p>` : ""}
    <p><strong>Items:</strong> ${order.items.map((i) => `${i.quantity}x ${i.name} (${i.colour})`).join(", ")}</p>
    <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/admin?section=orders">Go to Admin Dashboard to verify &amp; confirm</a></p>
  `;

  // Resend or SMTP
  if (process.env.RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [targetEmail],
          subject: `🛒 New Order: #${order.id} (৳${order.total}) from ${order.customer.name}`,
          html: htmlContent,
        }),
      });
      return { ok: true, devMode: false, message: "Admin order alert sent" };
    } catch {}
  }

  const transporter = getTransporter();
  if (transporter && !cfg.usesBrevoLoginFrom) {
    try {
      await transporter.sendMail({
        from: fromAddress,
        replyTo: cfg.fromEmail || undefined,
        to: targetEmail,
        subject: `🛒 New Order: #${order.id} (৳${order.total}) from ${order.customer.name}`,
        html: htmlContent,
      });
      return { ok: true, devMode: false, message: "Admin order alert sent" };
    } catch {}
  }

  return { ok: true, devMode: true, message: "Admin alert prepared (Dev mode)" };
}
