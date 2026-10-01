import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getAlbumById } from "@/lib/data";
import { isAdmin } from "@/lib/security";

const MAX_FILE_SIZE = 75 * 1024 * 1024;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: albumId } = await context.params;
  if (!(await getAlbumById(albumId))) return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  const form = await request.formData();
  const files = form.getAll("photos").filter((item): item is File => item instanceof File);
  if (!files.length) return NextResponse.json({ error: "Choose at least one photo" }, { status: 400 });

  const created: Array<Record<string, unknown>> = [];
  for (const file of files) {
    const supported = file.type.startsWith("image/") || file.type.startsWith("video/");
    if (!supported || file.size > MAX_FILE_SIZE) continue;
    const photoId = crypto.randomUUID();
    const objectKey = `albums/${albumId}/${photoId}`;
    await env.BUCKET.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type } });
    await env.DB.prepare(
      "INSERT INTO photos (id, album_id, object_key, filename, content_type, caption, is_featured, size, created_at) VALUES (?, ?, ?, ?, ?, '', 0, ?, ?)",
    ).bind(photoId, albumId, objectKey, file.name, file.type, file.size, Date.now()).run();
    created.push({ id: photoId, filename: file.name, size: file.size });
  }
  return NextResponse.json({ photos: created });
}
