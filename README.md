# Snap HUB

Snap HUB is a private event photo and video sharing platform. A host creates an event, uploads and moderates memories, then shares one QR code. Guests open the gallery in a browser, so they do not need to install an app.

The project is currently in testing stage. Purchases and paid plans are intentionally disabled.

## Live product

- Website: <https://snap-hub-events.mr-adityahari.chatgpt.site>
- Host workspace: <https://snap-hub-events.mr-adityahari.chatgpt.site/admin>
- iOS app: `ios/SnapHUB/SnapHUB.xcodeproj`
- Bundle identifier: `com.mradityahari.snaphub`

Host credentials are configured as deployment secrets and are never committed to the repository.

## What is included

- Host authentication with signed, HTTP-only sessions and login rate limiting
- Event creation for weddings, birthdays, festivals, graduations, corporate events, concerts, and other celebrations
- Private guest links, generated or rotated guest IDs/passwords, and downloadable QR codes
- Separate QR targets for the gallery, guest uploads, and live slideshow
- Photo and video uploads to object storage
- Collections, captions, event cover photos, themes, and welcome text
- Guest uploads with manual or instant moderation
- Favorites, highlights, search, photo/video filters, and original downloads
- Event status controls for draft, live, paused, and completed events
- Owner-only event deletion that removes database records and stored media objects
- Database-backed event activity for gallery views, guest uploads, and downloads
- Host-controlled live slideshow with previous, next, pause, resume, restart, and ambient music
- Responsive guest and host web experiences with installable PWA metadata
- Native SwiftUI iPhone/iPad host shell connected to the production workspace

## Architecture

- Next.js-compatible React application built with Vinext and Vite
- Cloudflare Worker runtime through OpenAI Sites
- D1 for event and media metadata
- R2 for original photo and video objects
- SwiftUI and `WKWebView` for the signed iOS host app

Google Drive and Google Photos are not connected in the testing build. Snap HUB currently stores uploads directly in its private R2 object storage. A Google connection requires a separate OAuth consent screen and Google API credentials before it can be enabled safely.

## Local web development

Requirements: Node.js 22.13 or newer and npm.

```bash
npm ci
cp .env.example .env
npm run dev
```

Set strong local values for `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET` in `.env`. The development server starts on <http://127.0.0.1:5173>.

Useful checks:

```bash
npm run lint
npm run build
```

Database migrations live in `drizzle/`. The Sites build workflow applies production migrations during deployment.

## iOS build and installation

Open `ios/SnapHUB/SnapHUB.xcodeproj` in Xcode. The project targets iOS/iPadOS 17 or newer and uses automatic signing for the configured Apple development team.

1. Connect and trust the iPhone or iPad.
2. Enable Developer Mode on the device.
3. Select the physical device as the run destination.
4. Build and run the `SnapHUB` scheme.

The app loads the production host workspace, keeps the authenticated web session in its default WebKit data store, and provides native Home, Events, Uploads, Live, and Settings navigation.

## Access model

- Only the host/admin session can create events, change settings, upload host media, edit captions, approve or reject guest uploads, set cover photos, or delete media.
- Guests receive access through an event QR/private link and, when enabled, an event-specific guest ID and password.
- Guests can view approved media, save local favorites, and download originals only when the host enables downloads.
- Paused, draft, and completed events do not expose their gallery to ordinary guests.

## Deployment

The repository is linked to OpenAI Sites by `.openai/hosting.json`. Production runtime values are managed as Sites environment variables and secrets; do not add credentials to source files.
