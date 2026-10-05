import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getAlbumByToken, type PhotoRecord } from "@/lib/data";
import { canViewGallery } from "@/lib/security";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const album = await getAlbumByToken(token);
  if (!album || !(await canViewGallery(album))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await env.DB.prepare(
    `SELECT p.id, p.album_id, p.object_key, p.filename, p.content_type, p.caption,
      p.is_featured, p.collection_id, c.name AS collection_name, p.moderation_status,
      p.uploader_name, p.source, p.size, p.created_at
     FROM photos p LEFT JOIN event_collections c ON c.id = p.collection_id
     WHERE p.album_id = ? AND p.moderation_status = 'approved'
     ORDER BY p.created_at DESC`,
  ).bind(album.id).all<PhotoRecord>();
  return NextResponse.json({
    slideshow: {
      playing: Boolean(album.slideshow_playing),
      position: album.slideshow_position,
      updatedAt: album.slideshow_updated_at,
    },
    media: result.results.map((item) => ({
      id: item.id, filename: item.filename, contentType: item.content_type,
      caption: item.caption, isFeatured: Boolean(item.is_featured),
      collectionId: item.collection_id, collectionName: item.collection_name,
    })),
  });
}
