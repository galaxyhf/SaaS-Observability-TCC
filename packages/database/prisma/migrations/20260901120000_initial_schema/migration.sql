CREATE TYPE "ServiceType" AS ENUM ('BROWSER', 'SERVER', 'UNKNOWN');
CREATE TYPE "TraceStatus" AS ENUM ('UNSET', 'OK', 'ERROR');
CREATE TYPE "SpanKind" AS ENUM ('UNSPECIFIED', 'INTERNAL', 'SERVER', 'CLIENT', 'PRODUCER', 'CONSUMER');
CREATE TYPE "SpanStatusCode" AS ENUM ('UNSET', 'OK', 'ERROR');

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "public_id" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "website_url" VARCHAR(2048),
    "retention_days" INTEGER NOT NULL DEFAULT 7,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_keys" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "key_hash" CHAR(64) NOT NULL,
    "prefix" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    CONSTRAINT "project_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_allowed_origins" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "origin" VARCHAR(2048) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_allowed_origins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "environments" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "environments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "environment_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "ServiceType" NOT NULL DEFAULT 'UNKNOWN',
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "traces" (
    "id" UUID NOT NULL,
    "trace_id" CHAR(32) NOT NULL,
    "project_id" UUID NOT NULL,
    "environment_id" UUID NOT NULL,
    "service_id" UUID,
    "root_span_name" VARCHAR(512),
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6) NOT NULL,
    "duration_ms" DECIMAL(18,3) NOT NULL,
    "status" "TraceStatus" NOT NULL DEFAULT 'UNSET',
    "first_received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "traces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "spans" (
    "id" UUID NOT NULL,
    "span_id" CHAR(16) NOT NULL,
    "trace_record_id" UUID NOT NULL,
    "parent_span_id" CHAR(16),
    "service_id" UUID NOT NULL,
    "name" VARCHAR(512) NOT NULL,
    "kind" "SpanKind" NOT NULL DEFAULT 'UNSPECIFIED',
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6) NOT NULL,
    "duration_ms" DECIMAL(18,3) NOT NULL,
    "status_code" "SpanStatusCode" NOT NULL DEFAULT 'UNSET',
    "status_message" VARCHAR(2048),
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "resource_attributes" JSONB NOT NULL DEFAULT '{}',
    "events" JSONB NOT NULL DEFAULT '[]',
    "links" JSONB NOT NULL DEFAULT '[]',
    "scope_name" VARCHAR(255),
    "scope_version" VARCHAR(80),
    "trace_state" VARCHAR(512),
    "flags" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "spans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");
CREATE INDEX "auth_sessions_user_id_revoked_at_idx" ON "auth_sessions"("user_id", "revoked_at");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");
CREATE UNIQUE INDEX "projects_public_id_key" ON "projects"("public_id");
CREATE INDEX "projects_user_id_created_at_idx" ON "projects"("user_id", "created_at");
CREATE UNIQUE INDEX "projects_user_id_slug_key" ON "projects"("user_id", "slug");
CREATE UNIQUE INDEX "project_keys_key_hash_key" ON "project_keys"("key_hash");
CREATE INDEX "project_keys_project_id_revoked_at_idx" ON "project_keys"("project_id", "revoked_at");
CREATE INDEX "project_keys_prefix_idx" ON "project_keys"("prefix");
CREATE UNIQUE INDEX "project_allowed_origins_project_id_origin_key" ON "project_allowed_origins"("project_id", "origin");
CREATE INDEX "environments_project_id_idx" ON "environments"("project_id");
CREATE UNIQUE INDEX "environments_project_id_slug_key" ON "environments"("project_id", "slug");
CREATE INDEX "services_project_id_last_seen_at_idx" ON "services"("project_id", "last_seen_at");
CREATE INDEX "services_environment_id_last_seen_at_idx" ON "services"("environment_id", "last_seen_at");
CREATE UNIQUE INDEX "services_project_id_environment_id_name_key" ON "services"("project_id", "environment_id", "name");
CREATE INDEX "traces_project_id_environment_id_started_at_idx" ON "traces"("project_id", "environment_id", "started_at" DESC);
CREATE INDEX "traces_project_id_duration_ms_idx" ON "traces"("project_id", "duration_ms" DESC);
CREATE INDEX "traces_project_id_status_started_at_idx" ON "traces"("project_id", "status", "started_at" DESC);
CREATE INDEX "traces_service_id_started_at_idx" ON "traces"("service_id", "started_at" DESC);
CREATE UNIQUE INDEX "traces_project_id_trace_id_key" ON "traces"("project_id", "trace_id");
CREATE INDEX "spans_span_id_idx" ON "spans"("span_id");
CREATE INDEX "spans_parent_span_id_idx" ON "spans"("parent_span_id");
CREATE INDEX "spans_service_id_started_at_idx" ON "spans"("service_id", "started_at" DESC);
CREATE INDEX "spans_service_id_duration_ms_idx" ON "spans"("service_id", "duration_ms" DESC);
CREATE INDEX "spans_status_code_started_at_idx" ON "spans"("status_code", "started_at" DESC);
CREATE UNIQUE INDEX "spans_trace_record_id_span_id_key" ON "spans"("trace_record_id", "span_id");

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_keys" ADD CONSTRAINT "project_keys_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_allowed_origins" ADD CONSTRAINT "project_allowed_origins_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "environments" ADD CONSTRAINT "environments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "services" ADD CONSTRAINT "services_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "services" ADD CONSTRAINT "services_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "traces" ADD CONSTRAINT "traces_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "traces" ADD CONSTRAINT "traces_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "traces" ADD CONSTRAINT "traces_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "spans" ADD CONSTRAINT "spans_trace_record_id_fkey" FOREIGN KEY ("trace_record_id") REFERENCES "traces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spans" ADD CONSTRAINT "spans_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
