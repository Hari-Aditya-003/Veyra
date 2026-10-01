import "server-only";

import { env } from "cloudflare:workers";

export type AlbumRecord = {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  description: string;
  theme: string;
  expected_guests: number;
  access_token: string;
  guest_username: string;
  guest_password_hash: string;
  created_at: number;
};

export type PhotoRecord = {
  id: string;
  album_id: string;
  object_key: string;
  filename: string;
  content_type: string;
  caption: string;
  is_featured: number;
  size: number;
  created_at: number;
};

export async function getAlbumByToken(token: string) {
  return env.DB.prepare(
    "SELECT id, title, event_type, event_date, description, theme, expected_guests, access_token, guest_username, guest_password_hash, created_at FROM albums WHERE access_token = ? LIMIT 1",
  )
    .bind(token)
    .first<AlbumRecord>();
}

export async function getAlbumById(id: string) {
  return env.DB.prepare(
    "SELECT id, title, event_type, event_date, description, theme, expected_guests, access_token, guest_username, guest_password_hash, created_at FROM albums WHERE id = ? LIMIT 1",
  )
    .bind(id)
    .first<AlbumRecord>();
}

export async function getPhoto(id: string) {
  return env.DB.prepare(
    "SELECT id, album_id, object_key, filename, content_type, caption, is_featured, size, created_at FROM photos WHERE id = ? LIMIT 1",
  )
    .bind(id)
    .first<PhotoRecord>();
}
