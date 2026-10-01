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
  const body = (await request.json()) as { description?: string; theme?: string; expectedGuests?: number };
  const description = String(body.description ?? album.description).trim().slice(0, 500);
  const theme = themes.has(String(body.theme)) ? String(body.theme) : album.theme;
  const expectedGuests = Math.max(0, Math.min(100000, Number(body.expectedGuests ?? album.expected_guests) || 0));
  await env.DB.prepare("UPDATE albums SET description = ?, theme = ?, expected_guests = ? WHERE id = ?")
    .bind(description, theme, expectedGuests, id).run();
  return NextResponse.json({ ok: true, description, theme, expected_guests: expectedGuests });
}
