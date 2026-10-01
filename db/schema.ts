import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const albums = sqliteTable(
  "albums",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    eventType: text("event_type").notNull().default("Celebration"),
    eventDate: text("event_date").notNull().default(""),
    description: text("description").notNull().default(""),
    theme: text("theme").notNull().default("rose"),
    expectedGuests: integer("expected_guests").notNull().default(0),
    accessToken: text("access_token").notNull().unique(),
    guestUsername: text("guest_username").notNull(),
    guestPasswordHash: text("guest_password_hash").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("albums_token_idx").on(table.accessToken)],
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
    size: integer("size").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("photos_album_idx").on(table.albumId)],
);
