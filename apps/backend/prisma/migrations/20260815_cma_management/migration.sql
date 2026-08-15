-- =====================================================
-- W+2 CMA 必查: 内审/管评/监督/盲样/PT 五表
-- =====================================================

-- CreateTable
CREATE TABLE "internal_audits" (
    "id" UUID NOT NULL,
    "auditNo" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "scope" TEXT NOT NULL,
    "audit_date" TIMESTAMPTZ NOT NULL,
    "auditor_ids" UUID[],
    "findings" TEXT,
    "nc_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
    "report_file_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "internal_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_reviews" (
    "id" UUID NOT NULL,
    "reviewNo" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "period_from" TIMESTAMPTZ NOT NULL,
    "period_to" TIMESTAMPTZ NOT NULL,
    "review_date" TIMESTAMPTZ NOT NULL,
    "attendees" UUID[],
    "inputs" TEXT,
    "outputs" TEXT,
    "decisions" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
    "report_file_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "management_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supervision_records" (
    "id" UUID NOT NULL,
    "supNo" VARCHAR(50) NOT NULL,
    "supervisor_id" UUID NOT NULL,
    "supervisee_id" UUID NOT NULL,
    "sup_date" TIMESTAMPTZ NOT NULL,
    "content" TEXT NOT NULL,
    "result" VARCHAR(20) NOT NULL DEFAULT 'PASS',
    "corrective_action" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "supervision_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blind_samples" (
    "id" UUID NOT NULL,
    "blindNo" VARCHAR(50) NOT NULL,
    "sample_code" VARCHAR(100) NOT NULL,
    "assigned_to_id" UUID NOT NULL,
    "true_value" DECIMAL(15,6) NOT NULL,
    "measured_value" DECIMAL(15,6),
    "deviation_pct" DECIMAL(8,4),
    "passed" BOOLEAN,
    "assess_date" TIMESTAMPTZ,
    "remarks" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "blind_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proficiency_tests" (
    "id" UUID NOT NULL,
    "ptNo" VARCHAR(50) NOT NULL,
    "organizer" VARCHAR(200) NOT NULL,
    "item" VARCHAR(100) NOT NULL,
    "method" VARCHAR(100) NOT NULL,
    "z_score" DECIMAL(8,4),
    "result" VARCHAR(50),
    "start_date" TIMESTAMPTZ NOT NULL,
    "end_date" TIMESTAMPTZ,
    "report_file_id" UUID,
    "remarks" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "proficiency_tests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "internal_audits_auditNo_key" ON "internal_audits"("auditNo");

-- CreateIndex
CREATE INDEX "internal_audits_auditNo_idx" ON "internal_audits"("auditNo");

-- CreateIndex
CREATE INDEX "internal_audits_audit_date_idx" ON "internal_audits"("audit_date");

-- CreateIndex
CREATE UNIQUE INDEX "management_reviews_reviewNo_key" ON "management_reviews"("reviewNo");

-- CreateIndex
CREATE INDEX "management_reviews_reviewNo_idx" ON "management_reviews"("reviewNo");

-- CreateIndex
CREATE INDEX "management_reviews_review_date_idx" ON "management_reviews"("review_date");

-- CreateIndex
CREATE UNIQUE INDEX "supervision_records_supNo_key" ON "supervision_records"("supNo");

-- CreateIndex
CREATE INDEX "supervision_records_supNo_idx" ON "supervision_records"("supNo");

-- CreateIndex
CREATE INDEX "supervision_records_sup_date_idx" ON "supervision_records"("sup_date");

-- CreateIndex
CREATE UNIQUE INDEX "blind_samples_blindNo_key" ON "blind_samples"("blindNo");

-- CreateIndex
CREATE INDEX "blind_samples_blindNo_idx" ON "blind_samples"("blindNo");

-- CreateIndex
CREATE UNIQUE INDEX "proficiency_tests_ptNo_key" ON "proficiency_tests"("ptNo");

-- CreateIndex
CREATE INDEX "proficiency_tests_ptNo_idx" ON "proficiency_tests"("ptNo");

-- AddForeignKey
ALTER TABLE "internal_audits" ADD CONSTRAINT "internal_audits_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_reviews" ADD CONSTRAINT "management_reviews_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervision_records" ADD CONSTRAINT "supervision_records_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervision_records" ADD CONSTRAINT "supervision_records_supervisee_id_fkey" FOREIGN KEY ("supervisee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervision_records" ADD CONSTRAINT "supervision_records_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blind_samples" ADD CONSTRAINT "blind_samples_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blind_samples" ADD CONSTRAINT "blind_samples_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proficiency_tests" ADD CONSTRAINT "proficiency_tests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

