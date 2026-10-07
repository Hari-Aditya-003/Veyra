"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Music2, Pause, Play, RefreshCw, Volume2, VolumeX, WifiOff, X } from "lucide-react";

type SlideMedia = { id: string; filename: string; contentType: string; caption: string; isFeatured: boolean };
type SlideshowControl = { playing: boolean; position: number; updatedAt: number };

export function LiveSlideshow({ title, token, initialMedia, initialControl }: { title: string; token: string; initialMedia: SlideMedia[]; initialControl: SlideshowControl }) {
  const [media, setMedia] = useState(initialMedia);
  const [index, setIndex] = useState(initialMedia.length ? Math.min(initialControl.position, initialMedia.length - 1) : 0);
  const [remoteControl, setRemoteControl] = useState(initialControl);
  const [localPaused, setLocalPaused] = useState(false);
  const [connection, setConnection] = useState<"connected" | "reconnecting">("connected");
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicBlocked, setMusicBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playing = remoteControl.playing && !localPaused;

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/gallery/${token}/media`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Slideshow refresh failed with ${response.status}`);
        const data = await response.json() as { media: SlideMedia[]; slideshow: SlideshowControl };
        if (!active) return;
        setConnection("connected");
        setMedia(data.media);
        setRemoteControl((current) => {
          if (data.slideshow.updatedAt !== current.updatedAt) {
            setIndex(data.media.length ? Math.min(data.slideshow.position, data.media.length - 1) : 0);
          } else {
            setIndex((value) => data.media.length ? Math.min(value, data.media.length - 1) : 0);
          }
          return data.slideshow;
        });
      } catch {
        if (active) setConnection("reconnecting");
      }
    };
    const onVisibilityChange = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1500);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [token]);

  useEffect(() => {
    if (!playing || media.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % media.length), 6000);
    return () => window.clearInterval(timer);
  }, [media.length, playing]);

  const startMusic = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.3;
    try {
      await audio.play();
      setMusicPlaying(true);
      setMusicBlocked(false);
    } catch {
      setMusicPlaying(false);
      setMusicBlocked(true);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!playing || !musicEnabled) {
      audio.pause();
      return;
    }
    audio.volume = 0.3;
    void audio.play().then(() => setMusicBlocked(false)).catch(() => setMusicBlocked(true));
  }, [musicEnabled, playing]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && media.length) setIndex((current) => (current - 1 + media.length) % media.length);
      if (event.key === "ArrowRight" && media.length) setIndex((current) => (current + 1) % media.length);
      if (event.key.toLowerCase() === "m") {
        if (musicPlaying) setMusicEnabled(false); else { setMusicEnabled(true); void startMusic(); }
      }
      if (event.key === " ") {
        event.preventDefault();
        setLocalPaused((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [media.length, musicPlaying, startMusic]);

  const active = media[index];
  const move = (direction: number) => setIndex((current) => (current + direction + media.length) % media.length);
  const toggleMusic = () => {
    if (musicPlaying) {
      setMusicEnabled(false);
      setMusicBlocked(false);
    } else {
      setMusicEnabled(true);
      void startMusic();
    }
  };
  return (
    <main className="live-show-shell">
      <audio ref={audioRef} src="/snap-hub-ambient.m4a" loop preload="auto" onPlay={() => setMusicPlaying(true)} onPause={() => setMusicPlaying(false)} />
      <header className="live-show-header"><div><span>Live slideshow</span><strong>{title}</strong></div><div><span className={connection}>{connection === "reconnecting" ? <><WifiOff /> Reconnecting…</> : <><RefreshCw /> {remoteControl.playing ? "Live control connected" : "Paused by host"}</>}</span><a href={`/g/${token}`} aria-label="Close slideshow"><X /></a></div></header>
      {active ? <section className="live-show-stage">
        <button onClick={() => move(-1)} aria-label="Previous memory"><ChevronLeft /></button>
        <div className="live-show-media">
          {active.contentType.startsWith("video/") ? <video key={active.id} src={`/api/gallery/${token}/photos/${active.id}`} controls autoPlay muted playsInline preload="metadata" /> : <img key={active.id} src={`/api/gallery/${token}/photos/${active.id}`} alt={active.caption || active.filename} decoding="async" fetchPriority="high" />}
          <div><span>{active.caption || active.filename}</span><small>{index + 1} / {media.length}</small></div>
        </div>
        <button onClick={() => move(1)} aria-label="Next memory"><ChevronRight /></button>
      </section> : <section className="live-show-empty"><div>📸</div><h1>The slideshow is ready</h1><p>New approved memories will appear here automatically.</p></section>}
      {musicBlocked && musicEnabled && playing && <button className="music-start" onClick={() => void startMusic()}><Music2 /> Tap once to start music</button>}
      <footer className="live-show-footer"><strong>Snap HUB</strong><div><button onClick={toggleMusic} aria-label={musicPlaying ? "Turn music off" : "Turn music on"}>{musicPlaying ? <><Volume2 /> Music on</> : <><VolumeX /> Music off</>}</button><button onClick={() => setLocalPaused((value) => !value)} disabled={!remoteControl.playing}>{playing ? <><Pause /> Pause on this screen</> : <><Play /> Resume on this screen</>}</button></div></footer>
    </main>
  );
}
