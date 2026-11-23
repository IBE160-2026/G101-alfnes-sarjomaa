CREATE TABLE "answer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"contributor_key" uuid,
	"rank" integer,
	"text" text NOT NULL,
	"normalized_text" text NOT NULL,
	CONSTRAINT "answer_rank_range" CHECK ("answer"."rank" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "grouping_lease_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "answer" ADD CONSTRAINT "answer_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE cascade ON UPDATE no action;