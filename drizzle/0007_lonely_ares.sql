CREATE TYPE "public"."fallback_reason" AS ENUM('NO_KEY', 'NO_STORED_RULING', 'TIMEOUT', 'ERROR', 'REFUSAL', 'INVALID_OUTPUT');--> statement-breakpoint
CREATE TYPE "public"."group_origin" AS ENUM('judge', 'fallback');--> statement-breakpoint
CREATE TYPE "public"."grouping_source" AS ENUM('judge', 'replay', 'fallback');--> statement-breakpoint
CREATE TABLE "answer_group" (
	"id" uuid PRIMARY KEY NOT NULL,
	"question_id" uuid NOT NULL,
	"origin" "group_origin" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grouping_result" (
	"question_id" uuid PRIMARY KEY NOT NULL,
	"source" "grouping_source" NOT NULL,
	"prompt_version" text NOT NULL,
	"normalize_version" integer NOT NULL,
	"model_id" text NOT NULL,
	"judge_calls" integer NOT NULL,
	"uncovered_items" integer NOT NULL,
	"fell_back" boolean NOT NULL,
	"fallback_reason" "fallback_reason"
);
--> statement-breakpoint
ALTER TABLE "answer" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "answer_group" ADD CONSTRAINT "answer_group_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grouping_result" ADD CONSTRAINT "grouping_result_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer" ADD CONSTRAINT "answer_group_id_answer_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."answer_group"("id") ON DELETE cascade ON UPDATE no action;