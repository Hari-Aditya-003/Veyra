import "server-only";

import { env } from "cloudflare:workers";

export type AlbumRecord = {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  description: string;
  tagline: string;
  location: string;
  theme: string;
  expected_guests: number;
  status: string;
  access_mode: string;
  allow_guest_uploads: number;
  moderation_mode: string;
  downloads_enabled: number;
  event_slug: string | null;
  cover_photo_id: string | null;
  slideshow_playing: number;
  slideshow_position: number;
  slideshow_updated_at: number;
  access_token: string;
  guest_username: string;
  guest_password_hash: string;
  drive_folder_id: string | null;
  drive_photos_folder_id: string | null;
  drive_videos_folder_id: string | null;
  drive_guest_uploads_folder_id: string | null;
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
  collection_id: string | null;
  collection_name?: string | null;
  moderation_status: string;
  uploader_name: string;
  source: string;
  size: number;
  created_at: number;
};

export async function getAlbumByToken(token: string) {
  return env.DB.prepare(
    `SELECT id, title, event_type, event_date, description, tagline, location, theme,
      expected_guests, status, access_mode, allow_guest_uploads, moderation_mode,
      downloads_enabled, event_slug, cover_photo_id, slideshow_playing,
      slideshow_position, slideshow_updated_at, access_token, guest_username,
      guest_password_hash, drive_folder_id, drive_photos_folder_id,
      drive_videos_folder_id, drive_guest_uploads_folder_id, created_at
     FROM albums WHERE access_token = ? LIMIT 1`,
  )
    .bind(token)
    .first<AlbumRecord>();
}

export async function getAlbumById(id: string) {
  return env.DB.prepare(
    `SELECT id, title, event_type, event_date, description, tagline, location, theme,
      expected_guests, status, access_mode, allow_guest_uploads, moderation_mode,
      downloads_enabled, event_slug, cover_photo_id, slideshow_playing,
      slideshow_position, slideshow_updated_at, access_token, guest_username,
      guest_password_hash, drive_folder_id, drive_photos_folder_id,
      drive_videos_folder_id, drive_guest_uploads_folder_id, created_at
     FROM albums WHERE id = ? LIMIT 1`,
  )
    .bind(id)
    .first<AlbumRecord>();
}

export async function getAlbumBySlug(slug: string) {
  return env.DB.prepare(
    `SELECT id, title, event_type, event_date, description, tagline, location, theme,
      expected_guests, status, access_mode, allow_guest_uploads, moderation_mode,
      downloads_enabled, event_slug, cover_photo_id, slideshow_playing,
      slideshow_position, slideshow_updated_at, access_token, guest_username,
      guest_password_hash, drive_folder_id, drive_photos_folder_id,
      drive_videos_folder_id, drive_guest_uploads_folder_id, created_at
     FROM albums WHERE event_slug = ? LIMIT 1`,
  )
    .bind(slug)
    .first<AlbumRecord>();
}

export async function getPhoto(id: string) {
  return env.DB.prepare(
    `SELECT id, album_id, object_key, filename, content_type, caption, is_featured,
      collection_id, moderation_status, uploader_name, source, size, created_at
     FROM photos WHERE id = ? LIMIT 1`,
  )
    .bind(id)
    .first<PhotoRecord>();
}
