ALTER TABLE `billing_checkout_archive` ADD `provider` text DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE `billing_subscription_archive` ADD `provider` text DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE `checkout` ADD `provider` text DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscription` ADD `provider` text DEFAULT 'stripe' NOT NULL;