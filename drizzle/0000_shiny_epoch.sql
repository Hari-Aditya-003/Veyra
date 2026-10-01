CREATE TABLE `albums` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`access_token` text NOT NULL,
	`guest_username` text NOT NULL,
	`guest_password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `albums_access_token_unique` ON `albums` (`access_token`);--> statement-breakpoint
CREATE INDEX `albums_token_idx` ON `albums` (`access_token`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`album_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_object_key_unique` ON `photos` (`object_key`);--> statement-breakpoint
CREATE INDEX `photos_album_idx` ON `photos` (`album_id`);