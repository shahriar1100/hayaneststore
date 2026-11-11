export function SocialIcon({ name }: { name: "Facebook" | "Instagram" | "YouTube" | "TikTok" }) {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
      {name === "Facebook" && <path d="M14.3 22v-9h3l.5-3.5h-3.5V7.3c0-1 .3-1.8 1.8-1.8H18V2.4c-.8-.1-1.8-.2-2.8-.2-2.8 0-4.5 1.7-4.5 4.7v2.6H8V13h2.7v9h3.6Z" fill="currentColor" />}
      {name === "Instagram" && <><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="12" r="4.3" stroke="currentColor" strokeWidth="1.7" /><circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" /></>}
      {name === "YouTube" && <><rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" /><path d="m10 9 6 3-6 3V9Z" fill="var(--page)" /></>}
      {name === "TikTok" && <path d="M14 3h3c.5 2.7 2 4.1 4 4.5v3.2a9 9 0 0 1-4-1.6v7.3A5.6 5.6 0 1 1 11 11v3.2a2.5 2.5 0 1 0 3 2.5V3Z" fill="currentColor" />}
    </svg>
  );
}
