CREATE TABLE `content_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`state` text NOT NULL,
	`uploaded_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_asset_object_key_unique` ON `content_asset` (`object_key`);--> statement-breakpoint
CREATE TABLE `content_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`draft` text NOT NULL,
	`cover_asset_id` text,
	`live` text,
	`live_cover_asset_id` text,
	`live_slug` text,
	`live_locale` text,
	`published_at` integer,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` text,
	`updated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`cover_asset_id`) REFERENCES `content_asset`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`live_cover_asset_id`) REFERENCES `content_asset`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_live_path_unique` ON `content_entry` (`live_locale`,`live_slug`);