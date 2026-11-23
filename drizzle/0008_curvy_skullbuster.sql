CREATE TABLE "game_counter" (
	"game_id" uuid PRIMARY KEY NOT NULL,
	"judge_groups_proposed" integer DEFAULT 0 NOT NULL,
	"groups_merged" integer DEFAULT 0 NOT NULL,
	"answers_moved" integer DEFAULT 0 NOT NULL,
	"groups_created" integer DEFAULT 0 NOT NULL,
	"groups_renamed" integer DEFAULT 0 NOT NULL,
	"groups_discarded" integer DEFAULT 0 NOT NULL,
	"groups_restored" integer DEFAULT 0 NOT NULL,
	"judge_calls" integer DEFAULT 0 NOT NULL,
	"questions_fell_back" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "answer_group" ADD COLUMN "edit_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_counter" ADD CONSTRAINT "game_counter_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;