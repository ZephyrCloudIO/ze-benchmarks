CREATE TABLE `human_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`scorer_name` text NOT NULL,
	`scorer_email` text,
	`scores` text NOT NULL,
	`overall_score` real NOT NULL,
	`time_spent_seconds` integer,
	`notes` text,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `benchmark_runs`(`run_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_human_scores_run_id` ON `human_scores` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_human_scores_created_at` ON `human_scores` (`created_at`);