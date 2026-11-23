CREATE TABLE "play_state" (
	"game_id" uuid PRIMARY KEY NOT NULL,
	"current_question_id" uuid NOT NULL,
	"current_team_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "team_position_range" CHECK ("team"."position" between 1 and 4),
	CONSTRAINT "team_name_length" CHECK (char_length("team"."name") between 1 and 14)
);
--> statement-breakpoint
ALTER TABLE "play_state" ADD CONSTRAINT "play_state_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_state" ADD CONSTRAINT "play_state_current_question_id_question_id_fk" FOREIGN KEY ("current_question_id") REFERENCES "public"."question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_state" ADD CONSTRAINT "play_state_current_team_id_team_id_fk" FOREIGN KEY ("current_team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_game_position_key" ON "team" USING btree ("game_id","position");