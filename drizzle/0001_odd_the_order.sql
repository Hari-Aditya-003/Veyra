ALTER TABLE `albums` ADD `event_type` text DEFAULT 'Celebration' NOT NULL;--> statement-breakpoint
ALTER TABLE `albums` ADD `event_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `albums` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `albums` ADD `theme` text DEFAULT 'rose' NOT NULL;--> statement-breakpoint
ALTER TABLE `albums` ADD `expected_guests` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `caption` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `is_featured` integer DEFAULT false NOT NULL;