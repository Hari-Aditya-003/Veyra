import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const albums = sqliteTable(
  "albums",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    eventType: text("event_type").notNull().default("Celebration"),
    eventDate: text("event_date").notNull().default(""),
    description: text("description").notNull().default(""),
    tagline: text("tagline").notNull().default(""),
    location: text("location").notNull().default(""),
    theme: text("theme").notNull().default("rose"),
    expectedGuests: integer("expected_guests").notNull().default(0),
    status: text("status").notNull().default("draft"),
    accessMode: text("access_mode").notNull().default("password"),
    allowGuestUploads: integer("allow_guest_uploads", { mode: "boolean" }).notNull().default(false),
    moderationMode: text("moderation_mode").notNull().default("manual"),
    downloadsEnabled: integer("downloads_enabled", { mode: "boolean" }).notNull().default(true),
    eventSlug: text("event_slug").unique(),
    coverPhotoId: text("cover_photo_id"),
    accessToken: text("access_token").notNull().unique(),
    guestUsername: text("guest_username").notNull(),
    guestPasswordHash: text("guest_password_hash").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("albums_token_idx").on(table.accessToken), index("albums_slug_idx").on(table.eventSlug)],
);

export const eventCollections = sqliteTable(
  "event_collections",
  {
    id: text("id").primaryKey(),
    albumId: text("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("collections_album_idx").on(table.albumId)],
);

export const photos = sqliteTable(
  "photos",
  {
    id: text("id").primaryKey(),
    albumId: text("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull().unique(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    caption: text("caption").notNull().default(""),
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
    collectionId: text("collection_id").references(() => eventCollections.id, { onDelete: "set null" }),
    moderationStatus: text("moderation_status").notNull().default("approved"),
    uploaderName: text("uploader_name").notNull().default("Host"),
    source: text("source").notNull().default("host"),
    size: integer("size").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("photos_album_idx").on(table.albumId),
    index("photos_album_moderation_idx").on(table.albumId, table.moderationStatus),
    index("photos_collection_idx").on(table.collectionId),
  ],
);
