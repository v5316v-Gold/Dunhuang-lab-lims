-- W+2-4: 临时授权(CNAS §7.2)
-- ============================================

-- CreateTable
CREATE TABLE "temporary_authorizations" (
    "id" UUID NOT NULL,
    "authNo" VARCHAR(50) NOT NULL,
    "grantor_id" UUID NOT NULL,
    "grantee_id" UUID NOT NULL,
    "method" VARCHAR(50) NOT NULL,
    "effective_from" TIMESTAMPTZ NOT NULL,
    "effective_to" TIMESTAMPTZ NOT NULL,
    "reason" VARCHAR(200),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "revoked_by_id" UUID,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "temporary_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "temporary_authorizations_authNo_key" ON "temporary_authorizations"("authNo");

-- CreateIndex
CREATE INDEX "temporary_authorizations_authNo_idx" ON "temporary_authorizations"("authNo");

-- CreateIndex
CREATE INDEX "temporary_authorizations_grantee_id_idx" ON "temporary_authorizations"("grantee_id");

-- CreateIndex
CREATE INDEX "temporary_authorizations_effective_from_effective_to_idx" ON "temporary_authorizations"("effective_from", "effective_to");

-- AddForeignKey
ALTER TABLE "temporary_authorizations" ADD CONSTRAINT "temporary_authorizations_grantor_id_fkey" FOREIGN KEY ("grantor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temporary_authorizations" ADD CONSTRAINT "temporary_authorizations_grantee_id_fkey" FOREIGN KEY ("grantee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temporary_authorizations" ADD CONSTRAINT "temporary_authorizations_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

