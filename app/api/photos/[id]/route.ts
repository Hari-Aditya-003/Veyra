import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getPhoto } from "@/lib/data";
import { deleteDriveFile, driveMediaResponse, GoogleDriveError } from "@/lib/google-drive";
import { isAdmin } from "@/lib/security";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  const photo = await getPhoto(id);
  if (!photo) return new Response("Not found", { status: 404 });
  try {
    return await driveMediaResponse(photo.object_key, request, {
      contentType: photo.content_type,
      filename: photo.filename,
      cacheControl: "private, max-age=3600",
    });
  } catch (error) {
    return new Response(error instanceof GoogleDriveError ? error.message : "Google Drive is unavailable", {
      status: error instanceof GoogleDriveError ? error.status : 502,
    });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const photo = await getPhoto(id);
  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  try {
    await deleteDriveFile(photo.object_key);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof GoogleDriveError ? error.message : "Could not delete this item from Google Drive." },
      { status: error instanceof GoogleDriveError ? error.status : 502 },
    );
  }
  await env.DB.batch([
    env.DB.prepare("UPDATE albums SET cover_photo_id = NULL WHERE cover_photo_id = ?").bind(id),
    env.DB.prepare("DELETE FROM photos WHERE id = ?").bind(id),
  ]);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const photo = await getPhoto(id);
  if (!photo) return NextResponse.json({ error: "Media not found" }, { status: 404 });
  const body = (await request.json()) as { caption?: string; isFeatured?: boolean; moderationStatus?: string };
  const caption = String(body.caption ?? photo.caption).trim().slice(0, 240);
  const isFeatured = typeof body.isFeatured === "boolean" ? Number(body.isFeatured) : Number(photo.is_featured);
  const moderationStatus = ["pending", "approved", "rejected"].includes(String(body.moderationStatus))
    ? String(body.moderationStatus) : photo.moderation_status;
  await env.DB.prepare("UPDATE photos SET caption = ?, is_featured = ?, moderation_status = ? WHERE id = ?")
    .bind(caption, isFeatured, moderationStatus, id).run();
  return NextResponse.json({ ok: true, caption, is_featured: isFeatured, moderation_status: moderationStatus });
}
