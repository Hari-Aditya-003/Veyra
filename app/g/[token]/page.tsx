import { env } from "cloudflare:workers";
import { LockKeyhole, QrCode, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { GalleryView } from "@/components/veyra/gallery-view";
import { getAlbumByToken, type PhotoRecord } from "@/lib/data";
import { hasGallerySession } from "@/lib/security";

export const dynamic = "force-dynamic";

export default async function GalleryPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const query = await searchParams;
  const album = await getAlbumByToken(token);
  if (!album) notFound();

  const unlocked = await hasGallerySession(album.id);
  if (!unlocked) {
    return (
      <main className="guest-access-shell">
        <div className="emoji-sky guest-emojis" aria-hidden="true"><span>🎉</span><span>✨</span><span>🌸</span><span>📸</span><span>🪩</span></div>
        <header className="guest-access-header">
          <a href="/" aria-label="Snap HUB home">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/snap-hub-logo.png" alt="Snap HUB" /></a>
          <span><QrCode /> Private event</span>
        </header>
        <section className="guest-access-card">
          <div className="guest-event-icon"><LockKeyhole /></div>
          <p className="pink-eyebrow">{album.event_type}</p>
          <h1>{album.title}</h1>
          {album.event_date && <time>{new Date(`${album.event_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</time>}
          <p>Your QR brought you to the right place. Enter the guest details shared by your host to enjoy every photo and video.</p>
          {query.error && <div className="login-error">Those guest details do not match this event.</div>}
          <form className="pink-form" action={`/api/gallery/${token}/unlock`} method="post">
            <label>Guest ID<input name="username" autoComplete="username" required placeholder="guest-xxxxx" /></label>
            <label>Password<input name="password" type="password" autoComplete="current-password" required placeholder="Event password" /></label>
            <button><Sparkles /> Open the memories</button>
          </form>
          <small>No app needed · View and download only</small>
        </section>
      </main>
    );
  }

  const result = await env.DB.prepare(
    "SELECT id, album_id, object_key, filename, content_type, caption, is_featured, size, created_at FROM photos WHERE album_id = ? ORDER BY created_at DESC",
  ).bind(album.id).all<PhotoRecord>();

  return <GalleryView
    album={{ title: album.title, eventType: album.event_type, eventDate: album.event_date, description: album.description, theme: album.theme }}
    token={token}
    media={result.results.map((item) => ({ id: item.id, filename: item.filename, contentType: item.content_type, caption: item.caption, isFeatured: Boolean(item.is_featured) }))}
  />;
}
