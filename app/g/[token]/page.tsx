import { env } from "cloudflare:workers";
import { LockKeyhole, QrCode, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GalleryView } from "@/components/veyra/gallery-view";
import { recordEventMetric } from "@/lib/analytics";
import { getAlbumByToken, type PhotoRecord } from "@/lib/data";
import { canViewGallery, isAdmin } from "@/lib/security";

export const dynamic = "force-dynamic";

export default async function GalleryPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const query = await searchParams;
  const album = await getAlbumByToken(token);
  if (!album) notFound();

  const adminPreview = await isAdmin();
  if (album.status !== "live" && !adminPreview) {
    return (
      <main className="guest-access-shell">
        <div className="emoji-sky guest-emojis" aria-hidden="true"><span>✨</span><span>📸</span><span>🌸</span></div>
        <header className="guest-access-header"><Link href="/"><img src="/snap-hub-logo.png" alt="Snap HUB" /></Link><span>Event preview</span></header>
        <section className="guest-access-card event-paused-card"><div className="guest-event-icon">{album.status === "paused" ? "⏸️" : "⏳"}</div><p className="pink-eyebrow">{album.event_type}</p><h1>{album.title}</h1><p>{album.status === "paused" ? "The host has paused this event. Your QR will work again as soon as the host resumes it." : "This event gallery is being prepared by the host. Please scan the QR again when the event is live."}</p></section>
      </main>
    );
  }

  const unlocked = await canViewGallery(album);
  if (!unlocked) {
    return (
      <main className="guest-access-shell">
        <div className="emoji-sky guest-emojis" aria-hidden="true"><span>🎉</span><span>✨</span><span>🌸</span><span>📸</span><span>🪩</span></div>
        <header className="guest-access-header">
          <Link href="/" aria-label="Snap HUB home"><img src="/snap-hub-logo.png" alt="Snap HUB" /></Link>
          <span><QrCode /> Private event</span>
        </header>
        <section className="guest-access-card">
          <div className="guest-event-icon"><LockKeyhole /></div>
          <p className="pink-eyebrow">{album.event_type}</p>
          <h1>{album.title}</h1>
          {album.event_date && <time>{new Date(`${album.event_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</time>}
          <p>Your QR brought you to the right place. Enter the guest details shared by your host to enjoy every photo and video.</p>
          {query.error && <div className="login-error">{query.error === "rate-limited" ? "Too many attempts. Please wait a few minutes before trying again." : "Those guest details do not match this event."}</div>}
          <form className="pink-form" action={`/api/gallery/${token}/unlock`} method="post">
            <label>Guest ID<input name="username" autoComplete="username" required placeholder="guest-xxxxx" /></label>
            <label>Password<input name="password" type="password" autoComplete="current-password" required placeholder="Event password" /></label>
            <button><Sparkles /> Open the memories</button>
          </form>
          <small>No app needed · Secure access from any browser</small>
        </section>
      </main>
    );
  }

  if (!adminPreview) await recordEventMetric(album.id, "gallery_views");

  const result = await env.DB.prepare(
    `SELECT p.id, p.album_id, p.object_key, p.filename, p.content_type, p.caption,
      p.is_featured, p.collection_id, c.name AS collection_name, p.moderation_status,
      p.uploader_name, p.source, p.size, p.created_at
     FROM photos p LEFT JOIN event_collections c ON c.id = p.collection_id
     WHERE p.album_id = ? AND p.moderation_status = 'approved'
     ORDER BY p.created_at DESC`,
  ).bind(album.id).all<PhotoRecord>();
  const collections = await env.DB.prepare(
    "SELECT id, name FROM event_collections WHERE album_id = ? ORDER BY created_at ASC",
  ).bind(album.id).all<{ id: string; name: string }>();

  return <GalleryView
    album={{
      title: album.title, eventType: album.event_type, eventDate: album.event_date,
      description: album.description, tagline: album.tagline, location: album.location,
      theme: album.theme, coverPhotoId: album.cover_photo_id,
      allowGuestUploads: Boolean(album.allow_guest_uploads),
      downloadsEnabled: Boolean(album.downloads_enabled),
      moderationMode: album.moderation_mode,
    }}
    token={token}
    collections={collections.results}
    media={result.results.map((item) => ({
      id: item.id, filename: item.filename, contentType: item.content_type,
      caption: item.caption, isFeatured: Boolean(item.is_featured),
      collectionId: item.collection_id, collectionName: item.collection_name,
    }))}
  />;
}
