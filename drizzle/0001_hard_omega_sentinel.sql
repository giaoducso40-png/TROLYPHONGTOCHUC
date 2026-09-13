CREATE TABLE `employment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`event_type` text NOT NULL,
	`from_organization_id` text,
	`to_organization_id` text,
	`old_value_json` text,
	`new_value_json` text,
	`effective_date` text NOT NULL,
	`decision_number` text,
	`reason` text,
	`evidence_file_id` text,
	`created_by` text NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_employment_events_person_date` ON `employment_events` (`person_id`,`effective_date`);--> statement-breakpoint
CREATE INDEX `idx_employment_events_type_date` ON `employment_events` (`event_type`,`effective_date`);--> statement-breakpoint
CREATE TABLE `organization_history` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`change_type` text NOT NULL,
	`old_value_json` text,
	`new_value_json` text,
	`effective_date` text NOT NULL,
	`decision_number` text,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_organization_history_org_date` ON `organization_history` (`organization_id`,`effective_date`);--> statement-breakpoint
CREATE TABLE `person_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`organization_id` text,
	`assignment_type` text NOT NULL,
	`title` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`source_file` text,
	`source_sheet` text,
	`source_row` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_person_assignments_person` ON `person_assignments` (`person_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_person_assignments_org` ON `person_assignments` (`organization_id`);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `evidence_file_id` text;--> statement-breakpoint
ALTER TABLE `qualifications` ADD `discipline_group` text;--> statement-breakpoint
ALTER TABLE `qualifications` ADD `education_history_json` text;