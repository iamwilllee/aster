CREATE TABLE `account_access` (
	`user_id` text PRIMARY KEY NOT NULL,
	`disabled_at` integer,
	`revision` integer DEFAULT 0 NOT NULL,
	`operation_id` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `admin_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`target_id` text,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `admin_audit_created_idx` ON `admin_audit` (`created_at`);--> statement-breakpoint
CREATE INDEX `admin_audit_target_idx` ON `admin_audit` (`target_id`,`created_at`);--> statement-breakpoint
-- Auth writes are fenced in SQLite as well as request hooks, including in-flight sign-in/reset races.
CREATE TRIGGER account_access_session_insert BEFORE INSERT ON session
WHEN EXISTS (SELECT 1 FROM account_access WHERE user_id=NEW.user_id AND disabled_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'account disabled'); END;
--> statement-breakpoint
CREATE TRIGGER account_access_session_update BEFORE UPDATE ON session
WHEN EXISTS (SELECT 1 FROM account_access WHERE user_id=NEW.user_id AND disabled_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'account disabled'); END;
--> statement-breakpoint
CREATE TRIGGER account_access_user_update BEFORE UPDATE ON user
WHEN EXISTS (SELECT 1 FROM account_access WHERE user_id=OLD.id AND disabled_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'account disabled'); END;
--> statement-breakpoint
CREATE TRIGGER account_access_credential_insert BEFORE INSERT ON account
WHEN EXISTS (SELECT 1 FROM account_access WHERE user_id=NEW.user_id AND disabled_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'account disabled'); END;
--> statement-breakpoint
CREATE TRIGGER account_access_credential_update BEFORE UPDATE ON account
WHEN EXISTS (SELECT 1 FROM account_access WHERE user_id=OLD.user_id AND disabled_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'account disabled'); END;
--> statement-breakpoint
CREATE TRIGGER admin_eligible_insert BEFORE INSERT ON admin_user
WHEN NOT EXISTS (SELECT 1 FROM user u LEFT JOIN account_access a ON a.user_id=u.id WHERE u.id=NEW.user_id AND u.email_verified=1 AND a.disabled_at IS NULL)
BEGIN SELECT RAISE(ABORT,'eligible verified account required'); END;
--> statement-breakpoint
-- SQL/CLI role operations have no authenticated web actor. Never invent one or retain email snapshots.
CREATE TRIGGER admin_audit_role_insert AFTER INSERT ON admin_user
BEGIN INSERT INTO admin_audit(id,target_id,action,reason,source,created_at)
VALUES(lower(hex(randomblob(16))),NEW.user_id,'admin.grant','maintenance','database',CAST(unixepoch('subsec')*1000 AS INTEGER)); END;
--> statement-breakpoint
CREATE TRIGGER admin_audit_role_delete AFTER DELETE ON admin_user
BEGIN INSERT INTO admin_audit(id,target_id,action,reason,source,created_at)
VALUES(lower(hex(randomblob(16))),(SELECT id FROM user WHERE id=OLD.user_id),'admin.revoke','maintenance','database',CAST(unixepoch('subsec')*1000 AS INTEGER)); END;
