CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`company` text NOT NULL,
	`location` text NOT NULL,
	`url` text NOT NULL,
	`published_at` text,
	`contract_type` text,
	`salary` text,
	`description` text,
	`tags` text,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`is_active` integer DEFAULT true,
	`is_favorite` integer DEFAULT false,
	`is_hidden` integer DEFAULT false,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_source_external` ON `jobs` (`source_id`,`external_id`);--> statement-breakpoint
CREATE TABLE `scrape_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`success` integer,
	`jobs_found` integer,
	`jobs_new` integer,
	`errors` text
);
