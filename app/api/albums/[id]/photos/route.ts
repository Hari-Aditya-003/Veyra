import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getAlbumById } from "@/lib/data";
import { deleteDriveFile, ensureEventDriveFolders, GoogleDriveError, uploadDriveMedia } from "@/lib/google-drive";
import { isAdmin } from "@/lib/security";
import { isAllowedMedia } from "@/lib/uploads";

const MAX_FILE_SIZE = 75 * 1024 * 1024;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: albumId } = await context.params;
  const album = await getAlbumById(albumId);
  if (!album) return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
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
  try {
    const folders = await ensureEventDriveFolders(album);
    for (const file of files) {
      const supported = isAllowedMedia(file);
      if (!supported || file.size > MAX_FILE_SIZE) continue;
      const photoId = crypto.randomUUID();
      const folderId = file.type.startsWith("video/") ? folders.videosFolderId : folders.photosFolderId;
      const uploaded = await uploadDriveMedia(file, folderId, { albumId, photoId, source: "host" });
      try {
        await env.DB.prepare(
          `INSERT INTO photos (id, album_id, object_key, filename, content_type, caption,
            is_featured, collection_id, moderation_status, uploader_name, source, size, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'approved', 'Host', 'host', ?, ?)`,
        ).bind(photoId, albumId, uploaded.id, file.name, file.type, caption, collectionId, file.size, Date.now()).run();
      } catch {
        await deleteDriveFile(uploaded.id).catch(() => undefined);
        throw new GoogleDriveError("The upload reached Google Drive but could not be added to the event.", 500);
      }
      created.push({ id: photoId, filename: file.name, size: file.size });
    }
  } catch (error) {
    const message = error instanceof GoogleDriveError ? error.message : "Google Drive upload failed.";
    return NextResponse.json({ error: message }, { status: error instanceof GoogleDriveError ? error.status : 502 });
  }
  if (!created.length) return NextResponse.json({ error: "Files must be photos or videos under 75 MB" }, { status: 400 });
  return NextResponse.json({ photos: created });
}
