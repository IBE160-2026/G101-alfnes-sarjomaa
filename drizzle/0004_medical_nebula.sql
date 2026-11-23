CREATE TABLE "invite_link" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "invite_links_issued" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invite_link" ADD CONSTRAINT "invite_link_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;