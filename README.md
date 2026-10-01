# Veyra — moments, beautifully together

A native SwiftUI iPhone/iPad product prototype for event photographers, wedding planners, and guests. Working brand: Veyra. Brand and domain availability have not been checked.

## Open and run

Open `Veyra.xcodeproj` in Xcode 26, select the **Veyra** scheme and an installed iPhone simulator, then choose **Product → Run** (⌘R). Deployment target: iOS 17. No package installation, backend account, or secret keys are required. To install on a physical iPhone, select your Apple development team in Signing & Capabilities and use a unique bundle identifier.

Use **Product → Test** (⌘U) for the unit and UI suites. Test launch argument `--uitesting` creates isolated sample storage. See `VERIFICATION.md` for the actual checks completed in this environment.

## Implemented in this build

- Ivory, forest-green, and champagne-gold design system, a custom V monogram/app icon, editorial typography, spring transitions, haptic tab feedback, and Reduce Motion support.
- Discover dashboard with sample celebrations, search, category filters, and event creation.
- Separate wedding functions: Mehendi, Haldi, Sangeet, Wedding, Reception, and custom functions.
- Native PhotosPicker import, local JPEG optimization, function galleries, full-screen paging, double-tap zoom, favourites, and the iOS share sheet.
- Generated event QR codes and same-device deep links (`veyra://event/<UUID>`); guests can paste a local event identifier to preview its gallery.
- Local persistence, import validation, metadata stripping, backup exclusion, file protection, readable storage failures, and explicit local-data erasure.
- Proposed Starter/Signature/Studio plan comparison and an illustrative revenue calculator. Plan selection stores a preference; no payment is collected.

The bundled imagery and event/guest counts are sample content. Imported images are downsampled to a maximum edge of 2,400 pixels; this is not archival storage for photographer originals. All local files are excluded from backup; deleting the app or local data can lose them.

## Production boundaries

This build is local-only. QR links do not publish galleries to another phone; there is no guest web app, camera QR scanner, selfie capture or identity matching, authentication, cloud upload, remote notification delivery, team authorization, payment entitlement, or live camera tethering. Privacy and notification switches are saved preferences only. A guest preview is not an access-control boundary.

Do not use the sample guest counts as live analytics. Photos are shared only when the user operates the native share sheet. There are no embedded credentials or network services.

## Code map

| File | Responsibility |
| --- | --- |
| `VeyraApp.swift` | Entry, tabs, discovery, deep-link validation |
| `DesignSystem.swift` | Palette, monogram, reusable controls, motion |
| `Models.swift` | Events/photos, persistence, validation, local import and deletion |
| `EventViews.swift` | Event creation, gallery, import, invitations, guest preview, viewer |
| `PlansView.swift` | Plan preview, revenue illustration, privacy preferences |
| `VeyraTests/StoreTests.swift` | Persistence, bounds, import integrity, traversal protection, erasure, corrupt data |
| `VeyraUITests/VeyraUITests.swift` | Browse flow and non-charging plan preview |

## Roadmap

1. **Local prototype (current):** complete native browsing, event creation, local imports, and commercial design exploration.
2. **Connected MVP:** API-backed identity and event memberships; expiring web invite tokens; guest browser gallery; private object storage, presigned upload/download URLs, upload retries and server-side quotas. Preserve originals separately from thumbnails.
3. **Consent-based discovery:** explicit per-event biometric consent and withdrawal; licensed face-embedding model or provider; background queues, isolated event indexes, quality thresholds, uncertain-match review, and end-to-end deletion of selfies/embeddings. Detecting a face alone is not identity matching.
4. **Live events:** desktop/camera ingestion, resumable uploads, idempotent processing, gallery updates via WebSockets/APNs, optional consented WhatsApp delivery, moderation and delivery logs.
5. **Commercial release:** server-verified StoreKit entitlements where required, quotas, real cost instrumentation, organizer billing, support, accessibility/device testing, privacy disclosures and legal review, TestFlight pilots, App Store submission.

Suggested connected stack: SwiftUI client, a TypeScript or Python API, PostgreSQL for event membership and audit records, private S3-compatible object storage/CDN, a durable queue for photo processing, and a separately deployed recognition worker. n8n can orchestrate provider notifications and noncritical operational workflows; core authorization and biometric retention must live in tested application services. See the companion system documentation for the seven workflow diagrams.
