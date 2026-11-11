"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Send } from "lucide-react";

export function ContactForm() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [topic, setTopic] = useState("Order Inquiry");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !contact.trim() || !message.trim()) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          contact: contact.trim(),
          topic,
          message: message.trim(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || "Could not send message. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setErrorMsg("Network error while sending message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div
        style={{
          background: "var(--surface-strong)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: 28,
          textAlign: "center",
        }}
      >
        <CheckCircle2
          size={36}
          style={{ color: "var(--accent)", margin: "0 auto 12px", display: "block" }}
        />
        <h3
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 22,
            margin: "0 0 8px",
          }}
        >
          Thank You, {name}!
        </h3>
        <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>
          We have received your message regarding <strong>{topic}</strong>. Our Dhaka customer care
          team will reach out to you at <strong>{contact}</strong> within 24 hours.
        </p>
        <button
          type="button"
          onClick={() => {
            setName("");
            setContact("");
            setMessage("");
            setSubmitted(false);
          }}
          style={{
            padding: "10px 18px",
            borderRadius: 999,
            border: "1px solid var(--line)",
            background: "var(--surface)",
            color: "var(--ink)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Send Another Message
        </button>
      </div>
    );
  }

  const inputStyle = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 12,
    border: "1px solid var(--line)",
    background: "var(--surface-strong)",
    color: "var(--ink)",
    fontSize: 14,
  } as const;

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
        }}
      >
        <div>
          <label
            htmlFor="cnt-name"
            style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}
          >
            Your Name *
          </label>
          <input
            id="cnt-name"
            type="text"
            required
            placeholder="e.g. Ayesha Rahman"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label
            htmlFor="cnt-contact"
            style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}
          >
            Phone or Email *
          </label>
          <input
            id="cnt-contact"
            type="text"
            required
            placeholder="e.g. 017XXXXXXXX or email"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="cnt-topic"
          style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}
        >
          Subject / Topic
        </label>
        <select
          id="cnt-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          style={inputStyle}
        >
          <option value="Order Inquiry">Order Status &amp; Delivery Inquiry</option>
          <option value="Exchange / Return">Return or Shade Exchange Request</option>
          <option value="Fabric & Sizing Advice">Fabric &amp; Styling Recommendation</option>
          <option value="Bulk / Gift Orders">Bridal / Gift Box &amp; Bulk Orders</option>
          <option value="General Feedback">General Question or Feedback</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="cnt-msg"
          style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}
        >
          Message *
        </label>
        <textarea
          id="cnt-msg"
          rows={4}
          required
          placeholder="Include your Order ID (if applicable) and how we can help..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      {errorMsg ? (
        <p
          style={{
            margin: 0,
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(239, 68, 68, 0.1)",
            color: "#dc2626",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {errorMsg}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={submitting}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 22px",
            borderRadius: 999,
            border: "none",
            background: "var(--ink)",
            color: "var(--bg)",
            fontSize: 13,
            fontWeight: 600,
            cursor: submitting ? "wait" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          <Send size={14} /> {submitting ? "Sending…" : "Send Message"}
        </button>
      </div>
    </form>
  );
}
