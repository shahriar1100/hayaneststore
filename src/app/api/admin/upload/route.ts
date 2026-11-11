import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server/admin-auth";
import { uploadProductImage } from "@/lib/server/cloudinary";
import { cleanupUnusedMediaUrls } from "@/lib/server/store-repository";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized admin session." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("file").filter((f): f is File => f instanceof File);
    const altFiles = formData.getAll("files").filter((f): f is File => f instanceof File);
    const allFiles = files.length > 0 ? files : altFiles;
    const replaceUrl = formData.get("replaceUrl");

    if (allFiles.length === 0) {
      return NextResponse.json({ error: "Please select a media file to upload." }, { status: 400 });
    }

    for (const file of allFiles) {
      const isVideo =
        file.type.startsWith("video/") ||
        /\.(mp4|webm|mov|ogg|m4v)$/i.test(file.name || "");
      const maxBytes = isVideo ? 60 * 1024 * 1024 : 10 * 1024 * 1024;

      if (file.size > maxBytes) {
        return NextResponse.json(
          {
            error: isVideo
              ? `Video "${file.name}" size must be under 60 MB.`
              : `Image "${file.name}" size must be under 10 MB.`,
          },
          { status: 400 },
        );
      }
    }

    const results = await Promise.all(allFiles.map((file) => uploadProductImage(file)));

    // If replacing an unsaved draft upload in the form, automatically clean it up if not referenced in the store
    if (
      typeof replaceUrl === "string" &&
      replaceUrl.trim() &&
      !results.some((r) => r.url === replaceUrl.trim())
    ) {
      await cleanupUnusedMediaUrls([replaceUrl.trim()]);
    }

    const first = results[0];
    const urls = results.map((r) => r.url);
    const photos = results.map((r, i) => ({
      src: r.url,
      alt: allFiles[i].name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
    }));

    return NextResponse.json({
      ...first,
      urls,
      photos,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Media upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized admin session." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { url?: string; urls?: string[] };
    const candidates = [
      ...(typeof body.url === "string" ? [body.url] : []),
      ...(Array.isArray(body.urls) ? body.urls : []),
    ];
    const deletedCount = await cleanupUnusedMediaUrls(candidates);
    return NextResponse.json({ ok: true, deletedCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Media cleanup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

