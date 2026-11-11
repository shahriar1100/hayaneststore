import type { Metadata, Viewport } from "next";
import { ComingSoonNotice } from "@/components/ui/coming-soon";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { StorefrontMotion } from "@/components/ui/motion-reveal";
import { FacebookPixelTracker } from "@/components/analytics/facebook-pixel";
import { getStoreSettings } from "@/lib/server/store-repository";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "HayaNest BD | Everything She Loves",
  description: "Discover elegant modest wear, hijabs, and curated fashion essentials at HayaNest BD. Thoughtfully crafted for everyday grace and modest beauty.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getStoreSettings().catch(() => null);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
          suppressHydrationWarning
        />
      </head>
      <body suppressHydrationWarning>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
        <StorefrontMotion />
        <CartDrawer />
        <ComingSoonNotice />
        <FacebookPixelTracker pixelConfig={settings?.facebookPixel} />
      </body>
    </html>
  );
}
