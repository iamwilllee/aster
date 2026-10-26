CREATE TABLE `file_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `file_asset_object_key_unique` ON `file_asset` (`object_key`);--> statement-breakpoint
CREATE INDEX `file_asset_owner_idx` ON `file_asset` (`user_id`,`state`);--> statement-breakpoint
ALTER TABLE `project` ADD `cover_asset_id` text REFERENCES file_asset(id) ON DELETE SET NULL;