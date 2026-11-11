import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  devIndicators: false,
  experimental: {
    agentUpgrade: "security",
  } as unknown as NextConfig["experimental"],
};

export default nextConfig;

