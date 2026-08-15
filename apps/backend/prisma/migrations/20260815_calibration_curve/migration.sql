-- W+2-3: ElementResult 校准曲线 R² + 曲线附件
-- ============================================

-- AlterTable
ALTER TABLE "element_results" ADD COLUMN     "calibration_curve_file_id" UUID,
ADD COLUMN     "calibration_r2" DECIMAL(8,6);

