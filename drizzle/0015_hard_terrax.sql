CREATE INDEX "answer_question_id_idx" ON "answer" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "answer_group_id_idx" ON "answer" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "answer_group_question_id_idx" ON "answer_group" USING btree ("question_id");