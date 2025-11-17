ALTER TABLE `benchmark_runs` ADD `specialist_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `run_telemetry` ADD `prompt_sent` text;