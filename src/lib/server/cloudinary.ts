import { createHash } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getBackendConfig } from "./env";

export type UploadImageResult = {
  url: string;
  mode: "cloudinary" | "local";
  resourceType?: "image" | "video";
  width?: number;
  height?: number;
};

function isVideoFile(file: File): boolean {
  return (
    file.type.startsWith("video/") ||
    /\.(mp4|webm|mov|ogg|m4v)$/i.test(file.name || "")
  );
}

function optimizeCloudinaryUrl(url: string): string {
  // Automatically inject f_auto,q_auto into Cloudinary URLs so high-traffic visitors
  // always receive compressed WebP/AVIF from the nearest global CDN edge node.
  if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) {
    return url;
  }
  if (url.includes("/image/upload/f_auto")) {
    return url;
  }
  return url.replace("/image/upload/", "/image/upload/f_auto,q_auto/");
}

export function optimizeCloudinaryVideoUrl(url: string): string {
  // Automatically inject f_auto,q_auto:eco,vc_auto,w_720,c_limit into Cloudinary video URLs
  // so uploaded story videos are compressed by 70-85% and capped at 720p vertical HD.
  if (!url.includes("res.cloudinary.com") || !url.includes("/video/upload/")) {
    return url;
  }
  if (url.includes("/video/upload/f_auto")) {
    return url;
  }
  return url.replace(
    "/video/upload/",
    "/video/upload/f_auto,q_auto:eco,vc_auto,w_720,c_limit/",
  );
}

export function extractCloudinaryAssetInfo(
  rawUrl?: string | null,
): { publicId: string; resourceType: "image" | "video" } | null {
  const url = rawUrl?.trim();
  if (!url || !url.includes("res.cloudinary.com")) {
    return null;
  }
  const match = url.match(/\/(image|video)\/upload\/(.+)$/);
  if (!match) {
    return null;
  }
  const resourceType = match[1] as "image" | "video";
  const afterUpload = match[2].split("?")[0];
  const segments = afterUpload.split("/").filter(Boolean);

  // Locate version segment (e.g. v1728561234) if present; otherwise skip transformation segments
  const versionIdx = segments.findIndex((seg) => /^v\d+$/.test(seg));
  const pathSegments =
    versionIdx >= 0
      ? segments.slice(versionIdx + 1)
      : segments.filter(
          (seg) =>
            !seg.includes(",") &&
            !/^(f_|q_|w_|h_|c_|vc_|ac_|br_|dpr_)/.test(seg),
        );

  if (pathSegments.length === 0) {
    return null;
  }

  const joined = pathSegments.join("/");
  const publicId = decodeURIComponent(joined.replace(/\.[^/.]+$/, ""));
  if (!publicId) {
    return null;
  }
  return { publicId, resourceType };
}

export function getCanonicalMediaKey(rawUrl?: string | null): string {
  const url = rawUrl?.trim();
  if (!url) return "";
  const cloudinaryInfo = extractCloudinaryAssetInfo(url);
  if (cloudinaryInfo) {
    return `cloudinary:${cloudinaryInfo.resourceType}:${cloudinaryInfo.publicId}`;
  }
  if (url.startsWith("/uploads/")) {
    return `local:${path.basename(url.split("?")[0])}`;
  }
  return url.split("?")[0];
}

export function isManagedUploadedMedia(rawUrl?: string | null): boolean {
  const url = rawUrl?.trim();
  if (!url) return false;
  if (url.startsWith("/uploads/")) return true;
  return Boolean(extractCloudinaryAssetInfo(url));
}

export async function deleteUploadedMedia(rawUrl?: string | null): Promise<boolean> {
  const url = rawUrl?.trim();
  if (!url || !isManagedUploadedMedia(url)) {
    return false;
  }

  // 1. Local /uploads/ file cleanup
  if (url.startsWith("/uploads/")) {
    const fileName = path.basename(url.split("?")[0]);
    if (!fileName || fileName === "." || fileName === "..") {
      return false;
    }
    const filePath = path.join(process.cwd(), "public", "uploads", fileName);
    try {
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // 2. Cloudinary CDN asset cleanup (Image or Video)
  const assetInfo = extractCloudinaryAssetInfo(url);
  const config = getBackendConfig();
  if (!assetInfo || !config.cloudinaryConfigured) {
    return false;
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    // Parameters must be signed in alphabetical order: invalidate, public_id, timestamp
    const paramsToSign = `invalidate=true&public_id=${assetInfo.publicId}&timestamp=${timestamp}${config.cloudinaryApiSecret}`;
    const signature = createHash("sha1").update(paramsToSign).digest("hex");

    const formData = new FormData();
    formData.append("public_id", assetInfo.publicId);
    formData.append("invalidate", "true");
    formData.append("api_key", config.cloudinaryApiKey);
    formData.append("timestamp", timestamp);
    formData.append("signature", signature);

    const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudinaryCloudName}/${assetInfo.resourceType}/destroy`;
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function uploadProductImage(file: File): Promise<UploadImageResult> {
  const config = getBackendConfig();
  const isVideo = isVideoFile(file);
  const resourceType: "image" | "video" = isVideo ? "video" : "image";

  if (config.cloudinaryConfigured) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = isVideo ? "hayanest-bd/stories" : "hayanest-bd/products";
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${config.cloudinaryApiSecret}`;
    const signature = createHash("sha1").update(paramsToSign).digest("hex");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", config.cloudinaryApiKey);
    formData.append("timestamp", timestamp);
    formData.append("folder", folder);
    formData.append("signature", signature);

    const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudinaryCloudName}/${resourceType}/upload`;
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudinary upload failed: ${errorText}`);
    }

    const payload = (await response.json()) as {
      secure_url: string;
      width?: number;
      height?: number;
    };

    return {
      url: isVideo
        ? optimizeCloudinaryVideoUrl(payload.secure_url)
        : optimizeCloudinaryUrl(payload.secure_url),
      mode: "cloudinary",
      resourceType,
      width: payload.width,
      height: payload.height,
    };
  }

  // Fallback for local testing before Cloudinary keys are added to .env.local
  const bytes = Buffer.from(await file.arrayBuffer());
  const defaultExt = isVideo ? ".mp4" : ".jpg";
  const ext = path.extname(file.name || defaultExt).toLowerCase() || defaultExt;
  const safeBase =
    path
      .basename(file.name || (isVideo ? "story-video" : "product"), ext)
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 40) || (isVideo ? "story-video" : "product");
  const fileName = `${safeBase}-${Date.now()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  try {
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), bytes);

    return {
      url: `/uploads/${fileName}`,
      mode: "local",
      resourceType,
    };
  } catch {
    if (!isVideo) {
      const mimeType = file.type || "image/jpeg";
      return {
        url: `data:${mimeType};base64,${bytes.toString("base64")}`,
        mode: "local",
        resourceType: "image",
      };
    }
    throw new Error(
      "Video upload requires Cloudinary environment variables (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) on serverless hosting.",
    );
  }
}

