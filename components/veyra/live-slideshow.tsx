"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RefreshCw, X } from "lucide-react";

type SlideMedia = { id: string; filename: string; contentType: string; caption: string; isFeatured: boolean };

export function LiveSlideshow({ title, token, initialMedia }: { title: string; token: string; initialMedia: SlideMedia[] }) {
  const [media, setMedia] = useState(initialMedia);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const refresh = async () => {
      const response = await fetch(`/api/gallery/${token}/media`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { media: SlideMedia[] };
      setMedia(data.media);
      setIndex((current) => data.media.length ? Math.min(current, data.media.length - 1) : 0);
    };
    const timer = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(timer);
  }, [token]);

  useEffect(() => {
    if (!playing || media.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % media.length), 5000);
    return () => window.clearInterval(timer);
  }, [media.length, playing]);

  const active = media[index];
  const move = (direction: number) => setIndex((current) => (current + direction + media.length) % media.length);
  return (
    <main className="live-show-shell">
      <header className="live-show-header"><div><span>Live slideshow</span><strong>{title}</strong></div><div><span><RefreshCw /> Refreshes automatically</span><a href={`/g/${token}`} aria-label="Close slideshow"><X /></a></div></header>
      {active ? <section className="live-show-stage">
        <button onClick={() => move(-1)} aria-label="Previous memory"><ChevronLeft /></button>
        <div className="live-show-media">
          {active.contentType.startsWith("video/") ? <video key={active.id} src={`/api/gallery/${token}/photos/${active.id}`} controls autoPlay muted /> : <img key={active.id} src={`/api/gallery/${token}/photos/${active.id}`} alt={active.caption || active.filename} />}
          <div><span>{active.caption || active.filename}</span><small>{index + 1} / {media.length}</small></div>
        </div>
        <button onClick={() => move(1)} aria-label="Next memory"><ChevronRight /></button>
      </section> : <section className="live-show-empty"><div>📸</div><h1>The slideshow is ready</h1><p>New approved memories will appear here automatically.</p></section>}
      <footer className="live-show-footer"><strong>Snap HUB</strong><button onClick={() => setPlaying((value) => !value)}>{playing ? <><Pause /> Pause</> : <><Play /> Play</>}</button></footer>
    </main>
  );
}
