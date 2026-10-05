import { env } from "cloudflare:workers";
import { notFound, redirect } from "next/navigation";
import { LiveSlideshow } from "@/components/veyra/live-slideshow";
import { getAlbumByToken, type PhotoRecord } from "@/lib/data";
import { canViewGallery } from "@/lib/security";

export const dynamic = "force-dynamic";

export default async function SlideshowPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const album = await getAlbumByToken(token);
  if (!album) notFound();
  if (!(await canViewGallery(album))) redirect(`/g/${token}`);
  const result = await env.DB.prepare(
    `SELECT id, album_id, object_key, filename, content_type, caption, is_featured,
      collection_id, moderation_status, uploader_name, source, size, created_at
     FROM photos WHERE album_id = ? AND moderation_status = 'approved'
     ORDER BY is_featured DESC, created_at DESC`,
  ).bind(album.id).all<PhotoRecord>();
  return <LiveSlideshow
    title={album.title}
    token={token}
    initialMedia={result.results.map((item) => ({
      id: item.id, filename: item.filename, contentType: item.content_type,
      caption: item.caption, isFeatured: Boolean(item.is_featured),
    }))}
  />;
}
