CREATE TABLE `billing_checkout_archive` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_ref` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`archived_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `checkout_archive_owner_idx` ON `billing_checkout_archive` (`owner_ref`);--> statement-breakpoint
CREATE TABLE `billing_subscription_archive` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_ref` text NOT NULL,
	`customer_id` text NOT NULL,
	`status` text NOT NULL,
	`price_id` text NOT NULL,
	`current_period_end` integer NOT NULL,
	`cancel_at_period_end` integer NOT NULL,
	`revision` integer NOT NULL,
	`sync_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `billing_archive_owner_idx` ON `billing_subscription_archive` (`owner_ref`);--> statement-breakpoint
CREATE TABLE `billing_account_state` (
	`user_id` text PRIMARY KEY NOT NULL,
	`lock_id` text,
	`lock_until` integer DEFAULT 0 NOT NULL,
	`closed_at` integer
);
