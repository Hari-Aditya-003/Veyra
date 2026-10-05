import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getAlbumById } from "@/lib/data";
import { isAdmin } from "@/lib/security";

type ControlAction = "play" | "pause" | "next" | "previous" | "restart";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const album = await getAlbumById(id);
  if (!album) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const body = (await request.json()) as { action?: ControlAction };
  const action = body.action;
  if (!action || !["play", "pause", "next", "previous", "restart"].includes(action)) {
    return NextResponse.json({ error: "Choose a valid slideshow action" }, { status: 400 });
  }

  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM photos WHERE album_id = ? AND moderation_status = 'approved'",
  ).bind(id).first<{ count: number }>();
  const count = Number(countRow?.count ?? 0);
  let playing = Boolean(album.slideshow_playing);
  let position = Math.max(0, album.slideshow_position);

  if (action === "play") playing = true;
  if (action === "pause") playing = false;
  if (action === "restart") {
    position = 0;
    playing = true;
  }
  if (action === "next" && count > 0) position = (position + 1) % count;
  if (action === "previous" && count > 0) position = (position - 1 + count) % count;

  const updatedAt = Date.now();
  await env.DB.prepare(
    "UPDATE albums SET slideshow_playing = ?, slideshow_position = ?, slideshow_updated_at = ? WHERE id = ?",
  ).bind(Number(playing), position, updatedAt, id).run();

  return NextResponse.json({ playing, position, updatedAt });
}
