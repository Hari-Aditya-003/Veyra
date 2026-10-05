import "server-only";

import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

const encoder = new TextEncoder();
const ADMIN_COOKIE = "veyra_admin";

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function hmac(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function verifySignedValue(value: string | undefined, expectedPrefix: string) {
  if (!value) return false;
  const [prefix, expires, signature] = value.split(".");
  if (prefix !== expectedPrefix || !expires || !signature) return false;
  if (Number(expires) < Date.now()) return false;
  return signature === (await hmac(`${prefix}.${expires}`));
}

export async function createAdminSession() {
  const expires = String(Date.now() + 1000 * 60 * 60 * 12);
  return `admin.${expires}.${await hmac(`admin.${expires}`)}`;
}

export async function isAdmin() {
  const jar = await cookies();
  return verifySignedValue(jar.get(ADMIN_COOKIE)?.value, "admin");
}

export function adminCookieName() {
  return ADMIN_COOKIE;
}

export async function createGallerySession(albumId: string) {
  const expires = String(Date.now() + 1000 * 60 * 60 * 24 * 14);
  return `${albumId}.${expires}.${await hmac(`${albumId}.${expires}`)}`;
}

export async function hasGallerySession(albumId: string) {
  const jar = await cookies();
  return verifySignedValue(jar.get(`veyra_gallery_${albumId}`)?.value, albumId);
}

export async function canViewGallery(album: { id: string; status: string; access_mode: string }) {
  if (await isAdmin()) return true;
  if (album.status !== "live") return false;
  if (album.access_mode === "link") return true;
  return hasGallerySession(album.id);
}

export async function hashGuestPassword(albumId: string, password: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${albumId}:${password}`),
  );
  return toHex(digest);
}

export function randomCode(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
