import { recordEventMetric } from "@/lib/analytics";
import { getAlbumByToken, getPhoto } from "@/lib/data";
import { driveMediaResponse, GoogleDriveError } from "@/lib/google-drive";
import { canViewGallery } from "@/lib/security";

export async function GET(request: Request, context: { params: Promise<{ token: string; photoId: string }> }) {
  const { token, photoId } = await context.params;
  const album = await getAlbumByToken(token);
  if (!album || !(await canViewGallery(album))) return new Response("Unauthorized", { status: 401 });
  const photo = await getPhoto(photoId);
  if (!photo || photo.album_id !== album.id || photo.moderation_status !== "approved") return new Response("Not found", { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  if (download && !album.downloads_enabled) return new Response("Downloads are disabled for this event", { status: 403 });
  if (download) await recordEventMetric(album.id, "downloads");
  try {
    return await driveMediaResponse(photo.object_key, request, {
      contentType: photo.content_type,
      filename: photo.filename,
      download,
      cacheControl: "private, max-age=86400",
    });
  } catch (error) {
    return new Response(error instanceof GoogleDriveError ? error.message : "Google Drive is unavailable", {
      status: error instanceof GoogleDriveError ? error.status : 502,
    });
  }
}
