import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { hashGuestPassword, isAdmin, randomCode } from "@/lib/security";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await env.DB.prepare(
    `SELECT a.id, a.title, a.event_type, a.event_date, a.description, a.theme,
      a.expected_guests, a.access_token, a.guest_username, a.created_at,
      COUNT(p.id) AS media_count, COALESCE(SUM(p.size), 0) AS storage_bytes
     FROM albums a LEFT JOIN photos p ON p.album_id = a.id
     GROUP BY a.id ORDER BY a.created_at DESC`,
  ).all();
  const photoResult = await env.DB.prepare(
    "SELECT id, album_id, filename, content_type, caption, is_featured, size, created_at FROM photos ORDER BY created_at DESC",
  ).all();
  return NextResponse.json({ albums: result.results, photos: photoResult.results });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as { title?: string; eventType?: string; eventDate?: string; expectedGuests?: number };
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
  const expectedGuests = Math.max(0, Math.min(100000, Number(body.expectedGuests) || 0));

  await env.DB.prepare(
    "INSERT INTO albums (id, title, event_type, event_date, description, theme, expected_guests, access_token, guest_username, guest_password_hash, created_at) VALUES (?, ?, ?, ?, '', 'rose', ?, ?, ?, ?, ?)",
  ).bind(id, title, eventType, eventDate, expectedGuests, accessToken, guestUsername, passwordHash, createdAt).run();

  return NextResponse.json({
    album: { id, title, event_type: eventType, event_date: eventDate, description: "", theme: "rose", expected_guests: expectedGuests, access_token: accessToken, guest_username: guestUsername, guest_password: guestPassword, created_at: createdAt, media_count: 0, storage_bytes: 0 },
  });
}
