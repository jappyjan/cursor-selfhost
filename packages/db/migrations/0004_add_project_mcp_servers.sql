CREATE TABLE `project_mcp_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`command` text NOT NULL,
	`args` text NOT NULL,
	`env` text,
	`enabled` integer NOT NULL DEFAULT 1,
	`sort_order` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
