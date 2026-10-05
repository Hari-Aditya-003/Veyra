"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, Download, Film, Heart, Image as ImageIcon,
  ImageUp, MapPin, Maximize2, Play, Search, Sparkles, Star, Upload, X,
} from "lucide-react";
import { toast, Toaster } from "sonner";

type GalleryMedia = {
  id: string; filename: string; contentType: string; caption: string; isFeatured: boolean;
  collectionId: string | null; collectionName?: string | null;
};
type GalleryViewProps = {
  album: {
    title: string; eventType: string; eventDate: string; description: string; tagline: string;
    location: string; theme: string; coverPhotoId: string | null; allowGuestUploads: boolean;
    downloadsEnabled: boolean; moderationMode: string;
  };
  token: string;
  media: GalleryMedia[];
  collections: Array<{ id: string; name: string }>;
};

type Filter = "all" | "photos" | "videos" | "highlights" | "favorites";

export function GalleryView({ album, token, media: initialMedia, collections }: GalleryViewProps) {
  const [media, setMedia] = useState(initialMedia);
  const [filter, setFilter] = useState<Filter>("all");
  const [collectionId, setCollectionId] = useState("all");
  const [query, setQuery] = useState("");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(`snap-hub-favorites:${token}`);
    if (stored) {
      try { setFavorites(new Set(JSON.parse(stored) as string[])); } catch { window.localStorage.removeItem(`snap-hub-favorites:${token}`); }
    }
    if (new URLSearchParams(window.location.search).get("upload") === "1") setUploadOpen(true);
  }, [token]);

  const filtered = useMemo(() => media.filter((item) => {
    const kindMatch = filter === "all" || (filter === "photos" && item.contentType.startsWith("image/")) ||
      (filter === "videos" && item.contentType.startsWith("video/")) ||
      (filter === "highlights" && item.isFeatured) || (filter === "favorites" && favorites.has(item.id));
    const collectionMatch = collectionId === "all" || item.collectionId === collectionId;
    const text = `${item.filename} ${item.caption} ${item.collectionName ?? ""}`.toLowerCase();
    return kindMatch && collectionMatch && text.includes(query.toLowerCase().trim());
  }), [collectionId, favorites, filter, media, query]);

  function move(direction: number) {
    setViewerIndex((value) => value === null ? 0 : (value + direction + filtered.length) % filtered.length);
  }
  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      window.localStorage.setItem(`snap-hub-favorites:${token}`, JSON.stringify([...next]));
      return next;
    });
  }
  async function refreshMedia() {
    const response = await fetch(`/api/gallery/${token}/media`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { media: GalleryMedia[] };
    setMedia(data.media);
  }
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setUploading(true);
    const response = await fetch(`/api/gallery/${token}/upload`, { method: "POST", body: new FormData(form) });
    const data = await response.json();
    setUploading(false);
    if (!response.ok) return toast.error(data.error ?? "Upload failed");
    form.reset();
    if (data.moderationStatus === "approved") {
      await refreshMedia();
      toast.success("Your memories are now in the gallery");
    } else {
      toast.success("Uploaded — the host will approve these memories");
    }
    setUploadOpen(false);
  }

  const active = viewerIndex === null ? null : filtered[viewerIndex];
  const src = (item: GalleryMedia) => `/api/gallery/${token}/photos/${item.id}`;

  return (
    <main className={`memory-gallery theme-${album.theme}`}>
      <Toaster richColors position="top-center" />
      <div className="emoji-sky gallery-emojis" aria-hidden="true"><span>✨</span><span>🎉</span><span>🌸</span><span>📸</span><span>🪩</span><span>💛</span></div>
      <header className="memory-header">
        <a href="/" aria-label="Snap HUB home"><img src="/snap-hub-logo.png" alt="Snap HUB" /></a>
        <div><span>{media.length} memories</span>{album.allowGuestUploads && <button className="soft-action" onClick={() => setUploadOpen(true)}><Upload /> Add memories</button>}<a className="show-link" href={`/g/${token}/slideshow`}><Play /> Live slideshow</a></div>
      </header>

      <section className={`memory-intro${album.coverPhotoId ? " has-cover" : ""}`}>
        {album.coverPhotoId && <img className="event-cover" src={`/api/gallery/${token}/photos/${album.coverPhotoId}`} alt="" />}
        <div className="memory-intro-copy">
          <p className="gallery-kicker">{album.eventType} · Private gallery</p>
          <h1>{album.title}</h1>
          {album.tagline && <strong className="event-tagline">{album.tagline}</strong>}
          {album.description && <p>{album.description}</p>}
          <div className="event-meta">{album.eventDate && <time>{new Date(`${album.eventDate}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</time>}{album.location && <span><MapPin /> {album.location}</span>}</div>
        </div>
      </section>

      {uploadOpen && album.allowGuestUploads && <section className="guest-upload-panel">
        <div className="panel-heading"><div><span><ImageUp /></span><div><h2>Share your memories</h2><p>Photos and videos can be reviewed by the host before everyone sees them.</p></div></div><button onClick={() => setUploadOpen(false)} aria-label="Close upload"><X /></button></div>
        <form onSubmit={upload}>
          <label>Your name<input name="uploaderName" maxLength={80} placeholder="How should the host know you?" /></label>
          <label>Caption<input name="caption" maxLength={240} placeholder="A short memory or message" /></label>
          {collections.length > 0 && <label>Album<select name="collectionId">{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>}
          <label className="guest-file-picker"><ImageUp /><span><strong>Choose photos or videos</strong><small>Up to 75 MB each</small></span><input type="file" name="photos" accept="image/*,video/*" multiple required /></label>
          <button disabled={uploading}>{uploading ? "Uploading…" : album.moderationMode === "manual" ? "Send for approval" : "Add to gallery"}</button>
        </form>
      </section>}

      <section className="gallery-toolbar">
        <div className="magic-search"><Sparkles /><label><span>Magic Find <small>beta</small></span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search captions, filenames or albums…" /></label><Search /></div>
        {collections.length > 1 && <select className="collection-filter" value={collectionId} onChange={(event) => setCollectionId(event.target.value)}><option value="all">All albums</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select>}
        <div className="filter-tabs">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
          <button className={filter === "photos" ? "active" : ""} onClick={() => setFilter("photos")}><ImageIcon /> Photos</button>
          <button className={filter === "videos" ? "active" : ""} onClick={() => setFilter("videos")}><Film /> Videos</button>
          <button className={filter === "highlights" ? "active" : ""} onClick={() => setFilter("highlights")}><Star /> Highlights</button>
          <button className={filter === "favorites" ? "active" : ""} onClick={() => setFilter("favorites")}><Heart /> Saved</button>
        </div>
      </section>

      <section className="memory-grid">
        {filtered.map((item, index) => {
          const isVideo = item.contentType.startsWith("video/");
          return <article key={item.id} className="memory-card">
            <button className="memory-open" onClick={() => setViewerIndex(index)} aria-label={`Open ${item.filename}`}>
              {isVideo ? <video src={src(item)} preload="metadata" muted /> : <img src={src(item)} alt={item.caption || item.filename} />}
              <span className="expand-chip"><Maximize2 /> View</span>
              {isVideo && <span className="video-chip"><Play /> Video</span>}
              {item.isFeatured && <span className="highlight-chip"><Star /> Highlight</span>}
            </button>
            <div className="memory-caption"><span>{item.caption || item.filename}</span><div><button className={favorites.has(item.id) ? "favorite active" : "favorite"} onClick={() => toggleFavorite(item.id)} aria-label="Save favorite"><Heart /></button>{album.downloadsEnabled && <a href={`${src(item)}?download=1`} aria-label={`Download ${item.filename}`}><Download /></a>}</div></div>
          </article>;
        })}
        {!filtered.length && <div className="guest-empty"><div>{media.length ? "✨" : "📸"}</div><h2>{media.length ? "No matching memories" : "The memories are on their way"}</h2><p>{media.length ? "Try another search, album or filter." : "Your host has not added photos or videos yet. Come back soon."}</p></div>}
      </section>

      <footer className="memory-footer"><strong>Snap HUB</strong><span>One QR · Every memory · No app needed</span></footer>

      {active && <div className="slideshow" role="dialog" aria-modal="true" aria-label="Memory viewer">
        <button className="close-show" onClick={() => setViewerIndex(null)} aria-label="Close viewer"><X /></button>
        <button className="slide-nav prev" onClick={() => move(-1)} aria-label="Previous memory"><ChevronLeft /></button>
        <div className="slide-stage">
          {active.contentType.startsWith("video/") ? <video key={active.id} src={src(active)} controls autoPlay /> : <img key={active.id} src={src(active)} alt={active.caption || active.filename} />}
          <div className="slide-info"><div><strong>{active.caption || active.filename}</strong><span>{(viewerIndex ?? 0) + 1} of {filtered.length}</span></div><button onClick={() => toggleFavorite(active.id)}><Heart /> {favorites.has(active.id) ? "Saved" : "Save"}</button>{album.downloadsEnabled && <a href={`${src(active)}?download=1`}><Download /> Download</a>}</div>
        </div>
        <button className="slide-nav next" onClick={() => move(1)} aria-label="Next memory"><ChevronRight /></button>
      </div>}
    </main>
  );
}
