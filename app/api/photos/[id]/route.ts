import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getPhoto } from "@/lib/data";
import { isAdmin } from "@/lib/security";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  const photo = await getPhoto(id);
  if (!photo) return new Response("Not found", { status: 404 });
  const object = await env.BUCKET.get(photo.object_key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": photo.content_type, "Cache-Control": "private, max-age=300" } });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const photo = await getPhoto(id);
  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  await env.BUCKET.delete(photo.object_key);
  await env.DB.prepare("DELETE FROM photos WHERE id = ?").bind(id).run();
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const photo = await getPhoto(id);
  if (!photo) return NextResponse.json({ error: "Media not found" }, { status: 404 });
  const body = (await request.json()) as { caption?: string; isFeatured?: boolean };
  const caption = String(body.caption ?? photo.caption).trim().slice(0, 240);
  const isFeatured = typeof body.isFeatured === "boolean" ? Number(body.isFeatured) : Number(photo.is_featured);
  await env.DB.prepare("UPDATE photos SET caption = ?, is_featured = ? WHERE id = ?")
    .bind(caption, isFeatured, id).run();
  return NextResponse.json({ ok: true, caption, is_featured: isFeatured });
}
