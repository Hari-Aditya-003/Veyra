"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  CalendarDays, Check, CircleCheck, Clock3, Copy, Download, ExternalLink, Film,
  FolderPlus, ImagePlus, Link2, LogOut, MapPin, Palette, Play, Plus, QrCode,
  Save, Settings2, Sparkles, Star, Trash2, Upload, Users, Wallpaper, X,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Album = {
  id: string; title: string; event_type: string; event_date: string; description: string;
  tagline: string; location: string; theme: string; expected_guests: number;
  status: "draft" | "live" | "completed"; access_mode: "password" | "link";
  allow_guest_uploads: number; moderation_mode: "manual" | "instant"; downloads_enabled: number;
  event_slug: string | null; cover_photo_id: string | null; access_token: string;
  guest_username: string; guest_password?: string; created_at: number; media_count: number; storage_bytes: number;
};
type Media = {
  id: string; album_id: string; filename: string; content_type: string; caption: string;
  is_featured: number; collection_id: string | null; collection_name?: string | null;
  moderation_status: "pending" | "approved" | "rejected"; uploader_name: string; source: string;
  size: number; created_at: number;
};
type Collection = { id: string; album_id: string; name: string; description: string; created_at: number };
type QrMode = "gallery" | "upload" | "slideshow";

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
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrMode, setQrMode] = useState<QrMode>("gallery");
  const [busy, setBusy] = useState(false);
  const [captionDrafts, setCaptionDrafts] = useState<Record<string, string>>({});

  const selected = albums.find((album) => album.id === selectedId) ?? albums[0];
  const selectedMedia = useMemo(() => media.filter((item) => item.album_id === selected?.id), [media, selected]);
  const selectedCollections = useMemo(() => collections.filter((item) => item.album_id === selected?.id), [collections, selected]);
  const pendingCount = selectedMedia.filter((item) => item.moderation_status === "pending").length;
  const totals = useMemo(() => ({
    media: albums.reduce((sum, album) => sum + Number(album.media_count), 0),
    storage: albums.reduce((sum, album) => sum + Number(album.storage_bytes), 0),
    guests: albums.reduce((sum, album) => sum + Number(album.expected_guests), 0),
  }), [albums]);

  const load = useCallback(async () => {
    const response = await fetch("/api/albums", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setAlbums(data.albums); setMedia(data.photos); setCollections(data.collections);
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
        name: "list_snap_hub_events", title: "List Snap HUB events",
        description: "Read the host's Snap HUB events, publish status, and media counts.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        async execute() {
          const response = await fetch("/api/albums", { cache: "no-store" });
          if (!response.ok) throw new Error("Could not load events");
          const data = await response.json();
          return { events: data.albums.map((album: Album) => ({ id: album.id, title: album.title, eventType: album.event_type, status: album.status, mediaCount: album.media_count })) };
        },
      }, { signal: lifecycle.signal });
      await context.registerTool({
        name: "create_snap_hub_event", title: "Create a Snap HUB event",
        description: "Create a draft event gallery with secure guest access and a share link.",
        inputSchema: {
          type: "object", properties: {
            title: { type: "string", minLength: 1 }, eventType: { type: "string" },
            eventDate: { type: "string" }, location: { type: "string" },
            expectedGuests: { type: "number", minimum: 0, maximum: 100000 },
          }, required: ["title"], additionalProperties: false,
        }, annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input) {
          const value = input as { title?: string; eventType?: string; eventDate?: string; location?: string; expectedGuests?: number };
          if (!value.title?.trim()) throw new Error("Event title is required");
          const response = await fetch("/api/albums", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Could not create event");
          await load(); setSelectedId(data.album.id);
          return { id: data.album.id, title: data.album.title, status: data.album.status, guestId: data.album.guest_username, guestPassword: data.album.guest_password };
        },
      }, { signal: lifecycle.signal });
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [load]);

  const shareUrl = selected && origin ? `${origin}${selected.event_slug ? `/e/${selected.event_slug}` : `/g/${selected.access_token}`}` : "";
  const uploadUrl = shareUrl ? `${shareUrl}?upload=1` : "";
  const slideshowUrl = selected && origin ? `${origin}/g/${selected.access_token}/slideshow` : "";
  const qrTarget = qrMode === "upload" ? uploadUrl : qrMode === "slideshow" ? slideshowUrl : shareUrl;
  useEffect(() => {
    if (!qrTarget) return setQrDataUrl("");
    void QRCode.toDataURL(qrTarget, { width: 360, margin: 1, color: { dark: "#5a1749", light: "#fff8fc" } }).then(setQrDataUrl);
  }, [qrTarget]);

  async function createAlbum(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true);
    const response = await fetch("/api/albums", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      title: form.get("title"), eventType: form.get("eventType"), eventDate: form.get("eventDate"),
      location: form.get("location"), tagline: form.get("tagline"), expectedGuests: Number(form.get("expectedGuests")),
    }) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) return toast.error(data.error ?? "Could not create the event");
    setAlbums((current) => [data.album, ...current]); setCollections((current) => [...current, data.collection]);
    setSelectedId(data.album.id); event.currentTarget.reset();
    toast.success("Draft created — save the guest password, then publish when ready");
  }

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return; const formElement = event.currentTarget; setBusy(true);
    const response = await fetch(`/api/albums/${selected.id}/photos`, { method: "POST", body: new FormData(formElement) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) return toast.error(data.error ?? "Upload failed");
    formElement.reset(); await load(); toast.success(`${data.photos.length} item${data.photos.length === 1 ? "" : "s"} added`);
  }

  async function saveEvent(patch?: Partial<Album>) {
    if (!selected) return;
    const next = { ...selected, ...patch };
    const response = await fetch(`/api/albums/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      description: next.description, tagline: next.tagline, location: next.location, theme: next.theme,
      expectedGuests: next.expected_guests, status: next.status, accessMode: next.access_mode,
      allowGuestUploads: Boolean(next.allow_guest_uploads), moderationMode: next.moderation_mode,
      downloadsEnabled: Boolean(next.downloads_enabled), coverPhotoId: next.cover_photo_id,
    }) });
    const data = await response.json();
    if (!response.ok) return toast.error(data.error ?? "Could not save event settings");
    updateSelected({ ...patch, ...data }); toast.success(next.status === "live" && selected.status !== "live" ? "Event published — the QR is live" : "Event settings saved");
  }

  async function createCollection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return; const form = event.currentTarget; const data = new FormData(form);
    const response = await fetch(`/api/albums/${selected.id}/collections`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name") }) });
    const result = await response.json(); if (!response.ok) return toast.error(result.error ?? "Could not create album");
    setCollections((current) => [...current, result.collection]); form.reset(); toast.success("Album added");
  }

  async function updateMedia(item: Media, patch: { caption?: string; isFeatured?: boolean; moderationStatus?: string }) {
    const response = await fetch(`/api/photos/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!response.ok) return toast.error("Could not update this memory");
    const data = await response.json();
    setMedia((current) => current.map((value) => value.id === item.id ? { ...value, caption: data.caption, is_featured: data.is_featured, moderation_status: data.moderation_status } : value));
    toast.success(patch.moderationStatus === "approved" ? "Memory approved" : patch.moderationStatus === "rejected" ? "Memory hidden" : patch.isFeatured !== undefined ? (patch.isFeatured ? "Added to highlights" : "Removed from highlights") : "Caption saved");
  }
  async function setCover(item: Media) { if (!selected) return; await saveEvent({ cover_photo_id: item.id }); }
  async function removeMedia(id: string) {
    const response = await fetch(`/api/photos/${id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("Could not delete this memory");
    setMedia((current) => current.filter((item) => item.id !== id)); toast.success("Memory deleted");
  }
  function updateSelected(patch: Partial<Album>) {
    if (!selected) return;
    setAlbums((current) => current.map((album) => album.id === selected.id ? { ...album, ...patch } : album));
  }
  function copy(value: string, label: string) { void navigator.clipboard.writeText(value); toast.success(`${label} copied`); }

  return (
    <main className="hub-shell">
      <Toaster richColors position="top-right" />
      <aside className="hub-sidebar">
        <a className="hub-logo" href="/" aria-label="Snap HUB home"><img src="/snap-hub-logo.png" alt="Snap HUB" /></a>
        <div className="side-label">Your events <span>{albums.length}</span></div>
        <nav className="event-nav">{albums.map((album) => <button key={album.id} className={selected?.id === album.id ? "active" : ""} onClick={() => setSelectedId(album.id)}><span className="event-emoji">{album.event_type === "Wedding" ? "💍" : album.event_type === "Birthday" ? "🎂" : album.event_type === "Corporate" ? "🏢" : "🎉"}</span><span><strong>{album.title}</strong><small>{album.status} · {album.media_count} memories</small></span></button>)}{!albums.length && <p className="side-empty">Your first event will appear here.</p>}</nav>
        <form action="/api/admin/logout" method="post"><button className="hub-logout"><LogOut size={17} /> Sign out</button></form>
      </aside>

      <section className="hub-main">
        <header className="hub-topbar"><div><p className="pink-eyebrow">Host control centre</p><h1>{selected?.title ?? "Let’s make an event hub"}</h1></div><div className="topbar-status"><span className={`status-pill ${selected?.status ?? "draft"}`}>{selected?.status ?? "Testing"}</span><span className="beta-pill"><Sparkles size={14} /> Testing stage</span></div></header>

        <section className="hub-stats" aria-label="Snap HUB summary">
          <div><span className="stat-icon pink"><CalendarDays /></span><p>Events</p><strong>{albums.length}</strong></div>
          <div><span className="stat-icon violet"><ImagePlus /></span><p>Memories</p><strong>{totals.media}</strong></div>
          <div><span className="stat-icon blue"><Users /></span><p>Guest capacity</p><strong>{totals.guests.toLocaleString()}</strong></div>
          <div><span className="stat-icon orange"><Download /></span><p>Cloud storage</p><strong>{formatBytes(totals.storage)}</strong></div>
        </section>

        <div className="hub-content-grid">
          <section className="hub-card new-event-card">
            <div className="hub-card-title"><span><Plus /></span><div><h2>Create an event</h2><p>Start with the essentials. New events stay private until you publish.</p></div></div>
            <form className="event-create-form" onSubmit={createAlbum}>
              <label>Event name<input name="title" required placeholder="e.g. Aditya’s 30th Birthday" /></label>
              <div className="form-pair"><label>Type<select name="eventType">{eventTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label>Date<input name="eventDate" type="date" /></label></div>
              <label>Location<input name="location" placeholder="Venue or city" /></label>
              <label>Short tagline<input name="tagline" placeholder="The beginning of forever" /></label>
              <label>Expected guests<input name="expectedGuests" type="number" min="0" placeholder="250" /></label>
              <button disabled={busy}>Create draft event</button>
            </form>
          </section>

          {selected && <section className="hub-card qr-card">
            <div className="hub-card-title"><span><QrCode /></span><div><h2>Share &amp; QR centre</h2><p>Make a QR for the gallery, guest uploads, or the live screen.</p></div></div>
            <div className="qr-tabs"><button className={qrMode === "gallery" ? "active" : ""} onClick={() => setQrMode("gallery")}>Gallery</button><button className={qrMode === "upload" ? "active" : ""} onClick={() => setQrMode("upload")}>Upload</button><button className={qrMode === "slideshow" ? "active" : ""} onClick={() => setQrMode("slideshow")}>Slideshow</button></div>
            <div className="qr-share-layout">{qrDataUrl && <div className="qr-box"><img src={qrDataUrl} alt={`QR code for ${selected.title}`} /></div>}<div className="share-details"><button onClick={() => copy(qrTarget, "Share link")}><small>{qrMode} link</small><strong>{qrTarget}</strong><Copy /></button>{selected.access_mode === "password" && <button onClick={() => copy(selected.guest_username, "Guest ID")}><small>Guest ID</small><strong>{selected.guest_username}</strong><Copy /></button>}{selected.guest_password && <button className="password-row" onClick={() => copy(selected.guest_password!, "Password")}><small>New password · save now</small><strong>{selected.guest_password}</strong><Copy /></button>}</div></div>
            <div className="card-actions"><a href={qrTarget} target="_blank" rel="noreferrer"><ExternalLink /> Open {qrMode}</a>{qrDataUrl && <a href={qrDataUrl} download={`${selected.event_slug ?? "snap-hub"}-${qrMode}-qr.png`}><Download /> Download QR</a>}</div>
            {selected.status !== "live" && <div className="draft-warning"><Clock3 /> Guests see a waiting screen until this event is published.</div>}
          </section>}

          {selected && <section className="hub-card customize-card">
            <div className="hub-card-title"><span><Palette /></span><div><h2>Event look &amp; story</h2><p>Personalize the page guests see after scanning.</p></div></div>
            <label className="wide-label">Tagline<input value={selected.tagline} onChange={(event) => updateSelected({ tagline: event.target.value })} placeholder="A short event line" /></label>
            <label className="wide-label"><MapPin /> Location<input value={selected.location} onChange={(event) => updateSelected({ location: event.target.value })} placeholder="Venue or city" /></label>
            <label className="wide-label">Welcome caption<textarea value={selected.description} onChange={(event) => updateSelected({ description: event.target.value })} placeholder="Write a warm note for everyone opening this gallery…" rows={3} /></label>
            <div className="theme-row">{themes.map((theme) => <button key={theme.id} className={selected.theme === theme.id ? "selected" : ""} onClick={() => updateSelected({ theme: theme.id })}><i style={{ background: theme.color }} />{theme.label}</button>)}</div>
            <button className="save-button" onClick={() => void saveEvent()}><Save /> Save design</button>
          </section>}

          {selected && <section className="hub-card settings-card">
            <div className="hub-card-title"><span><Settings2 /></span><div><h2>Access &amp; permissions</h2><p>Control when guests enter and what they can do.</p></div></div>
            <div className="settings-grid">
              <label>Event status<select value={selected.status} onChange={(event) => updateSelected({ status: event.target.value as Album["status"] })}><option value="draft">Draft</option><option value="live">Live</option><option value="completed">Completed</option></select></label>
              <label>Guest access<select value={selected.access_mode} onChange={(event) => updateSelected({ access_mode: event.target.value as Album["access_mode"] })}><option value="password">QR + password</option><option value="link">QR or private link</option></select></label>
              <label>Guest moderation<select value={selected.moderation_mode} onChange={(event) => updateSelected({ moderation_mode: event.target.value as Album["moderation_mode"] })}><option value="manual">Host approves first</option><option value="instant">Publish instantly</option></select></label>
            </div>
            <div className="permission-list"><label><input type="checkbox" checked={Boolean(selected.allow_guest_uploads)} onChange={(event) => updateSelected({ allow_guest_uploads: Number(event.target.checked) })} /><span><strong>Allow guest uploads</strong><small>Guests can add photos and videos from their browser.</small></span></label><label><input type="checkbox" checked={Boolean(selected.downloads_enabled)} onChange={(event) => updateSelected({ downloads_enabled: Number(event.target.checked) })} /><span><strong>Allow downloads</strong><small>Guests can save original event media.</small></span></label></div>
            <button className="save-button publish-button" onClick={() => void saveEvent()}>{selected.status === "live" ? <><CircleCheck /> Save live event</> : <><Save /> Save permissions</>}</button>
          </section>}

          {selected && <section className="hub-card upload-card-new">
            <div className="hub-card-title"><span><Upload /></span><div><h2>Add memories</h2><p>Upload photos and videos into a named album.</p></div></div>
            <form onSubmit={upload} className="media-upload-form expanded-upload">
              <div className="upload-meta"><select name="collectionId">{selectedCollections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select><input name="caption" placeholder="Optional caption for this upload" /></div>
              <label><ImagePlus /><span><strong>Choose photos &amp; videos</strong><small>JPG, PNG, WebP, MP4 and MOV · up to 75 MB each</small></span><input type="file" name="photos" accept="image/*,video/*" multiple required /></label>
              <button disabled={busy}>{busy ? "Uploading…" : "Upload memories"}</button>
            </form>
            <form className="collection-form" onSubmit={createCollection}><input name="name" placeholder="New album name — e.g. Reception" required /><button><FolderPlus /> Add album</button></form>
            <div className="collection-chips">{selectedCollections.map((collection) => <span key={collection.id}>{collection.name}</span>)}</div>
          </section>}

          {selected && <section className="hub-card storage-card"><div className="hub-card-title"><span><Link2 /></span><div><h2>Storage connection</h2><p>Snap HUB cloud storage is active for this testing release.</p></div></div><div className="storage-health"><span><Check /> Connected</span><strong>{formatBytes(selected.storage_bytes)} · {selected.media_count} files</strong></div><div className="future-integration"><Sparkles /><span><strong>Google Photos connection</strong><small>Reserved for the OAuth integration phase; no placeholder account is connected.</small></span></div></section>}
        </div>

        {selected && <section className="memories-section">
          <div className="memories-heading"><div><p className="pink-eyebrow">Event library</p><h2>{selectedMedia.length} memories</h2></div><div className="moderation-summary">{pendingCount > 0 ? <span><Clock3 /> {pendingCount} awaiting approval</span> : <span className="all-approved"><Check /> Moderation clear</span>}</div></div>
          <div className="host-media-grid">
            {selectedMedia.map((item) => { const isVideo = item.content_type.startsWith("video/"); return <article key={item.id} className={`host-media-card status-${item.moderation_status}`}>
              <div className="media-preview">{isVideo ? <video src={`/api/photos/${item.id}`} controls preload="metadata" /> : <img src={`/api/photos/${item.id}`} alt={item.caption || item.filename} />}<span className="media-kind">{isVideo ? <><Film /> Video</> : <><ImagePlus /> Photo</>} · {item.collection_name ?? "Main gallery"}</span><span className={`moderation-badge ${item.moderation_status}`}>{item.moderation_status}</span><button className={item.is_featured ? "feature-button active" : "feature-button"} onClick={() => updateMedia(item, { isFeatured: !item.is_featured })} aria-label="Toggle highlight"><Star /></button></div>
              <div className="uploader-line">{item.source === "guest" ? `From ${item.uploader_name}` : "Host upload"}{selected.cover_photo_id === item.id && <span><Wallpaper /> Event cover</span>}</div>
              {item.moderation_status === "pending" && <div className="moderation-actions"><button onClick={() => updateMedia(item, { moderationStatus: "approved" })}><Check /> Approve</button><button onClick={() => updateMedia(item, { moderationStatus: "rejected" })}><X /> Hide</button></div>}
              <div className="media-editor"><input value={captionDrafts[item.id] ?? ""} onChange={(event) => setCaptionDrafts((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Add a caption…" /><button onClick={() => updateMedia(item, { caption: captionDrafts[item.id] ?? "" })} aria-label="Save caption"><Save /></button>{!isVideo && <button onClick={() => void setCover(item)} aria-label="Use as event cover"><Wallpaper /></button>}<AlertDialog><AlertDialogTrigger asChild><button className="delete-media" aria-label={`Delete ${item.filename}`}><Trash2 /></button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this memory?</AlertDialogTitle><AlertDialogDescription>This permanently removes {item.filename} from the event gallery.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => removeMedia(item.id)}>Delete memory</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
            </article>; })}
            {!selectedMedia.length && <div className="library-empty"><div>📸</div><h3>Fill this event with memories</h3><p>Upload the first photos or videos using the card above.</p></div>}
          </div>
        </section>}
      </section>
    </main>
  );
}
