import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { hashGuestPassword, isAdmin, randomCode } from "@/lib/security";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await env.DB.prepare(
    `SELECT a.id, a.title, a.event_type, a.event_date, a.description, a.tagline,
      a.location, a.theme, a.expected_guests, a.status, a.access_mode,
      a.allow_guest_uploads, a.moderation_mode, a.downloads_enabled,
      a.event_slug, a.cover_photo_id, a.slideshow_playing, a.slideshow_position,
      a.slideshow_updated_at, a.access_token, a.guest_username, a.created_at,
      COUNT(p.id) AS media_count, COALESCE(SUM(p.size), 0) AS storage_bytes
     FROM albums a LEFT JOIN photos p ON p.album_id = a.id
     GROUP BY a.id ORDER BY a.created_at DESC`,
  ).all();
  const photoResult = await env.DB.prepare(
    `SELECT p.id, p.album_id, p.filename, p.content_type, p.caption, p.is_featured,
      p.collection_id, c.name AS collection_name, p.moderation_status, p.uploader_name,
      p.source, p.size, p.created_at
     FROM photos p LEFT JOIN event_collections c ON c.id = p.collection_id
     ORDER BY p.created_at DESC`,
  ).all();
  const collections = await env.DB.prepare(
    "SELECT id, album_id, name, description, created_at FROM event_collections ORDER BY created_at ASC",
  ).all();
  return NextResponse.json({ albums: result.results, photos: photoResult.results, collections: collections.results });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as {
    title?: string; eventType?: string; eventDate?: string; expectedGuests?: number;
    location?: string; tagline?: string;
  };
  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: "Gallery name is required" }, { status: 400 });

  const id = crypto.randomUUID();
  const accessToken = randomCode(14).toLowerCase();
  const guestUsername = `guest-${randomCode(5).toLowerCase()}`;
  const guestPassword = randomCode(8);
  const passwordHash = await hashGuestPassword(id, guestPassword);
  const createdAt = Date.now();
  const eventType = body.eventType?.trim() || "Celebration";
  const eventDate = body.eventDate?.trim() || "";
  const location = body.location?.trim().slice(0, 160) || "";
  const tagline = body.tagline?.trim().slice(0, 160) || "";
  const expectedGuests = Math.max(0, Math.min(100000, Number(body.expectedGuests) || 0));
  const baseSlug = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 44) || "event";
  const eventSlug = `${baseSlug}-${randomCode(4).toLowerCase()}`;
  const collectionId = crypto.randomUUID();

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO albums (id, title, event_type, event_date, description, tagline, location,
        theme, expected_guests, status, access_mode, allow_guest_uploads, moderation_mode,
        downloads_enabled, event_slug, access_token, guest_username, guest_password_hash, created_at)
       VALUES (?, ?, ?, ?, '', ?, ?, 'rose', ?, 'draft', 'password', 0, 'manual', 1, ?, ?, ?, ?, ?)`,
    ).bind(id, title, eventType, eventDate, tagline, location, expectedGuests, eventSlug, accessToken, guestUsername, passwordHash, createdAt),
    env.DB.prepare(
      "INSERT INTO event_collections (id, album_id, name, description, created_at) VALUES (?, ?, 'Main moments', '', ?)",
    ).bind(collectionId, id, createdAt),
  ]);

  return NextResponse.json({
    album: {
      id, title, event_type: eventType, event_date: eventDate, description: "", tagline,
      location, theme: "rose", expected_guests: expectedGuests, status: "draft",
      access_mode: "password", allow_guest_uploads: 0, moderation_mode: "manual",
      downloads_enabled: 1, event_slug: eventSlug, cover_photo_id: null,
      slideshow_playing: 1, slideshow_position: 0, slideshow_updated_at: 0,
      access_token: accessToken, guest_username: guestUsername, guest_password: guestPassword,
      created_at: createdAt, media_count: 0, storage_bytes: 0,
    },
    collection: { id: collectionId, album_id: id, name: "Main moments", description: "", created_at: createdAt },
  });
}
