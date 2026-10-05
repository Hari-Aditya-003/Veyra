CREATE TABLE `event_collections` (
	`id` text PRIMARY KEY NOT NULL,
	`album_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collections_album_idx` ON `event_collections` (`album_id`);--> statement-breakpoint
ALTER TABLE `albums` ADD `tagline` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `albums` ADD `location` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `albums` ADD `status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `albums` ADD `access_mode` text DEFAULT 'password' NOT NULL;--> statement-breakpoint
ALTER TABLE `albums` ADD `allow_guest_uploads` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `albums` ADD `moderation_mode` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `albums` ADD `downloads_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `albums` ADD `event_slug` text;--> statement-breakpoint
ALTER TABLE `albums` ADD `cover_photo_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `albums_event_slug_unique` ON `albums` (`event_slug`);--> statement-breakpoint
CREATE INDEX `albums_slug_idx` ON `albums` (`event_slug`);--> statement-breakpoint
ALTER TABLE `photos` ADD `collection_id` text REFERENCES event_collections(id);--> statement-breakpoint
ALTER TABLE `photos` ADD `moderation_status` text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `uploader_name` text DEFAULT 'Host' NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `source` text DEFAULT 'host' NOT NULL;--> statement-breakpoint
CREATE INDEX `photos_album_moderation_idx` ON `photos` (`album_id`,`moderation_status`);--> statement-breakpoint
CREATE INDEX `photos_collection_idx` ON `photos` (`collection_id`);