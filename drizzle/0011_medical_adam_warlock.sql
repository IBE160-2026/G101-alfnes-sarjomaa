CREATE TABLE "board_slot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"count" integer NOT NULL,
	"group_id" uuid,
	CONSTRAINT "board_slot_position_range" CHECK ("board_slot"."position" between 1 and 8)
);
--> statement-breakpoint
ALTER TABLE "board_slot" ADD CONSTRAINT "board_slot_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_slot" ADD CONSTRAINT "board_slot_group_id_answer_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."answer_group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "board_slot_question_position_key" ON "board_slot" USING btree ("question_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "board_slot_group_id_key" ON "board_slot" USING btree ("group_id");