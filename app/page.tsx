import { Heart, ImageUp, LockKeyhole, Play, QrCode, Sparkles } from "lucide-react";
import Link from "next/link";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="snap-home">
      <div className="emoji-sky" aria-hidden="true">
        <span>✨</span><span>🎉</span><span>🌸</span><span>📸</span><span>🪩</span><span>🥳</span><span>💃</span><span>🎂</span>
      </div>
      <header className="snap-header">
        <Link className="snap-brand" href="/" aria-label="Snap HUB home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/snap-hub-logo.png" alt="Snap HUB" />
        </Link>
        <div className="header-note"><span /> Built for every celebration</div>
      </header>

      <section className="snap-hero">
        <div className="snap-copy">
          <div className="launch-pill"><Sparkles size={15} /> One QR. Every memory.</div>
          <h1>Share the <em>whole event</em>, not a hundred links.</h1>
          <p>
            Photos, videos, guest uploads, favorites and live slideshows in one joyful gallery. Guests scan and relive it all — no app installation needed.
          </p>
          <div className="feature-pills">
            <span><QrCode size={17} /> QR guest access</span>
            <span><Play size={17} /> Slideshow</span>
            <span><ImageUp size={17} /> Guest uploads</span>
            <span><Heart size={17} /> Saved favorites</span>
            <span><Sparkles size={17} /> Magic Find beta</span>
          </div>
          <div className="event-strip" aria-label="Supported event types">
            <span>💍 Weddings</span><span>🎂 Birthdays</span><span>🎓 Graduations</span><span>🪔 Festivals</span><span>🎤 Live events</span><span>🏢 Corporate</span>
          </div>
        </div>

        <div className="host-column">
          <section className="pink-login-card" aria-labelledby="admin-login-title">
            <div className="card-top">
              <div><p className="pink-eyebrow">Host &amp; admin</p><h2 id="admin-login-title">Open your event hub</h2></div>
              <div className="round-icon"><LockKeyhole size={21} /></div>
            </div>
            <p>Create events, upload media, personalize the gallery and download its QR.</p>
            {error && <div className="login-error">{error === "too-many-attempts" ? "Too many sign-in attempts. Please wait a few minutes." : "That username or password is not correct."}</div>}
            <form action="/api/admin/login" method="post" className="pink-form">
              <label>Username<input name="username" autoComplete="username" required placeholder="Your username" /></label>
              <label>Password<input name="password" type="password" autoComplete="current-password" required placeholder="Your password" /></label>
              <button type="submit">Enter Snap HUB</button>
            </form>
            <div className="guest-note"><QrCode size={18} /><span><strong>Are you a guest?</strong> Scan the event QR shared by your host. You never need to install an app.</span></div>
          </section>
          <div className="ios-note"><span></span><div><strong>Designed for the host’s iPhone</strong><small>The admin workspace is touch-friendly and can be added to the Home Screen.</small></div></div>
        </div>
      </section>

      <footer className="snap-footer"><span>SNAP HUB · INDIA TO THE WORLD</span><span>Testing stage · Purchases are disabled</span></footer>
    </main>
  );
}
