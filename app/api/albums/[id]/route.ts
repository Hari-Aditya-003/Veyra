import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getAlbumById } from "@/lib/data";
import { isAdmin } from "@/lib/security";

const themes = new Set(["rose", "sunset", "violet", "ocean", "marigold"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const album = await getAlbumById(id);
  if (!album) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const body = (await request.json()) as {
    description?: string; tagline?: string; location?: string; theme?: string;
    expectedGuests?: number; status?: string; accessMode?: string;
    allowGuestUploads?: boolean; moderationMode?: string; downloadsEnabled?: boolean;
    coverPhotoId?: string | null;
  };
  const description = String(body.description ?? album.description).trim().slice(0, 500);
  const tagline = String(body.tagline ?? album.tagline).trim().slice(0, 160);
  const location = String(body.location ?? album.location).trim().slice(0, 160);
  const theme = themes.has(String(body.theme)) ? String(body.theme) : album.theme;
  const expectedGuests = Math.max(0, Math.min(100000, Number(body.expectedGuests ?? album.expected_guests) || 0));
  const status = ["draft", "live", "paused", "completed"].includes(String(body.status)) ? String(body.status) : album.status;
  const accessMode = ["password", "link"].includes(String(body.accessMode)) ? String(body.accessMode) : album.access_mode;
  const moderationMode = ["manual", "instant"].includes(String(body.moderationMode)) ? String(body.moderationMode) : album.moderation_mode;
  const allowGuestUploads = typeof body.allowGuestUploads === "boolean" ? Number(body.allowGuestUploads) : Number(album.allow_guest_uploads);
  const downloadsEnabled = typeof body.downloadsEnabled === "boolean" ? Number(body.downloadsEnabled) : Number(album.downloads_enabled);
  let coverPhotoId = album.cover_photo_id;
  if (Object.prototype.hasOwnProperty.call(body, "coverPhotoId")) {
    if (body.coverPhotoId) {
      const cover = await env.DB.prepare("SELECT id FROM photos WHERE id = ? AND album_id = ? AND content_type LIKE 'image/%' LIMIT 1")
        .bind(body.coverPhotoId, id).first();
      if (!cover) return NextResponse.json({ error: "Choose a photo from this event as the cover" }, { status: 400 });
      coverPhotoId = body.coverPhotoId;
    } else {
      coverPhotoId = null;
    }
  }
  await env.DB.prepare(
    `UPDATE albums SET description = ?, tagline = ?, location = ?, theme = ?, expected_guests = ?,
      status = ?, access_mode = ?, allow_guest_uploads = ?, moderation_mode = ?,
      downloads_enabled = ?, cover_photo_id = ? WHERE id = ?`,
  ).bind(description, tagline, location, theme, expectedGuests, status, accessMode,
    allowGuestUploads, moderationMode, downloadsEnabled, coverPhotoId, id).run();
  return NextResponse.json({
    ok: true, description, tagline, location, theme, expected_guests: expectedGuests,
    status, access_mode: accessMode, allow_guest_uploads: allowGuestUploads,
    moderation_mode: moderationMode, downloads_enabled: downloadsEnabled,
    cover_photo_id: coverPhotoId,
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const album = await getAlbumById(id);
  if (!album) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const media = await env.DB.prepare("SELECT object_key FROM photos WHERE album_id = ?").bind(id).all<{ object_key: string }>();
  const objectKeys = media.results.map((item) => item.object_key);
  for (let offset = 0; offset < objectKeys.length; offset += 1000) {
    await env.BUCKET.delete(objectKeys.slice(offset, offset + 1000));
  }

  await env.DB.batch([
    env.DB.prepare("UPDATE albums SET cover_photo_id = NULL WHERE id = ?").bind(id),
    env.DB.prepare("DELETE FROM photos WHERE album_id = ?").bind(id),
    env.DB.prepare("DELETE FROM event_collections WHERE album_id = ?").bind(id),
    env.DB.prepare("DELETE FROM albums WHERE id = ?").bind(id),
  ]);

  return NextResponse.json({ ok: true, deletedMedia: objectKeys.length });
}
