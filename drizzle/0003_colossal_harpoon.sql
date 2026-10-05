ALTER TABLE `albums` ADD `slideshow_playing` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `albums` ADD `slideshow_position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `albums` ADD `slideshow_updated_at` integer DEFAULT 0 NOT NULL;