import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { recordEventMetric } from "@/lib/analytics";
import { getAlbumByToken } from "@/lib/data";
import { canViewGallery } from "@/lib/security";
import { isRateLimited } from "@/lib/rate-limit";
import { isAllowedMedia } from "@/lib/uploads";

const MAX_FILE_SIZE = 75 * 1024 * 1024;

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (isRateLimited(request, `guest-upload:${token}`, 8, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many uploads. Please try again in a few minutes." }, { status: 429 });
  }
  const album = await getAlbumByToken(token);
  if (!album || !(await canViewGallery(album))) {
    return NextResponse.json({ error: "Open this event before uploading" }, { status: 401 });
  }
  if (!album.allow_guest_uploads || album.status !== "live") {
    return NextResponse.json({ error: "Guest uploads are not enabled for this event" }, { status: 403 });
  }

  const form = await request.formData();
  const files = form.getAll("photos").filter((item): item is File => item instanceof File);
  if (!files.length) return NextResponse.json({ error: "Choose at least one photo or video" }, { status: 400 });
  if (files.length > 20) return NextResponse.json({ error: "Upload up to 20 items at a time" }, { status: 400 });
  if (files.reduce((sum, file) => sum + file.size, 0) > 100 * 1024 * 1024) {
    return NextResponse.json({ error: "This upload is over 100 MB. Send it in smaller batches." }, { status: 400 });
  }
  const uploaderName = String(form.get("uploaderName") ?? "Guest").trim().slice(0, 80) || "Guest";
  const caption = String(form.get("caption") ?? "").trim().slice(0, 240);
  const collectionId = String(form.get("collectionId") ?? "") || null;
  if (collectionId) {
    const collection = await env.DB.prepare("SELECT id FROM event_collections WHERE id = ? AND album_id = ? LIMIT 1")
      .bind(collectionId, album.id).first();
    if (!collection) return NextResponse.json({ error: "That album is not part of this event" }, { status: 400 });
  }

  const moderationStatus = album.moderation_mode === "instant" ? "approved" : "pending";
  const created: Array<{ id: string; filename: string; moderationStatus: string }> = [];
  for (const file of files) {
    if (!isAllowedMedia(file) || file.size > MAX_FILE_SIZE) continue;
    const photoId = crypto.randomUUID();
    const objectKey = `albums/${album.id}/guest/${photoId}`;
    await env.BUCKET.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type } });
    await env.DB.prepare(
      `INSERT INTO photos (id, album_id, object_key, filename, content_type, caption,
        is_featured, collection_id, moderation_status, uploader_name, source, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'guest', ?, ?)`,
    ).bind(photoId, album.id, objectKey, file.name, file.type, caption, collectionId,
      moderationStatus, uploaderName, file.size, Date.now()).run();
    created.push({ id: photoId, filename: file.name, moderationStatus });
  }
  if (!created.length) return NextResponse.json({ error: "Files must be photos or videos under 75 MB" }, { status: 400 });
  await recordEventMetric(album.id, "guest_uploads", created.length);
  return NextResponse.json({ photos: created, moderationStatus });
}
