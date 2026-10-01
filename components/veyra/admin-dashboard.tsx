"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  CalendarDays, Copy, Download, ExternalLink, Film, ImagePlus, LogOut,
  Palette, Play, Plus, QrCode, Save, Sparkles, Star, Trash2, Upload, Users,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Album = {
  id: string; title: string; event_type: string; event_date: string; description: string;
  theme: string; expected_guests: number; access_token: string; guest_username: string;
  guest_password?: string; created_at: number; media_count: number; storage_bytes: number;
};
type Media = {
  id: string; album_id: string; filename: string; content_type: string; caption: string;
  is_featured: number; size: number; created_at: number;
};

const eventTypes = ["Wedding", "Birthday", "Engagement", "Festival", "Graduation", "Corporate", "Concert", "Family gathering", "Other"];
const themes = [
  { id: "rose", label: "Rose pop", color: "#ff4fa3" },
  { id: "sunset", label: "Sunset", color: "#ff7a45" },
  { id: "violet", label: "Violet", color: "#8b5cf6" },
  { id: "ocean", label: "Ocean", color: "#00a8cc" },
  { id: "marigold", label: "Marigold", color: "#f59e0b" },
];

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(0, value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function AdminDashboard() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [captionDrafts, setCaptionDrafts] = useState<Record<string, string>>({});

  const selected = albums.find((album) => album.id === selectedId) ?? albums[0];
  const selectedMedia = useMemo(() => media.filter((item) => item.album_id === selected?.id), [media, selected]);
  const totals = useMemo(() => ({
    media: albums.reduce((sum, album) => sum + Number(album.media_count), 0),
    storage: albums.reduce((sum, album) => sum + Number(album.storage_bytes), 0),
    guests: albums.reduce((sum, album) => sum + Number(album.expected_guests), 0),
  }), [albums]);

  const load = useCallback(async () => {
    const response = await fetch("/api/albums", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setAlbums(data.albums);
    setMedia(data.photos);
    setCaptionDrafts(Object.fromEntries(data.photos.map((item: Media) => [item.id, item.caption ?? ""])));
    setSelectedId((current) => current ?? data.albums[0]?.id ?? null);
  }, []);

  useEffect(() => { setOrigin(window.location.origin); void load(); }, [load]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool({
        name: "list_snap_hub_events",
        title: "List Snap HUB events",
        description: "Read the host's current Snap HUB events and media counts.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        async execute() {
          const response = await fetch("/api/albums", { cache: "no-store" });
          if (!response.ok) throw new Error("Could not load events");
          const data = await response.json();
          return { events: data.albums.map((album: Album) => ({ id: album.id, title: album.title, eventType: album.event_type, mediaCount: album.media_count })) };
        },
      }, { signal: lifecycle.signal });
      await context.registerTool({
        name: "create_snap_hub_event",
        title: "Create a Snap HUB event",
        description: "Create a new event gallery and generate its guest access details.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", minLength: 1 },
            eventType: { type: "string" },
            eventDate: { type: "string" },
            expectedGuests: { type: "number", minimum: 0, maximum: 100000 },
          },
          required: ["title"], additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input) {
          const value = input as { title?: string; eventType?: string; eventDate?: string; expectedGuests?: number };
          if (!value.title?.trim()) throw new Error("Event title is required");
          const response = await fetch("/api/albums", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Could not create event");
          await load();
          setSelectedId(data.album.id);
          return { id: data.album.id, title: data.album.title, guestId: data.album.guest_username, guestPassword: data.album.guest_password };
        },
      }, { signal: lifecycle.signal });
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [load]);
  const shareUrl = selected && origin ? `${origin}/g/${selected.access_token}` : "";
  useEffect(() => {
    if (!shareUrl) return setQrDataUrl("");
    void QRCode.toDataURL(shareUrl, { width: 320, margin: 1, color: { dark: "#4c1644", light: "#fff8fc" } }).then(setQrDataUrl);
  }, [shareUrl]);

  async function createAlbum(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const response = await fetch("/api/albums", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"), eventType: form.get("eventType"),
        eventDate: form.get("eventDate"), expectedGuests: Number(form.get("expectedGuests")),
      }),
    });
    const data = await response.json(); setBusy(false);
    if (!response.ok) return toast.error(data.error ?? "Could not create the event");
    setAlbums((current) => [data.album, ...current]); setSelectedId(data.album.id);
    event.currentTarget.reset(); toast.success("Event created — save the guest password now");
  }

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formElement = event.currentTarget;
    setBusy(true);
    const response = await fetch(`/api/albums/${selected.id}/photos`, { method: "POST", body: new FormData(formElement) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) return toast.error(data.error ?? "Upload failed");
    formElement.reset(); await load();
    toast.success(`${data.photos.length} item${data.photos.length === 1 ? "" : "s"} added`);
  }

  async function saveEvent() {
    if (!selected) return;
    const response = await fetch(`/api/albums/${selected.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: selected.description, theme: selected.theme, expectedGuests: selected.expected_guests }),
    });
    if (!response.ok) return toast.error("Could not save event settings");
    toast.success("Event look and details saved");
  }

  async function updateMedia(item: Media, patch: { caption?: string; isFeatured?: boolean }) {
    const response = await fetch(`/api/photos/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    if (!response.ok) return toast.error("Could not update this memory");
    const data = await response.json();
    setMedia((current) => current.map((value) => value.id === item.id ? { ...value, caption: data.caption, is_featured: data.is_featured } : value));
    toast.success(patch.isFeatured !== undefined ? (patch.isFeatured ? "Added to highlights" : "Removed from highlights") : "Caption saved");
  }

  async function removeMedia(id: string) {
    const response = await fetch(`/api/photos/${id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("Could not delete this memory");
    setMedia((current) => current.filter((item) => item.id !== id)); toast.success("Memory deleted");
  }

  function updateSelected(patch: Partial<Album>) {
    if (!selected) return;
    setAlbums((current) => current.map((album) => album.id === selected.id ? { ...album, ...patch } : album));
  }
  function copy(value: string, label: string) {
    void navigator.clipboard.writeText(value); toast.success(`${label} copied`);
  }

  return (
    <main className="hub-shell">
      <Toaster richColors position="top-right" />
      <aside className="hub-sidebar">
        <a className="hub-logo" href="/" aria-label="Snap HUB home">
          {/* eslint-disable-next-line @next/next/no-img-element */}<img src="/snap-hub-logo.png" alt="Snap HUB" />
        </a>
        <div className="side-label">Your events <span>{albums.length}</span></div>
        <nav className="event-nav">
          {albums.map((album) => (
            <button key={album.id} className={selected?.id === album.id ? "active" : ""} onClick={() => setSelectedId(album.id)}>
              <span className="event-emoji">{album.event_type === "Wedding" ? "💍" : album.event_type === "Birthday" ? "🎂" : album.event_type === "Corporate" ? "🏢" : "🎉"}</span>
              <span><strong>{album.title}</strong><small>{album.event_type} · {album.media_count} memories</small></span>
            </button>
          ))}
          {!albums.length && <p className="side-empty">Your first event will appear here.</p>}
        </nav>
        <form action="/api/admin/logout" method="post"><button className="hub-logout"><LogOut size={17} /> Sign out</button></form>
      </aside>

      <section className="hub-main">
        <header className="hub-topbar">
          <div><p className="pink-eyebrow">Host workspace</p><h1>{selected?.title ?? "Let’s make an event hub"}</h1></div>
          <span className="beta-pill"><Sparkles size={14} /> Testing stage</span>
        </header>

        <section className="hub-stats" aria-label="Snap HUB summary">
          <div><span className="stat-icon pink"><CalendarDays /></span><p>Events</p><strong>{albums.length}</strong></div>
          <div><span className="stat-icon violet"><ImagePlus /></span><p>Memories</p><strong>{totals.media}</strong></div>
          <div><span className="stat-icon blue"><Users /></span><p>Guest capacity</p><strong>{totals.guests.toLocaleString()}</strong></div>
          <div><span className="stat-icon orange"><Download /></span><p>Storage used</p><strong>{formatBytes(totals.storage)}</strong></div>
        </section>

        <div className="hub-content-grid">
          <section className="hub-card new-event-card">
            <div className="hub-card-title"><span><Plus /></span><div><h2>Create an event</h2><p>Weddings, birthdays, festivals, corporate events and more.</p></div></div>
            <form className="event-create-form" onSubmit={createAlbum}>
              <label>Event name<input name="title" required placeholder="e.g. Aditya’s 30th Birthday" /></label>
              <div className="form-pair">
                <label>Type<select name="eventType">{eventTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
                <label>Date<input name="eventDate" type="date" /></label>
              </div>
              <label>Expected guests<input name="expectedGuests" type="number" min="0" placeholder="250" /></label>
              <button disabled={busy}>Create event hub</button>
            </form>
          </section>

          {selected && <section className="hub-card qr-card">
            <div className="hub-card-title"><span><QrCode /></span><div><h2>Guest QR</h2><p>Guests can view and download. They cannot upload or delete.</p></div></div>
            <div className="qr-share-layout">
              {qrDataUrl && <div className="qr-box">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={qrDataUrl} alt={`QR code for ${selected.title}`} /></div>}
              <div className="share-details">
                <button onClick={() => copy(shareUrl, "Guest link")}><small>Guest link</small><strong>{shareUrl}</strong><Copy /></button>
                <button onClick={() => copy(selected.guest_username, "Guest ID")}><small>Guest ID</small><strong>{selected.guest_username}</strong><Copy /></button>
                {selected.guest_password && <button className="password-row" onClick={() => copy(selected.guest_password!, "Password")}><small>New password · save now</small><strong>{selected.guest_password}</strong><Copy /></button>}
              </div>
            </div>
            <div className="card-actions">
              <a href={shareUrl} target="_blank" rel="noreferrer"><ExternalLink /> Open guest view</a>
              {qrDataUrl && <a href={qrDataUrl} download={`${selected.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-qr.png`}><Download /> Download QR</a>}
            </div>
          </section>}

          {selected && <section className="hub-card customize-card">
            <div className="hub-card-title"><span><Palette /></span><div><h2>Customize the guest view</h2><p>Add a welcome message and choose an event mood.</p></div></div>
            <label className="wide-label">Welcome caption<textarea value={selected.description} onChange={(event) => updateSelected({ description: event.target.value })} placeholder="Write a warm note for everyone opening this gallery…" rows={3} /></label>
            <div className="theme-row">{themes.map((theme) => <button key={theme.id} className={selected.theme === theme.id ? "selected" : ""} onClick={() => updateSelected({ theme: theme.id })}><i style={{ background: theme.color }} />{theme.label}</button>)}</div>
            <button className="save-button" onClick={saveEvent}><Save /> Save customization</button>
          </section>}

          {selected && <section className="hub-card upload-card-new">
            <div className="hub-card-title"><span><Upload /></span><div><h2>Add memories</h2><p>Photos and videos up to 75 MB each.</p></div></div>
            <form onSubmit={upload} className="media-upload-form">
              <label><ImagePlus /><span><strong>Choose photos &amp; videos</strong><small>JPG, PNG, WebP, HEIC-ready exports, MP4 and MOV</small></span><input type="file" name="photos" accept="image/*,video/*" multiple required /></label>
              <button disabled={busy}>{busy ? "Uploading…" : "Upload memories"}</button>
            </form>
          </section>}
        </div>

        {selected && <section className="memories-section">
          <div className="memories-heading">
            <div><p className="pink-eyebrow">Event library</p><h2>{selectedMedia.length} memories</h2></div>
            <div className="magic-badge"><Sparkles /> Magic Find ready</div>
          </div>
          <div className="host-media-grid">
            {selectedMedia.map((item) => {
              const isVideo = item.content_type.startsWith("video/");
              return <article key={item.id} className="host-media-card">
                <div className="media-preview">
                  {isVideo ? <video src={`/api/photos/${item.id}`} controls preload="metadata" /> : <img src={`/api/photos/${item.id}`} alt={item.caption || item.filename} />}
                  <span className="media-kind">{isVideo ? <><Film /> Video</> : <><ImagePlus /> Photo</>}</span>
                  <button className={item.is_featured ? "feature-button active" : "feature-button"} onClick={() => updateMedia(item, { isFeatured: !item.is_featured })} aria-label="Toggle highlight"><Star /></button>
                </div>
                <div className="media-editor">
                  <input value={captionDrafts[item.id] ?? ""} onChange={(event) => setCaptionDrafts((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Add a caption…" />
                  <button onClick={() => updateMedia(item, { caption: captionDrafts[item.id] ?? "" })} aria-label="Save caption"><Save /></button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><button className="delete-media" aria-label={`Delete ${item.filename}`}><Trash2 /></button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this memory?</AlertDialogTitle><AlertDialogDescription>This permanently removes {item.filename} from the guest event gallery.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => removeMedia(item.id)}>Delete memory</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                  </AlertDialog>
                </div>
              </article>;
            })}
            {!selectedMedia.length && <div className="library-empty"><div>📸</div><h3>Fill this event with memories</h3><p>Upload the first photos or videos using the card above.</p></div>}
          </div>
        </section>}
      </section>
    </main>
  );
}
