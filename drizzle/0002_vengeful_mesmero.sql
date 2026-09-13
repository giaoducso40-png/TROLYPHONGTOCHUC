CREATE UNIQUE INDEX `uq_people_work_email` ON `people` (`work_email`);--> statement-breakpoint
CREATE INDEX `idx_people_phone` ON `people` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_people_source_identity` ON `people` (`source_identity_key`);