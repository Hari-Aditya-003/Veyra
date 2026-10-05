import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getAlbumById } from "@/lib/data";
import { isAdmin } from "@/lib/security";
import { isAllowedMedia } from "@/lib/uploads";

const MAX_FILE_SIZE = 75 * 1024 * 1024;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: albumId } = await context.params;
  if (!(await getAlbumById(albumId))) return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  const form = await request.formData();
  const files = form.getAll("photos").filter((item): item is File => item instanceof File);
  if (!files.length) return NextResponse.json({ error: "Choose at least one photo" }, { status: 400 });
  const collectionId = String(form.get("collectionId") ?? "") || null;
  const caption = String(form.get("caption") ?? "").trim().slice(0, 240);
  if (collectionId) {
    const collection = await env.DB.prepare("SELECT id FROM event_collections WHERE id = ? AND album_id = ? LIMIT 1")
      .bind(collectionId, albumId).first();
    if (!collection) return NextResponse.json({ error: "Album not found for this event" }, { status: 400 });
  }

  const created: Array<Record<string, unknown>> = [];
  for (const file of files) {
    const supported = isAllowedMedia(file);
    if (!supported || file.size > MAX_FILE_SIZE) continue;
    const photoId = crypto.randomUUID();
    const objectKey = `albums/${albumId}/${photoId}`;
    await env.BUCKET.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type } });
    await env.DB.prepare(
      `INSERT INTO photos (id, album_id, object_key, filename, content_type, caption,
        is_featured, collection_id, moderation_status, uploader_name, source, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'approved', 'Host', 'host', ?, ?)`,
    ).bind(photoId, albumId, objectKey, file.name, file.type, caption, collectionId, file.size, Date.now()).run();
    created.push({ id: photoId, filename: file.name, size: file.size });
  }
  return NextResponse.json({ photos: created });
}
