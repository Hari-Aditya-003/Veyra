"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Film, Image as ImageIcon, Maximize2, Pause, Play, Search, Sparkles, Star, X } from "lucide-react";

type GalleryMedia = { id: string; filename: string; contentType: string; caption: string; isFeatured: boolean };
type GalleryViewProps = {
  album: { title: string; eventType: string; eventDate: string; description: string; theme: string };
  token: string;
  media: GalleryMedia[];
};

export function GalleryView({ album, token, media }: GalleryViewProps) {
  const [filter, setFilter] = useState<"all" | "photos" | "videos" | "highlights">("all");
  const [query, setQuery] = useState("");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const filtered = useMemo(() => media.filter((item) => {
    const kindMatch = filter === "all" || (filter === "photos" && item.contentType.startsWith("image/")) ||
      (filter === "videos" && item.contentType.startsWith("video/")) || (filter === "highlights" && item.isFeatured);
    const text = `${item.filename} ${item.caption}`.toLowerCase();
    return kindMatch && text.includes(query.toLowerCase().trim());
  }), [filter, media, query]);

  useEffect(() => {
    if (!playing || viewerIndex === null || filtered.length < 2) return;
    const timer = window.setInterval(() => setViewerIndex((value) => value === null ? 0 : (value + 1) % filtered.length), 3500);
    return () => window.clearInterval(timer);
  }, [filtered.length, playing, viewerIndex]);

  function openSlideshow() {
    if (!filtered.length) return;
    setViewerIndex(0); setPlaying(true);
  }
  function move(direction: number) {
    setViewerIndex((value) => value === null ? 0 : (value + direction + filtered.length) % filtered.length);
  }

  const active = viewerIndex === null ? null : filtered[viewerIndex];
  const src = (item: GalleryMedia) => `/api/gallery/${token}/photos/${item.id}`;

  return (
    <main className={`memory-gallery theme-${album.theme}`}>
      <div className="emoji-sky gallery-emojis" aria-hidden="true"><span>✨</span><span>🎉</span><span>🌸</span><span>📸</span><span>🪩</span><span>💛</span></div>
      <header className="memory-header">
        <a href="/" aria-label="Snap HUB home">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/snap-hub-logo.png" alt="Snap HUB" /></a>
        <div><span>{media.length} memories</span><button onClick={openSlideshow}><Play /> Start slideshow</button></div>
      </header>

      <section className="memory-intro">
        <p className="gallery-kicker">{album.eventType} · Private gallery</p>
        <h1>{album.title}</h1>
        {album.description && <p>{album.description}</p>}
        {album.eventDate && <time>{new Date(`${album.eventDate}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</time>}
      </section>

      <section className="gallery-toolbar">
        <div className="magic-search"><Sparkles /><label><span>Magic Find <small>beta</small></span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “dance”, “family” or a caption…" /></label><Search /></div>
        <div className="filter-tabs">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
          <button className={filter === "photos" ? "active" : ""} onClick={() => setFilter("photos")}><ImageIcon /> Photos</button>
          <button className={filter === "videos" ? "active" : ""} onClick={() => setFilter("videos")}><Film /> Videos</button>
          <button className={filter === "highlights" ? "active" : ""} onClick={() => setFilter("highlights")}><Star /> Highlights</button>
        </div>
      </section>

      <section className="memory-grid">
        {filtered.map((item, index) => {
          const isVideo = item.contentType.startsWith("video/");
          return <article key={item.id} className="memory-card">
            <button className="memory-open" onClick={() => { setViewerIndex(index); setPlaying(false); }} aria-label={`Open ${item.filename}`}>
              {isVideo ? <video src={src(item)} preload="metadata" muted /> : <img src={src(item)} alt={item.caption || item.filename} />}
              <span className="expand-chip"><Maximize2 /> View</span>
              {isVideo && <span className="video-chip"><Play /> Video</span>}
              {item.isFeatured && <span className="highlight-chip"><Star /> Highlight</span>}
            </button>
            <div className="memory-caption"><span>{item.caption || item.filename}</span><a href={`${src(item)}?download=1`} aria-label={`Download ${item.filename}`}><Download /></a></div>
          </article>;
        })}
        {!filtered.length && <div className="guest-empty"><div>{media.length ? "✨" : "📸"}</div><h2>{media.length ? "No matching memories" : "The memories are on their way"}</h2><p>{media.length ? "Try another Magic Find word or filter." : "Your host has not added photos or videos yet. Come back soon."}</p></div>}
      </section>

      <footer className="memory-footer"><strong>Snap HUB</strong><span>One QR · Every memory · No app needed</span></footer>

      {active && <div className="slideshow" role="dialog" aria-modal="true" aria-label="Event slideshow">
        <button className="close-show" onClick={() => { setViewerIndex(null); setPlaying(false); }} aria-label="Close slideshow"><X /></button>
        <button className="slide-nav prev" onClick={() => move(-1)} aria-label="Previous memory"><ChevronLeft /></button>
        <div className="slide-stage">
          {active.contentType.startsWith("video/") ? <video key={active.id} src={src(active)} controls autoPlay /> : <img key={active.id} src={src(active)} alt={active.caption || active.filename} />}
          <div className="slide-info"><div><strong>{active.caption || active.filename}</strong><span>{(viewerIndex ?? 0) + 1} of {filtered.length}</span></div><button onClick={() => setPlaying((value) => !value)}>{playing ? <><Pause /> Pause</> : <><Play /> Play</>}</button><a href={`${src(active)}?download=1`}><Download /> Download</a></div>
        </div>
        <button className="slide-nav next" onClick={() => move(1)} aria-label="Next memory"><ChevronRight /></button>
      </div>}
    </main>
  );
}
