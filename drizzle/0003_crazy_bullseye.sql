CREATE TABLE `document_records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_entity_type` text NOT NULL,
	`owner_entity_id` text NOT NULL,
	`file_type` text NOT NULL,
	`file_name` text NOT NULL,
	`document_number` text,
	`document_date` text,
	`document_version` integer DEFAULT 1 NOT NULL,
	`notes` text,
	`source_file` text,
	`source_sheet` text,
	`source_row` integer,
	`raw_data` text,
	`checksum` text,
	`version` integer DEFAULT 1 NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_document_records_owner` ON `document_records` (`owner_entity_type`,`owner_entity_id`);--> statement-breakpoint
CREATE INDEX `idx_document_records_number` ON `document_records` (`document_number`);--> statement-breakpoint
CREATE TABLE `training_commitments` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`training_record_id` text,
	`decision_number` text,
	`amount` integer,
	`start_date` text,
	`due_date` text,
	`status` text DEFAULT 'chờ xác minh' NOT NULL,
	`completed_date` text,
	`notes` text,
	`source_file` text,
	`source_sheet` text,
	`source_row` integer,
	`raw_data` text,
	`checksum` text,
	`version` integer DEFAULT 1 NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`training_record_id`) REFERENCES `training_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_training_commitments_person` ON `training_commitments` (`person_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_training_commitments_due` ON `training_commitments` (`status`,`due_date`);--> statement-breakpoint
CREATE TABLE `training_records` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`training_type` text NOT NULL,
	`program_name` text,
	`degree_level` text,
	`major` text,
	`discipline_group` text,
	`institution` text,
	`country` text,
	`country_scope` text,
	`funding_source` text,
	`status` text DEFAULT 'chờ xác minh' NOT NULL,
	`start_date` text,
	`end_date` text,
	`decision_number` text,
	`foreign_language` text,
	`notes` text,
	`source_file` text,
	`source_sheet` text,
	`source_row` integer,
	`raw_data` text,
	`checksum` text,
	`version` integer DEFAULT 1 NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_training_records_person` ON `training_records` (`person_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_training_records_due` ON `training_records` (`status`,`end_date`);--> statement-breakpoint
ALTER TABLE `employment_events` ADD `source_file` text;--> statement-breakpoint
ALTER TABLE `employment_events` ADD `source_sheet` text;--> statement-breakpoint
ALTER TABLE `employment_events` ADD `source_row` integer;--> statement-breakpoint
ALTER TABLE `employment_events` ADD `raw_data` text;--> statement-breakpoint
ALTER TABLE `employment_events` ADD `checksum` text;--> statement-breakpoint
ALTER TABLE `employment_events` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `employment_events` ADD `sync_state` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `source_file` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `source_sheet` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `source_row` integer;--> statement-breakpoint
ALTER TABLE `organizations` ADD `raw_data` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `checksum` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `sync_state` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `person_assignments` ADD `raw_data` text;--> statement-breakpoint
ALTER TABLE `person_assignments` ADD `checksum` text;--> statement-breakpoint
ALTER TABLE `person_assignments` ADD `sync_state` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `qualifications` ADD `raw_data` text;--> statement-breakpoint
ALTER TABLE `qualifications` ADD `checksum` text;--> statement-breakpoint
ALTER TABLE `qualifications` ADD `sync_state` text DEFAULT 'pending' NOT NULL;