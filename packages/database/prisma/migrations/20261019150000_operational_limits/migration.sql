CREATE TABLE "ingestion_windows" (
  "project_id" UUID NOT NULL,
  "window_started_at" TIMESTAMPTZ(6) NOT NULL,
  "spans" INTEGER NOT NULL CHECK ("spans" > 0),
  PRIMARY KEY ("project_id", "window_started_at"),
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
);
CREATE INDEX "ingestion_windows_window_started_at_idx" ON "ingestion_windows"("window_started_at");
CREATE INDEX "traces_project_id_started_at_id_idx" ON "traces"("project_id", "started_at" DESC, "id" DESC);
