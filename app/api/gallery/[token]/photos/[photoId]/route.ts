import { env } from "cloudflare:workers";
import { getAlbumByToken, getPhoto } from "@/lib/data";
import { hasGallerySession } from "@/lib/security";

export async function GET(request: Request, context: { params: Promise<{ token: string; photoId: string }> }) {
  const { token, photoId } = await context.params;
  const album = await getAlbumByToken(token);
  if (!album || !(await hasGallerySession(album.id))) return new Response("Unauthorized", { status: 401 });
  const photo = await getPhoto(photoId);
  if (!photo || photo.album_id !== album.id) return new Response("Not found", { status: 404 });
  const object = await env.BUCKET.get(photo.object_key);
  if (!object) return new Response("Not found", { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(object.body, {
    headers: {
      "Content-Type": photo.content_type,
      "Cache-Control": "private, max-age=3600",
      ...(download ? { "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(photo.filename)}` } : {}),
    },
  });
}
