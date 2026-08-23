-- W3-B 看板 KPI 物化快照表
CREATE TABLE "kpi_snapshots" (
  "id" BIGSERIAL NOT NULL,
  "metric_key" VARCHAR(50) NOT NULL,
  "metric_name" VARCHAR(100) NOT NULL,
  "value" DECIMAL(15,2) NOT NULL,
  "unit" VARCHAR(20) NOT NULL DEFAULT '',
  "period" VARCHAR(20) NOT NULL,
  "computed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kpi_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "kpi_snapshots_metric_key_computed_at_idx" ON "kpi_snapshots"("metric_key", "computed_at");
CREATE INDEX "kpi_snapshots_period_computed_at_idx" ON "kpi_snapshots"("period", "computed_at");
