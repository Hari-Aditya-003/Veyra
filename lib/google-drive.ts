import "server-only";

import { env } from "cloudflare:workers";
import type { AlbumRecord } from "@/lib/data";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const CONNECTION_ID = "primary";

type DriveConnectionRow = {
  encrypted_refresh_token: string;
  email: string;
  root_folder_id: string;
  created_at: number;
  updated_at: number;
};

type DriveTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

type DriveFile = { id: string; name?: string; size?: string; mimeType?: string };

let accessTokenCache: { token: string; expiresAt: number; connectionUpdatedAt: number } | null = null;

export class GoogleDriveError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = "GoogleDriveError";
  }
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey() {
  const material = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`snap-hub-google-drive:${env.SESSION_SECRET}`),
  );
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptRefreshToken(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), encoder.encode(token));
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
}

async function decryptRefreshToken(value: string) {
  const [ivValue, encryptedValue] = value.split(".");
  if (!ivValue || !encryptedValue) throw new GoogleDriveError("Google Drive connection is invalid.", 500);
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlToBytes(ivValue) },
      await encryptionKey(),
      base64UrlToBytes(encryptedValue),
    );
    return decoder.decode(decrypted);
  } catch {
    throw new GoogleDriveError("Google Drive must be connected again.", 503);
  }
}

async function oauthSigningKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createGoogleOAuthState() {
  const nonce = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(18)));
  const expires = String(Date.now() + 10 * 60 * 1000);
  const value = `drive.${nonce}.${expires}`;
  const signature = await crypto.subtle.sign("HMAC", await oauthSigningKey(), encoder.encode(value));
  return `${value}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyGoogleOAuthState(value: string | undefined) {
  if (!value) return false;
  const [prefix, nonce, expires, signature] = value.split(".");
  if (prefix !== "drive" || !nonce || !expires || !signature || Number(expires) < Date.now()) return false;
  return crypto.subtle.verify(
    "HMAC",
    await oauthSigningKey(),
    base64UrlToBytes(signature),
    encoder.encode(`${prefix}.${nonce}.${expires}`),
  );
}

export function googleDriveConfigured() {
  return Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim());
}

export function googleOAuthRedirectUri(origin: string) {
  return `${origin}/api/admin/google-drive/callback`;
}

export function googleOAuthAuthorizationUrl(origin: string, state: string) {
  if (!googleDriveConfigured()) throw new GoogleDriveError("Google Drive OAuth is not configured.", 503);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: googleOAuthRedirectUri(origin),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: `openid email ${DRIVE_SCOPE}`,
    state,
  }).toString();
  return url.toString();
}

export async function exchangeGoogleOAuthCode(code: string, origin: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: googleOAuthRedirectUri(origin),
    }),
  });
  const token = await response.json() as DriveTokenResponse;
  if (!response.ok || !token.access_token || !token.refresh_token) {
    throw new GoogleDriveError(token.error_description || "Google Drive did not return offline access.", 502);
  }
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = await profileResponse.json() as { email?: string };
  if (!profileResponse.ok || !profile.email) throw new GoogleDriveError("Could not read the connected Google account.", 502);
  return { accessToken: token.access_token, refreshToken: token.refresh_token, email: profile.email };
}

async function getConnectionRow() {
  return env.DB.prepare(
    "SELECT encrypted_refresh_token, email, root_folder_id, created_at, updated_at FROM google_drive_connections WHERE id = ? LIMIT 1",
  ).bind(CONNECTION_ID).first<DriveConnectionRow>();
}

async function accessToken() {
  if (!googleDriveConfigured()) throw new GoogleDriveError("Google Drive OAuth is not configured.", 503);
  const connection = await getConnectionRow();
  if (!connection) throw new GoogleDriveError("Connect Google Drive from the host dashboard first.", 503);
  if (accessTokenCache && accessTokenCache.connectionUpdatedAt === connection.updated_at && accessTokenCache.expiresAt > Date.now() + 60_000) {
    return accessTokenCache.token;
  }
  const refreshToken = await decryptRefreshToken(connection.encrypted_refresh_token);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const token = await response.json() as DriveTokenResponse;
  if (!response.ok || !token.access_token) {
    throw new GoogleDriveError("Google Drive authorization expired. Connect it again from the host dashboard.", 503);
  }
  accessTokenCache = {
    token: token.access_token,
    expiresAt: Date.now() + Math.max(300, token.expires_in ?? 3600) * 1000,
    connectionUpdatedAt: connection.updated_at,
  };
  return token.access_token;
}

async function driveJson<T>(url: string, init: RequestInit = {}, suppliedAccessToken?: string) {
  const token = suppliedAccessToken ?? await accessToken();
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    const message = body?.error?.message || `Google Drive request failed with ${response.status}.`;
    throw new GoogleDriveError(message, response.status === 404 ? 404 : 502);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function createFolder(name: string, parentId: string | null, appProperties: Record<string, string>, token?: string) {
  return driveJson<DriveFile>("https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME_TYPE,
      ...(parentId ? { parents: [parentId] } : {}),
      appProperties,
    }),
  }, token);
}

async function findOrCreateRootFolder(token: string) {
  const query = "appProperties has { key='snapHubRoot' and value='true' } and trashed=false";
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.search = new URLSearchParams({ q: query, spaces: "drive", pageSize: "1", fields: "files(id,name)" }).toString();
  const result = await driveJson<{ files?: DriveFile[] }>(url.toString(), {}, token);
  const existing = result.files?.[0];
  if (existing?.id) return existing.id;
  const created = await createFolder("Snap HUB", null, { snapHubRoot: "true" }, token);
  if (!created.id) throw new GoogleDriveError("Google Drive did not create the Snap HUB folder.");
  return created.id;
}

export async function saveGoogleDriveConnection(refreshToken: string, accessTokenValue: string, email: string) {
  const rootFolderId = await findOrCreateRootFolder(accessTokenValue);
  const encryptedRefreshToken = await encryptRefreshToken(refreshToken);
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO google_drive_connections (id, encrypted_refresh_token, email, root_folder_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET encrypted_refresh_token = excluded.encrypted_refresh_token,
       email = excluded.email, root_folder_id = excluded.root_folder_id, updated_at = excluded.updated_at`,
  ).bind(CONNECTION_ID, encryptedRefreshToken, email, rootFolderId, now, now).run();
  accessTokenCache = { token: accessTokenValue, expiresAt: now + 50 * 60 * 1000, connectionUpdatedAt: now };
  return { email, rootFolderId, rootFolderUrl: driveFolderUrl(rootFolderId) };
}

export function driveFolderUrl(folderId: string) {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`;
}

export async function getGoogleDriveStatus() {
  const connection = await getConnectionRow();
  return {
    configured: googleDriveConfigured(),
    connected: Boolean(connection),
    email: connection?.email ?? null,
    rootFolderId: connection?.root_folder_id ?? null,
    rootFolderUrl: connection?.root_folder_id ? driveFolderUrl(connection.root_folder_id) : null,
  };
}

export async function deleteDriveFile(fileId: string | null | undefined) {
  if (!fileId) return;
  const token = await accessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) throw new GoogleDriveError("Could not remove the item from Google Drive.");
}

export type EventDriveFolders = {
  eventFolderId: string;
  photosFolderId: string;
  videosFolderId: string;
  guestUploadsFolderId: string;
  folderUrl: string;
};

export async function createEventDriveFolders(albumId: string, title: string): Promise<EventDriveFolders> {
  const connection = await getConnectionRow();
  if (!connection) throw new GoogleDriveError("Connect Google Drive from the host dashboard first.", 503);
  const eventFolder = await createFolder(title.slice(0, 180), connection.root_folder_id, { snapHubEventId: albumId, snapHubType: "event" });
  if (!eventFolder.id) throw new GoogleDriveError("Could not create the event folder in Google Drive.");
  try {
    const [photos, videos, guestUploads] = await Promise.all([
      createFolder("Photos", eventFolder.id, { snapHubEventId: albumId, snapHubCategory: "photos" }),
      createFolder("Videos", eventFolder.id, { snapHubEventId: albumId, snapHubCategory: "videos" }),
      createFolder("Guest Uploads", eventFolder.id, { snapHubEventId: albumId, snapHubCategory: "guest-uploads" }),
      createFolder("Highlights", eventFolder.id, { snapHubEventId: albumId, snapHubCategory: "highlights" }),
    ]);
    if (!photos.id || !videos.id || !guestUploads.id) throw new GoogleDriveError("Could not create all event folders in Google Drive.");
    return {
      eventFolderId: eventFolder.id,
      photosFolderId: photos.id,
      videosFolderId: videos.id,
      guestUploadsFolderId: guestUploads.id,
      folderUrl: driveFolderUrl(eventFolder.id),
    };
  } catch (error) {
    await deleteDriveFile(eventFolder.id).catch(() => undefined);
    throw error;
  }
}

export async function ensureEventDriveFolders(album: AlbumRecord) {
  if (album.drive_folder_id && album.drive_photos_folder_id && album.drive_videos_folder_id && album.drive_guest_uploads_folder_id) {
    return {
      eventFolderId: album.drive_folder_id,
      photosFolderId: album.drive_photos_folder_id,
      videosFolderId: album.drive_videos_folder_id,
      guestUploadsFolderId: album.drive_guest_uploads_folder_id,
      folderUrl: driveFolderUrl(album.drive_folder_id),
    } satisfies EventDriveFolders;
  }
  const folders = await createEventDriveFolders(album.id, album.title);
  try {
    await env.DB.prepare(
      `UPDATE albums SET drive_folder_id = ?, drive_photos_folder_id = ?, drive_videos_folder_id = ?,
        drive_guest_uploads_folder_id = ? WHERE id = ?`,
    ).bind(folders.eventFolderId, folders.photosFolderId, folders.videosFolderId, folders.guestUploadsFolderId, album.id).run();
  } catch {
    await deleteDriveFile(folders.eventFolderId).catch(() => undefined);
    throw new GoogleDriveError("The Google Drive folders were created, but the event could not be updated.", 500);
  }
  return folders;
}

function safeDriveFilename(filename: string) {
  return filename.replace(/[\\/\u0000-\u001f]/gu, "-").trim().slice(0, 180) || "Snap HUB memory";
}

export async function uploadDriveMedia(file: File, folderId: string, metadata: { albumId: string; photoId: string; source: string }) {
  const token = await accessToken();
  const initiate = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,mimeType", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": file.type,
      "X-Upload-Content-Length": String(file.size),
    },
    body: JSON.stringify({
      name: safeDriveFilename(file.name),
      mimeType: file.type,
      parents: [folderId],
      appProperties: {
        snapHubAlbumId: metadata.albumId,
        snapHubPhotoId: metadata.photoId,
        snapHubSource: metadata.source,
      },
    }),
  });
  const location = initiate.headers.get("location");
  if (!initiate.ok || !location) throw new GoogleDriveError("Could not start the Google Drive upload.");
  const uploaded = await fetch(location, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": file.type,
      "Content-Length": String(file.size),
    },
    body: file,
  });
  if (!uploaded.ok) throw new GoogleDriveError("Google Drive did not finish the upload.");
  const result = await uploaded.json() as DriveFile;
  if (!result.id) throw new GoogleDriveError("Google Drive did not return the uploaded file.");
  return result;
}

export async function driveMediaResponse(fileId: string, request: Request, options: {
  contentType: string;
  filename: string;
  download?: boolean;
  cacheControl?: string;
}) {
  const token = await accessToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const range = request.headers.get("range");
  if (range) headers.Range = range;
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { headers });
  if (response.status === 404) return new Response("Not found", { status: 404 });
  if (!response.ok && response.status !== 206) throw new GoogleDriveError("Could not read this item from Google Drive.");
  const outgoing = new Headers({
    "Content-Type": response.headers.get("content-type") || options.contentType,
    "Cache-Control": options.cacheControl ?? "private, max-age=3600",
    "Accept-Ranges": response.headers.get("accept-ranges") || "bytes",
    "Content-Disposition": `${options.download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(options.filename)}`,
  });
  for (const name of ["content-length", "content-range", "etag", "last-modified"]) {
    const value = response.headers.get(name);
    if (value) outgoing.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers: outgoing });
}
