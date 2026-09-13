CREATE TABLE `academic_years` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`is_current` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_academic_years_code` ON `academic_years` (`code`);--> statement-breakpoint
CREATE INDEX `idx_academic_years_current` ON `academic_years` (`is_current`);--> statement-breakpoint
CREATE TABLE `positions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`position_type` text DEFAULT 'Chức vụ' NOT NULL,
	`organization_id` text,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_positions_code` ON `positions` (`code`);--> statement-breakpoint
CREATE INDEX `idx_positions_org_status` ON `positions` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `system_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_system_settings_updated` ON `system_settings` (`updated_at`);--> statement-breakpoint
ALTER TABLE `contracts` ADD `salary_coefficient` text;--> statement-breakpoint
ALTER TABLE `contracts` ADD `updated_by` text;--> statement-breakpoint
ALTER TABLE `file_records` ADD `file_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `file_records` ADD `replaces_file_id` text;--> statement-breakpoint
ALTER TABLE `people` ADD `lecturer_code` text;--> statement-breakpoint
ALTER TABLE `people` ADD `person_type` text DEFAULT 'Viên chức' NOT NULL;--> statement-breakpoint
ALTER TABLE `people` ADD `identity_number` text;--> statement-breakpoint
ALTER TABLE `people` ADD `tax_code` text;--> statement-breakpoint
ALTER TABLE `people` ADD `social_insurance_number` text;--> statement-breakpoint
ALTER TABLE `people` ADD `home_town` text;--> statement-breakpoint
ALTER TABLE `people` ADD `specialization` text;--> statement-breakpoint
ALTER TABLE `people` ADD `work_arrangement` text;--> statement-breakpoint
ALTER TABLE `people` ADD `updated_by` text;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_people_lecturer_code` ON `people` (`lecturer_code`);