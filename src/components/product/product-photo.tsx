"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";
import type { Photo } from "@/types/store";

function isRenderableImageSrc(src: string): boolean {
  if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) {
    return true;
  }
  if (src.startsWith("http://") || src.startsWith("https://")) {
    try {
      new URL(src);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function shouldUseUnoptimizedImage(src: string): boolean {
  if (src.startsWith("data:") || src.startsWith("blob:")) return true;
  if (!src.startsWith("http://") && !src.startsWith("https://")) return false;
  try {
    const { hostname } = new URL(src);
    return hostname !== "res.cloudinary.com" && !hostname.endsWith(".supabase.co");
  } catch {
    return true;
  }
}

export function ProductPhoto({ photo, sizes, loading }: { photo: Photo; sizes: string; loading?: "eager" | "lazy" }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const src = photo.src?.trim() || "";

  if (!src || !isRenderableImageSrc(src) || failedSource === src) {
    return <span className="product-photo-placeholder" role="img" aria-label={`${photo.alt} — image unavailable`}><ImageOff aria-hidden="true" size={26} /><span>Image coming soon</span></span>;
  }
  return (
    <Image
      src={src}
      alt={photo.alt}
      fill
      sizes={sizes}
      loading={loading}
      unoptimized={shouldUseUnoptimizedImage(src)}
      style={{ objectPosition: photo.position }}
      onError={() => setFailedSource(src)}
    />
  );
}
