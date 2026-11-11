"use client";

import { useEffect, useRef, useState, type ButtonHTMLAttributes } from "react";
import { Check, X } from "lucide-react";

const eventName = "noor:coming-soon";
const noticeEvent = "noor:notice";
type Notice = { title: string; description: string };

export function announceNotice(title: string, description: string) {
  window.dispatchEvent(new CustomEvent<Notice>(noticeEvent, { detail: { title, description } }));
}

export function announceComingSoon(feature: string) {
  window.dispatchEvent(new CustomEvent<string>(eventName, { detail: feature }));
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { feature: string };

export function ComingSoonButton({ feature, children, ...props }: Props) {
  return (
    <button type="button" title={`${feature} — Coming soon`} {...props} onClick={() => announceComingSoon(feature)}>
      {children}
    </button>
  );
}

export function ComingSoonNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const dismiss = () => setNotice(null);
    const show = (notice: Notice) => {
      if (timeout.current) clearTimeout(timeout.current);
      setNotice(notice);
      timeout.current = setTimeout(dismiss, 6500);
    };
    const receive = (event: Event) => show({ title: "Coming soon", description: `${(event as CustomEvent<string>).detail} will be available in a future update.` });
    const receiveNotice = (event: Event) => show((event as CustomEvent<Notice>).detail);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener(eventName, receive);
    window.addEventListener(noticeEvent, receiveNotice);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(eventName, receive);
      window.removeEventListener(noticeEvent, receiveNotice);
      window.removeEventListener("keydown", onKeyDown);
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  return (
    <div className={`coming-soon-notice ${notice ? "is-visible" : ""}`}>
      <div role="status" aria-live="polite" aria-atomic="true" className="notice-content">
        {notice && <><span className="notice-mark"><Check size={18} /></span><span><strong>{notice.title}</strong><span>{notice.description}</span></span></>}
      </div>
      {notice && <button type="button" className="icon-button notice-close" onClick={() => setNotice(null)} aria-label="Dismiss notification"><X size={18} /></button>}
    </div>
  );
}
