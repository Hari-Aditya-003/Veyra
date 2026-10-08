CREATE TABLE `google_drive_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`encrypted_refresh_token` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`root_folder_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `albums` ADD `drive_folder_id` text;--> statement-breakpoint
ALTER TABLE `albums` ADD `drive_photos_folder_id` text;--> statement-breakpoint
ALTER TABLE `albums` ADD `drive_videos_folder_id` text;--> statement-breakpoint
ALTER TABLE `albums` ADD `drive_guest_uploads_folder_id` text;