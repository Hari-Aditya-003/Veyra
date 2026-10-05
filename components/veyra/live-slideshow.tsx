"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RefreshCw, X } from "lucide-react";

type SlideMedia = { id: string; filename: string; contentType: string; caption: string; isFeatured: boolean };
type SlideshowControl = { playing: boolean; position: number; updatedAt: number };

export function LiveSlideshow({ title, token, initialMedia, initialControl }: { title: string; token: string; initialMedia: SlideMedia[]; initialControl: SlideshowControl }) {
  const [media, setMedia] = useState(initialMedia);
  const [index, setIndex] = useState(initialMedia.length ? Math.min(initialControl.position, initialMedia.length - 1) : 0);
  const [remoteControl, setRemoteControl] = useState(initialControl);
  const [localPaused, setLocalPaused] = useState(false);
  const playing = remoteControl.playing && !localPaused;

  useEffect(() => {
    const refresh = async () => {
      const response = await fetch(`/api/gallery/${token}/media`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { media: SlideMedia[]; slideshow: SlideshowControl };
      setMedia(data.media);
      setRemoteControl((current) => {
        if (data.slideshow.updatedAt !== current.updatedAt) {
          setIndex(data.media.length ? Math.min(data.slideshow.position, data.media.length - 1) : 0);
        } else {
          setIndex((value) => data.media.length ? Math.min(value, data.media.length - 1) : 0);
        }
        return data.slideshow;
      });
    };
    const timer = window.setInterval(() => void refresh(), 2500);
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
      <header className="live-show-header"><div><span>Live slideshow</span><strong>{title}</strong></div><div><span><RefreshCw /> {remoteControl.playing ? "Live control connected" : "Paused by host"}</span><a href={`/g/${token}`} aria-label="Close slideshow"><X /></a></div></header>
      {active ? <section className="live-show-stage">
        <button onClick={() => move(-1)} aria-label="Previous memory"><ChevronLeft /></button>
        <div className="live-show-media">
          {active.contentType.startsWith("video/") ? <video key={active.id} src={`/api/gallery/${token}/photos/${active.id}`} controls autoPlay muted /> : <img key={active.id} src={`/api/gallery/${token}/photos/${active.id}`} alt={active.caption || active.filename} />}
          <div><span>{active.caption || active.filename}</span><small>{index + 1} / {media.length}</small></div>
        </div>
        <button onClick={() => move(1)} aria-label="Next memory"><ChevronRight /></button>
      </section> : <section className="live-show-empty"><div>📸</div><h1>The slideshow is ready</h1><p>New approved memories will appear here automatically.</p></section>}
      <footer className="live-show-footer"><strong>Snap HUB</strong><button onClick={() => setLocalPaused((value) => !value)} disabled={!remoteControl.playing}>{playing ? <><Pause /> Pause on this screen</> : <><Play /> Resume on this screen</>}</button></footer>
    </main>
  );
}
