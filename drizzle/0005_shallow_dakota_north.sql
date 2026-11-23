CREATE TABLE "submission" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"answers" jsonb NOT NULL,
	"edit_secret_hash" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_token_hash_invite_link_token_hash_fk" FOREIGN KEY ("token_hash") REFERENCES "public"."invite_link"("token_hash") ON DELETE cascade ON UPDATE no action;