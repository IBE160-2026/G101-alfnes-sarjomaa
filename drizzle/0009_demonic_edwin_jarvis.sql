ALTER TABLE "answer_group" ADD COLUMN "custom_label" text;--> statement-breakpoint
ALTER TABLE "answer_group" ADD COLUMN "discarded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "reviewed" boolean DEFAULT false NOT NULL;