CREATE TABLE `event_metrics` (
	`event_id` text PRIMARY KEY NOT NULL,
	`gallery_views` integer DEFAULT 0 NOT NULL,
	`downloads` integer DEFAULT 0 NOT NULL,
	`guest_uploads` integer DEFAULT 0 NOT NULL,
	`last_view_at` integer DEFAULT 0 NOT NULL,
	`last_download_at` integer DEFAULT 0 NOT NULL,
	`last_guest_upload_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade
);
