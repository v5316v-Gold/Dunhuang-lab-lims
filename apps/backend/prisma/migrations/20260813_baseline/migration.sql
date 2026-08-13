-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'LAB_DIRECTOR', 'QUALITY_MANAGER', 'EQUIPMENT_MANAGER', 'REAGENT_MANAGER', 'SENIOR_ANALYST', 'ANALYST', 'INTERN', 'EXTERNAL_AUDITOR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING');

-- CreateEnum
CREATE TYPE "PersonnelStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "TrainingResult" AS ENUM ('PASS', 'FAIL', 'EXCELLENT');

-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('FIRE_ASSAY_FURNACE', 'CUPELLATION_FURNACE', 'ANALYTICAL_BALANCE', 'ICP_OES', 'ICP_MS', 'XRF', 'MICROWAVE_DIGESTION', 'WATER_PURIFIER', 'OTHER');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED', 'BROKEN');

-- CreateEnum
CREATE TYPE "SampleType" AS ENUM ('GOLD_INGOT', 'GOLD_POWDER', 'GOLD_ALLOY', 'JEWELRY', 'RECYCLED_GOLD', 'SILVER', 'PLATINUM', 'PALLADIUM', 'OTHER');

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('RECEIVED', 'BATCHED', 'IN_TEST', 'TESTED', 'REPORT_DRAFT', 'REPORT_REVIEW', 'REPORT_APPROVED', 'ARCHIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AssayMethod" AS ENUM ('FIRE_ASSAY', 'ICP_OES', 'ICP_MS', 'XRF', 'FIRE_ASSAY_GRAVIMETRIC', 'VOLUMETRIC', 'ICP_GBC', 'OTHER');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PENDING', 'MIXING', 'FUSING', 'CUPELLING', 'PARTING', 'ANNEALING', 'WEIGHING', 'CALCULATING', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'QC_FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConcentrationUnit" AS ENUM ('PERCENTAGE', 'PPM', 'PPB', 'PPT', 'MG_PER_G');

-- CreateEnum
CREATE TYPE "QcType" AS ENUM ('BLANK', 'PARALLEL', 'SPIKE', 'STANDARD');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'INTERNAL_REVIEW', 'FINAL_REVIEW', 'APPROVED', 'ISSUED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ReagentType" AS ENUM ('GOLD_STANDARD', 'SILVER_STANDARD', 'LEAD_BUTTON', 'BORAX', 'SILICA_SAND', 'SODIUM_CARBONATE', 'NITRIC_ACID', 'HYDROCHLORIC_ACID', 'AQUA_REGIA', 'HYDROFLUORIC_ACID', 'PERCHLORIC_ACID', 'ICP_CALIBRATION_STD', 'ARGON_GAS', 'OTHER');

-- CreateEnum
CREATE TYPE "HazardSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "HazardStatus" AS ENUM ('REPORTED', 'INVESTIGATING', 'RESOLVED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('REPORT_PDF', 'CERTIFICATE', 'QC_DATA', 'SAMPLE_PHOTO', 'TRAINING_CERT', 'METHOD_VALIDATION', 'EMERGENCY_PLAN', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(20),
    "dept_id" UUID,
    "title" VARCHAR(50),
    "role" "UserRole" NOT NULL DEFAULT 'ANALYST',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "mfa_secret" VARCHAR(255),
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_backup_codes" TEXT[],
    "last_login_at" TIMESTAMPTZ,
    "last_login_ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "parent_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role_assignments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "scope" VARCHAR(100),
    "granted_by" UUID,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "user_agent" TEXT,
    "ip" VARCHAR(45),
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID,
    "username" VARCHAR(50) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "table_name" VARCHAR(50),
    "record_id" UUID,
    "old_data" JSONB,
    "new_data" JSONB,
    "ip" VARCHAR(45),
    "prev_hash" CHAR(64) NOT NULL,
    "curr_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personnel" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "employee_no" VARCHAR(20) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "gender" CHAR(1),
    "birth_date" DATE,
    "id_card" VARCHAR(20),
    "phone" VARCHAR(20),
    "email" VARCHAR(100),
    "education" VARCHAR(50),
    "title" VARCHAR(50),
    "cert_no" VARCHAR(50),
    "hiredate" DATE,
    "status" "PersonnelStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "personnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainings" (
    "id" UUID NOT NULL,
    "personnel_id" UUID NOT NULL,
    "training_type" VARCHAR(50) NOT NULL,
    "training_name" VARCHAR(200) NOT NULL,
    "training_date" DATE NOT NULL,
    "duration_hours" DECIMAL(5,2),
    "trainer" VARCHAR(100),
    "content" TEXT,
    "result" "TrainingResult",
    "certificate_no" VARCHAR(50),
    "certificate_file_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competencies" (
    "id" UUID NOT NULL,
    "personnel_id" UUID NOT NULL,
    "method" VARCHAR(50) NOT NULL,
    "level" VARCHAR(20) NOT NULL,
    "certified_at" DATE NOT NULL,
    "expires_at" DATE NOT NULL,
    "certified_by" UUID,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "equipment_no" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "EquipmentType" NOT NULL,
    "model" VARCHAR(100),
    "serial_no" VARCHAR(100),
    "manufacturer" VARCHAR(100),
    "purchase_date" DATE,
    "warranty_expires_at" DATE,
    "location" VARCHAR(100),
    "status" "EquipmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "accuracy" VARCHAR(50),
    "range" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calibrations" (
    "id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "calibration_date" DATE NOT NULL,
    "calibration_org" VARCHAR(200) NOT NULL,
    "certificate_no" VARCHAR(100) NOT NULL,
    "certificate_file_id" UUID,
    "result" VARCHAR(50),
    "next_due_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calibrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenances" (
    "id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "maintenance_type" VARCHAR(50) NOT NULL,
    "maintenance_date" DATE NOT NULL,
    "performed_by" UUID NOT NULL,
    "content" TEXT,
    "next_due_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodic_checks" (
    "id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "check_date" DATE NOT NULL,
    "performed_by" UUID NOT NULL,
    "result" TEXT,
    "z_score" DECIMAL(8,4),
    "passed" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodic_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "methods" (
    "id" UUID NOT NULL,
    "method_code" VARCHAR(50) NOT NULL,
    "method_name" VARCHAR(200) NOT NULL,
    "assay_type" VARCHAR(50) NOT NULL,
    "standard" VARCHAR(100),
    "scope" TEXT,
    "lod" DECIMAL(15,9),
    "loq" DECIMAL(15,9),
    "uncertainty" DECIMAL(10,6),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "effective_at" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "method_validations" (
    "id" UUID NOT NULL,
    "method_id" UUID NOT NULL,
    "validation_type" VARCHAR(50) NOT NULL,
    "parameter" VARCHAR(100) NOT NULL,
    "result" VARCHAR(100) NOT NULL,
    "acceptable" VARCHAR(100),
    "passed" BOOLEAN NOT NULL,
    "report_file_id" UUID,
    "validated_at" DATE NOT NULL,
    "validated_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "method_validations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "samples" (
    "id" UUID NOT NULL,
    "sample_no" VARCHAR(20) NOT NULL,
    "batch_id" UUID,
    "customer_name" VARCHAR(200) NOT NULL,
    "customer_ref" VARCHAR(100),
    "sample_type" "SampleType" NOT NULL,
    "declared_purity_pct" DECIMAL(10,6),
    "weight_g" DECIMAL(15,6) NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by_id" UUID,
    "storage_location" VARCHAR(200),
    "status" "SampleStatus" NOT NULL DEFAULT 'RECEIVED',
    "photo_file_ids" UUID[],
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "method_id" UUID,

    CONSTRAINT "samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_batches" (
    "id" UUID NOT NULL,
    "batch_no" VARCHAR(30) NOT NULL,
    "method" "AssayMethod" NOT NULL,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "operator_id" UUID,
    "qc_sample_id" UUID,
    "replicate_count" INTEGER NOT NULL DEFAULT 3,
    "furnace_no" VARCHAR(50),
    "status" "BatchStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sample_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tests" (
    "id" UUID NOT NULL,
    "sample_id" UUID NOT NULL,
    "batch_id" UUID,
    "method" "AssayMethod" NOT NULL,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "operator_id" UUID,
    "status" "TestStatus" NOT NULL DEFAULT 'PENDING',
    "purity_pct" DECIMAL(10,6),
    "uncertainty" DECIMAL(10,6),
    "unit" VARCHAR(20) NOT NULL DEFAULT '%',
    "qc_passed" BOOLEAN,
    "qc_remarks" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fire_assay_details" (
    "id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "sample_weight_g" DECIMAL(15,6) NOT NULL,
    "lead_button_weight_g" DECIMAL(15,6),
    "prill_weight_g" DECIMAL(15,6),
    "parting_acid" VARCHAR(50),
    "furnace_temp_c" INTEGER,
    "cupellation_min" INTEGER,
    "parting_min" INTEGER,
    "annealing_min" INTEGER,
    "qc_recovery_pct" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fire_assay_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "element_results" (
    "id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "element" VARCHAR(10) NOT NULL,
    "wavelength_nm" DECIMAL(8,3),
    "intensity" DECIMAL(15,3),
    "concentration" DECIMAL(15,9) NOT NULL,
    "unit" VARCHAR(20) NOT NULL DEFAULT 'ppm',
    "lod" DECIMAL(15,9),
    "loq" DECIMAL(15,9),
    "uncertainty" DECIMAL(15,9),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "element_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_materials" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "element" VARCHAR(10) NOT NULL,
    "certified_pct" DECIMAL(10,6) NOT NULL,
    "uncertainty" DECIMAL(10,6) NOT NULL,
    "manufacturer" VARCHAR(100),
    "certificate_file_id" UUID,
    "received_date" DATE,
    "expiry_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_measurements" (
    "id" UUID NOT NULL,
    "test_id" UUID,
    "reference_id" UUID,
    "qc_type" "QcType" NOT NULL,
    "element" VARCHAR(10) NOT NULL,
    "measured" DECIMAL(15,9) NOT NULL,
    "expected" DECIMAL(15,9),
    "sd" DECIMAL(15,9),
    "z_score" DECIMAL(8,4),
    "recovery_pct" DECIMAL(5,2),
    "westgard_rule" VARCHAR(20),
    "passed" BOOLEAN NOT NULL,
    "operator_id" UUID,
    "measured_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qc_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "report_no" VARCHAR(30) NOT NULL,
    "sample_id" UUID NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "pdf_file_id" UUID,
    "pdf_sha256" CHAR(64),
    "qr_code" TEXT,
    "summary" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "issued_at" TIMESTAMPTZ,
    "created_by_id" UUID,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_stages" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "stage" "ReportStatus" NOT NULL,
    "user_id" UUID NOT NULL,
    "comments" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_signatures" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "signer_id" UUID NOT NULL,
    "signer_role" "UserRole" NOT NULL,
    "signature_data" TEXT NOT NULL,
    "certificate_serial" VARCHAR(100) NOT NULL,
    "timestamp_token" TEXT,
    "signed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),

    CONSTRAINT "report_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reagents" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" "ReagentType" NOT NULL,
    "cas_no" VARCHAR(50),
    "purity" VARCHAR(50),
    "manufacturer" VARCHAR(100),
    "unit" VARCHAR(20) NOT NULL,
    "package_size" DECIMAL(15,6),
    "storage_condition" VARCHAR(200),
    "hazard_class" VARCHAR(50),
    "safety_stock" DECIMAL(15,6),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "reagents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reagent_lots" (
    "id" UUID NOT NULL,
    "reagent_id" UUID NOT NULL,
    "lot_no" VARCHAR(50) NOT NULL,
    "received_date" DATE NOT NULL,
    "expiry_date" DATE NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,
    "remaining_qty" DECIMAL(15,6) NOT NULL,
    "unit_price" DECIMAL(15,6),
    "supplier" VARCHAR(100),
    "certificate_file_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reagent_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reagent_usages" (
    "id" UUID NOT NULL,
    "reagent_lot_id" UUID NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,
    "test_id" UUID,
    "operator_id" UUID NOT NULL,
    "used_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,

    CONSTRAINT "reagent_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hazards" (
    "id" UUID NOT NULL,
    "source" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "HazardSeverity" NOT NULL,
    "location" VARCHAR(200),
    "reported_by_id" UUID NOT NULL,
    "reported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "HazardStatus" NOT NULL DEFAULT 'REPORTED',
    "resolved_at" TIMESTAMPTZ,
    "resolved_by_id" UUID,
    "resolution" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hazards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_plans" (
    "id" UUID NOT NULL,
    "plan_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "approved_at" TIMESTAMPTZ,
    "approved_by" UUID,
    "file_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "emergency_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_attachments" (
    "id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size" BIGINT NOT NULL,
    "category" "FileCategory" NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "equipment_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_dept_id_idx" ON "users"("dept_id");

-- CreateIndex
CREATE INDEX "users_status_deleted_at_idx" ON "users"("status", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_code_idx" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_user_id_idx" ON "user_role_assignments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_assignments_user_id_role_scope_key" ON "user_role_assignments"("user_id", "role", "scope");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_refresh_token_hash_idx" ON "user_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_table_name_record_id_idx" ON "audit_logs"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_curr_hash_idx" ON "audit_logs"("curr_hash");

-- CreateIndex
CREATE UNIQUE INDEX "personnel_user_id_key" ON "personnel"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "personnel_employee_no_key" ON "personnel"("employee_no");

-- CreateIndex
CREATE INDEX "personnel_employee_no_idx" ON "personnel"("employee_no");

-- CreateIndex
CREATE INDEX "trainings_personnel_id_idx" ON "trainings"("personnel_id");

-- CreateIndex
CREATE INDEX "trainings_training_date_idx" ON "trainings"("training_date" DESC);

-- CreateIndex
CREATE INDEX "competencies_method_expires_at_idx" ON "competencies"("method", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "competencies_personnel_id_method_key" ON "competencies"("personnel_id", "method");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_equipment_no_key" ON "equipment"("equipment_no");

-- CreateIndex
CREATE INDEX "equipment_equipment_no_idx" ON "equipment"("equipment_no");

-- CreateIndex
CREATE INDEX "equipment_type_status_idx" ON "equipment"("type", "status");

-- CreateIndex
CREATE INDEX "calibrations_equipment_id_idx" ON "calibrations"("equipment_id");

-- CreateIndex
CREATE INDEX "calibrations_next_due_date_idx" ON "calibrations"("next_due_date");

-- CreateIndex
CREATE INDEX "maintenances_equipment_id_idx" ON "maintenances"("equipment_id");

-- CreateIndex
CREATE INDEX "maintenances_maintenance_date_idx" ON "maintenances"("maintenance_date" DESC);

-- CreateIndex
CREATE INDEX "periodic_checks_equipment_id_idx" ON "periodic_checks"("equipment_id");

-- CreateIndex
CREATE INDEX "periodic_checks_check_date_idx" ON "periodic_checks"("check_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "methods_method_code_key" ON "methods"("method_code");

-- CreateIndex
CREATE INDEX "methods_method_code_idx" ON "methods"("method_code");

-- CreateIndex
CREATE INDEX "methods_assay_type_idx" ON "methods"("assay_type");

-- CreateIndex
CREATE INDEX "method_validations_method_id_idx" ON "method_validations"("method_id");

-- CreateIndex
CREATE UNIQUE INDEX "samples_sample_no_key" ON "samples"("sample_no");

-- CreateIndex
CREATE INDEX "samples_sample_no_idx" ON "samples"("sample_no");

-- CreateIndex
CREATE INDEX "samples_batch_id_idx" ON "samples"("batch_id");

-- CreateIndex
CREATE INDEX "samples_status_idx" ON "samples"("status");

-- CreateIndex
CREATE INDEX "samples_received_at_idx" ON "samples"("received_at" DESC);

-- CreateIndex
CREATE INDEX "samples_customer_name_idx" ON "samples"("customer_name");

-- CreateIndex
CREATE UNIQUE INDEX "sample_batches_batch_no_key" ON "sample_batches"("batch_no");

-- CreateIndex
CREATE INDEX "sample_batches_batch_no_idx" ON "sample_batches"("batch_no");

-- CreateIndex
CREATE INDEX "sample_batches_method_status_idx" ON "sample_batches"("method", "status");

-- CreateIndex
CREATE INDEX "sample_batches_started_at_idx" ON "sample_batches"("started_at" DESC);

-- CreateIndex
CREATE INDEX "tests_sample_id_idx" ON "tests"("sample_id");

-- CreateIndex
CREATE INDEX "tests_method_status_idx" ON "tests"("method", "status");

-- CreateIndex
CREATE INDEX "tests_operator_id_idx" ON "tests"("operator_id");

-- CreateIndex
CREATE UNIQUE INDEX "fire_assay_details_test_id_key" ON "fire_assay_details"("test_id");

-- CreateIndex
CREATE INDEX "element_results_test_id_idx" ON "element_results"("test_id");

-- CreateIndex
CREATE INDEX "element_results_element_idx" ON "element_results"("element");

-- CreateIndex
CREATE UNIQUE INDEX "reference_materials_code_key" ON "reference_materials"("code");

-- CreateIndex
CREATE INDEX "reference_materials_code_idx" ON "reference_materials"("code");

-- CreateIndex
CREATE INDEX "reference_materials_element_idx" ON "reference_materials"("element");

-- CreateIndex
CREATE INDEX "qc_measurements_test_id_idx" ON "qc_measurements"("test_id");

-- CreateIndex
CREATE INDEX "qc_measurements_reference_id_idx" ON "qc_measurements"("reference_id");

-- CreateIndex
CREATE INDEX "qc_measurements_element_measured_at_idx" ON "qc_measurements"("element", "measured_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "reports_report_no_key" ON "reports"("report_no");

-- CreateIndex
CREATE INDEX "reports_report_no_idx" ON "reports"("report_no");

-- CreateIndex
CREATE INDEX "reports_sample_id_idx" ON "reports"("sample_id");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_issued_at_idx" ON "reports"("issued_at" DESC);

-- CreateIndex
CREATE INDEX "report_stages_report_id_idx" ON "report_stages"("report_id");

-- CreateIndex
CREATE INDEX "report_stages_created_at_idx" ON "report_stages"("created_at" DESC);

-- CreateIndex
CREATE INDEX "report_signatures_report_id_idx" ON "report_signatures"("report_id");

-- CreateIndex
CREATE INDEX "report_signatures_signer_id_idx" ON "report_signatures"("signer_id");

-- CreateIndex
CREATE UNIQUE INDEX "reagents_code_key" ON "reagents"("code");

-- CreateIndex
CREATE INDEX "reagents_code_idx" ON "reagents"("code");

-- CreateIndex
CREATE INDEX "reagents_type_idx" ON "reagents"("type");

-- CreateIndex
CREATE INDEX "reagent_lots_expiry_date_idx" ON "reagent_lots"("expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "reagent_lots_reagent_id_lot_no_key" ON "reagent_lots"("reagent_id", "lot_no");

-- CreateIndex
CREATE INDEX "reagent_usages_reagent_lot_id_idx" ON "reagent_usages"("reagent_lot_id");

-- CreateIndex
CREATE INDEX "reagent_usages_test_id_idx" ON "reagent_usages"("test_id");

-- CreateIndex
CREATE INDEX "hazards_severity_status_idx" ON "hazards"("severity", "status");

-- CreateIndex
CREATE INDEX "hazards_reported_at_idx" ON "hazards"("reported_at" DESC);

-- CreateIndex
CREATE INDEX "emergency_plans_plan_type_idx" ON "emergency_plans"("plan_type");

-- CreateIndex
CREATE INDEX "file_attachments_category_idx" ON "file_attachments"("category");

-- CreateIndex
CREATE INDEX "file_attachments_sha256_idx" ON "file_attachments"("sha256");

-- CreateIndex
CREATE INDEX "file_attachments_equipment_id_idx" ON "file_attachments"("equipment_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibrations" ADD CONSTRAINT "calibrations_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodic_checks" ADD CONSTRAINT "periodic_checks_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_validations" ADD CONSTRAINT "method_validations_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "sample_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_batches" ADD CONSTRAINT "sample_batches_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fire_assay_details" ADD CONSTRAINT "fire_assay_details_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_results" ADD CONSTRAINT "element_results_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_measurements" ADD CONSTRAINT "qc_measurements_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_measurements" ADD CONSTRAINT "qc_measurements_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "reference_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "samples"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_stages" ADD CONSTRAINT "report_stages_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_signatures" ADD CONSTRAINT "report_signatures_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_signatures" ADD CONSTRAINT "report_signatures_signer_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reagent_lots" ADD CONSTRAINT "reagent_lots_reagent_id_fkey" FOREIGN KEY ("reagent_id") REFERENCES "reagents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

