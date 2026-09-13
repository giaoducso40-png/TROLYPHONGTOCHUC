CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`dedup_key` text NOT NULL,
	`severity` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`organization_id` text,
	`due_date` text,
	`assignee_user_id` text,
	`status` text DEFAULT 'unread' NOT NULL,
	`snoozed_until` text,
	`resolved_at` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_alerts_dedup_key` ON `alerts` (`dedup_key`);--> statement-breakpoint
CREATE INDEX `idx_alerts_status_due` ON `alerts` (`status`,`due_date`);--> statement-breakpoint
CREATE INDEX `idx_alerts_org` ON `alerts` (`organization_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`actor_email` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`before_json` text,
	`after_json` text,
	`changed_fields` text,
	`reason` text,
	`request_id` text,
	`device_session` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_actor_date` ON `audit_logs` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text,
	`contract_number` text,
	`contract_type` text NOT NULL,
	`source_person_name` text NOT NULL,
	`source_birth_date` text,
	`signer` text,
	`signing_organization` text,
	`using_organization_id` text,
	`using_organization_source` text,
	`role_or_specialty` text,
	`signed_date` text,
	`effective_date` text,
	`start_date` text,
	`end_date` text,
	`duration_months` integer,
	`period_text` text,
	`status` text DEFAULT 'chờ bổ sung' NOT NULL,
	`terminated_date` text,
	`termination_reason` text,
	`notes` text,
	`source_file` text,
	`source_sheet` text,
	`source_row` integer,
	`source_identity_key` text NOT NULL,
	`raw_data` text,
	`checksum` text,
	`version` integer DEFAULT 1 NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`using_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_contracts_source_identity` ON `contracts` (`source_identity_key`);--> statement-breakpoint
CREATE INDEX `idx_contracts_number` ON `contracts` (`contract_number`);--> statement-breakpoint
CREATE INDEX `idx_contracts_person` ON `contracts` (`person_id`);--> statement-breakpoint
CREATE INDEX `idx_contracts_status_end` ON `contracts` (`status`,`end_date`);--> statement-breakpoint
CREATE INDEX `idx_contracts_type` ON `contracts` (`contract_type`);--> statement-breakpoint
CREATE TABLE `file_records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_entity_type` text NOT NULL,
	`owner_entity_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`checksum` text,
	`uploaded_by` text NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_file_records_storage_key` ON `file_records` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_file_records_owner` ON `file_records` (`owner_entity_type`,`owner_entity_id`);--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`operation` text NOT NULL,
	`result_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_idempotency_actor` ON `idempotency_keys` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `import_errors` (
	`id` text PRIMARY KEY NOT NULL,
	`import_id` text NOT NULL,
	`sheet_name` text,
	`source_row` integer,
	`source_column` text,
	`error_code` text NOT NULL,
	`severity` text NOT NULL,
	`source_value` text,
	`message` text NOT NULL,
	`suggested_fix` text,
	`resolved_at` text,
	`resolved_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `source_imports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_import_errors_import` ON `import_errors` (`import_id`,`severity`);--> statement-breakpoint
CREATE TABLE `mapping_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`file_pattern` text NOT NULL,
	`sheet_pattern` text,
	`entity_type` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`header_row` integer NOT NULL,
	`header_depth` integer DEFAULT 1 NOT NULL,
	`mapping_json` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_mapping_templates_name_version` ON `mapping_templates` (`name`,`version`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`short_name` text,
	`level` text DEFAULT 'đơn vị' NOT NULL,
	`parent_id` text,
	`manager_person_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_organizations_code` ON `organizations` (`code`);--> statement-breakpoint
CREATE INDEX `idx_organizations_parent` ON `organizations` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_organizations_status` ON `organizations` (`status`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_code` text,
	`full_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`birth_date` text,
	`gender` text,
	`organization_id` text,
	`organization_name_source` text,
	`department` text,
	`position` text,
	`professional_title` text,
	`employment_status` text DEFAULT 'đang công tác' NOT NULL,
	`start_date` text,
	`phone` text,
	`work_email` text,
	`personal_email` text,
	`address` text,
	`notes` text,
	`source_file` text,
	`source_sheet` text,
	`source_row` integer,
	`source_identity_key` text,
	`raw_data` text,
	`checksum` text,
	`version` integer DEFAULT 1 NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_people_staff_code` ON `people` (`staff_code`);--> statement-breakpoint
CREATE INDEX `idx_people_name_birth` ON `people` (`normalized_name`,`birth_date`);--> statement-breakpoint
CREATE INDEX `idx_people_organization` ON `people` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_people_status` ON `people` (`employment_status`);--> statement-breakpoint
CREATE INDEX `idx_people_sync_state` ON `people` (`sync_state`);--> statement-breakpoint
CREATE TABLE `qualifications` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`academic_title` text,
	`degree_level` text,
	`degree_year` integer,
	`major` text,
	`institution` text,
	`country` text,
	`graduation_year` integer,
	`foreign_language` text,
	`informatics` text,
	`phd_status` text,
	`start_date` text,
	`end_date` text,
	`notes` text,
	`source_file` text,
	`source_sheet` text,
	`source_row` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_qualifications_person` ON `qualifications` (`person_id`);--> statement-breakpoint
CREATE INDEX `idx_qualifications_level` ON `qualifications` (`degree_level`);--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`period_year` integer NOT NULL,
	`period_month` integer,
	`scope` text DEFAULT 'all' NOT NULL,
	`record_counts_json` text NOT NULL,
	`checksum` text NOT NULL,
	`storage_key` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_snapshots_period_scope` ON `snapshots` (`period_year`,`period_month`,`scope`);--> statement-breakpoint
CREATE TABLE `source_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`file_checksum` text NOT NULL,
	`file_size` integer,
	`sheet_name` text,
	`header_row` integer,
	`mapping_version` text,
	`mode` text NOT NULL,
	`status` text DEFAULT 'validating' NOT NULL,
	`total_rows` integer DEFAULT 0 NOT NULL,
	`inserted_rows` integer DEFAULT 0 NOT NULL,
	`updated_rows` integer DEFAULT 0 NOT NULL,
	`duplicate_rows` integer DEFAULT 0 NOT NULL,
	`skipped_rows` integer DEFAULT 0 NOT NULL,
	`error_rows` integer DEFAULT 0 NOT NULL,
	`imported_by` text NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_source_imports_checksum` ON `source_imports` (`file_checksum`);--> statement-breakpoint
CREATE INDEX `idx_source_imports_status` ON `source_imports` (`status`);--> statement-breakpoint
CREATE TABLE `sync_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`base_version` integer NOT NULL,
	`server_version` integer NOT NULL,
	`local_json` text NOT NULL,
	`server_json` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_by` text,
	`resolution` text,
	`resolved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sync_conflicts_status` ON `sync_conflicts` (`status`,`entity_type`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text,
	`role` text NOT NULL,
	`organization_scope` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_roles_user_scope` ON `user_roles` (`user_id`,`role`,`organization_scope`);--> statement-breakpoint
CREATE INDEX `idx_user_roles_email` ON `user_roles` (`email`);