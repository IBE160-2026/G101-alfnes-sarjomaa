CREATE TABLE "reveal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"board_slot_id" uuid NOT NULL,
	"team_id" uuid,
	"seq" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reveal" ADD CONSTRAINT "reveal_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reveal" ADD CONSTRAINT "reveal_board_slot_id_board_slot_id_fk" FOREIGN KEY ("board_slot_id") REFERENCES "public"."board_slot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reveal" ADD CONSTRAINT "reveal_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reveal_board_slot_id_key" ON "reveal" USING btree ("board_slot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reveal_game_seq_key" ON "reveal" USING btree ("game_id","seq");