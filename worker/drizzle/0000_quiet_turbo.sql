CREATE TABLE `batch_runs` (
	`batchId` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`completedAt` integer,
	`totalRuns` integer DEFAULT 0,
	`successfulRuns` integer DEFAULT 0,
	`avgScore` real,
	`avgWeightedScore` real,
	`metadata` text
);
--> statement-breakpoint
CREATE TABLE `benchmark_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`batchId` text,
	`suite` text NOT NULL,
	`scenario` text NOT NULL,
	`tier` text NOT NULL,
	`agent` text NOT NULL,
	`model` text,
	`status` text NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP,
	`completed_at` text,
	`total_score` real,
	`weighted_score` real,
	`is_successful` integer DEFAULT false,
	`success_metric` real,
	`metadata` text,
	FOREIGN KEY (`batchId`) REFERENCES `batch_runs`(`batchId`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `benchmark_runs_run_id_unique` ON `benchmark_runs` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_suite_scenario` ON `benchmark_runs` (`suite`,`scenario`);--> statement-breakpoint
CREATE INDEX `idx_runs_agent` ON `benchmark_runs` (`agent`);--> statement-breakpoint
CREATE INDEX `idx_runs_status` ON `benchmark_runs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_runs_batchId` ON `benchmark_runs` (`batchId`);--> statement-breakpoint
CREATE INDEX `idx_runs_is_successful` ON `benchmark_runs` (`is_successful`);--> statement-breakpoint
CREATE TABLE `evaluation_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`evaluator_name` text NOT NULL,
	`score` real NOT NULL,
	`max_score` real NOT NULL,
	`details` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`run_id`) REFERENCES `benchmark_runs`(`run_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_evals_run_id` ON `evaluation_results` (`run_id`);--> statement-breakpoint
CREATE TABLE `run_telemetry` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`tool_calls` integer,
	`tokens_in` integer,
	`tokens_out` integer,
	`cost_usd` real,
	`duration_ms` integer,
	`workspace_dir` text,
	FOREIGN KEY (`run_id`) REFERENCES `benchmark_runs`(`run_id`) ON UPDATE no action ON DELETE no action
);
