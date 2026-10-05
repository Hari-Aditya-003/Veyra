import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getAlbumById } from "@/lib/data";
import { isAdmin } from "@/lib/security";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: albumId } = await context.params;
  if (!(await getAlbumById(albumId))) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const body = (await request.json()) as { name?: string; description?: string };
  const name = body.name?.trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "Album name is required" }, { status: 400 });
  const description = body.description?.trim().slice(0, 200) || "";
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  await env.DB.prepare(
    "INSERT INTO event_collections (id, album_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(id, albumId, name, description, createdAt).run();
  return NextResponse.json({ collection: { id, album_id: albumId, name, description, created_at: createdAt } });
}
