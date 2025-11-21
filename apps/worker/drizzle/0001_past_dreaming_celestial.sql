CREATE TABLE `evaluation_criteria` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role_def_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`score` integer NOT NULL,
	`category` text,
	`is_custom` integer DEFAULT false,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`role_def_id`) REFERENCES `role_defs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_criteria_roledef_id` ON `evaluation_criteria` (`role_def_id`);--> statement-breakpoint
CREATE TABLE `role_defs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`version` text NOT NULL,
	`schema_version` text DEFAULT '0.0.1' NOT NULL,
	`license` text DEFAULT 'MIT',
	`availability` text DEFAULT 'public',
	`maintainers` text NOT NULL,
	`persona` text NOT NULL,
	`capabilities` text NOT NULL,
	`dependencies` text NOT NULL,
	`documentation` text NOT NULL,
	`preferred_models` text NOT NULL,
	`prompts` text NOT NULL,
	`spawnable_sub_agents` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_defs_name_unique` ON `role_defs` (`name`);--> statement-breakpoint
CREATE INDEX `idx_roledefs_name` ON `role_defs` (`name`);--> statement-breakpoint
CREATE INDEX `idx_roledefs_created_at` ON `role_defs` (`created_at`);