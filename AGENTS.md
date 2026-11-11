# Project preferences

- Do not generate new pictures or use image-generation tools unless the user explicitly requests image generation. Use the user's supplied images and existing local assets.
- Images will eventually come from dynamic data. Keep image paths and alt text in the typed data layer so they can be replaced without changing the layout. Do not add a backend just to prepare for this.
- Preserve existing work and keep changes within the requested scope. Static homepage content should remain Server Components; use Client Components only for interactions.
- Use npm. On this Windows machine, use `npm.cmd` when PowerShell blocks `npm.ps1`.
- Production Reminder: Before going live, configure Email/SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` or `RESEND_API_KEY`) in `.env.local` for customer password reset emails.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
