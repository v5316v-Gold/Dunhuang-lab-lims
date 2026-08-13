-- =====================================================
-- Phase 0.5 Task C — 挂载 audit_trigger 到所有业务表
-- 详见 ADR-0003:审计链 = PG 触发器(非应用层)
--
-- Phase 0 已挂(本脚本不再覆盖): 
--   equipment, reports, sample_batches, samples, tests, users (6 张)
-- 本脚本补挂(21 张): 
--   calibrations, competencies, departments, element_results,
--   emergency_plans, file_attachments, fire_assay_details, hazards,
--   maintenances, method_validations, methods, periodic_checks,
--   personnel, qc_measurements, reagent_lots, reagent_usages,
--   reagents, reference_materials, report_signatures, report_stages, trainings
--
-- 设计:每张表 AFTER INSERT/UPDATE/DELETE 触发 audit_trigger(),
--      写入 audit_logs + SHA256 链
-- 幂等:DROP TRIGGER IF EXISTS + CREATE TRIGGER
-- 执行:psql ... -f audit_chain_triggers.sql
-- =====================================================

SET search_path = public;

-- calibrations
DROP TRIGGER IF EXISTS trg_audit_calibrations ON calibrations;
CREATE TRIGGER trg_audit_calibrations
AFTER INSERT OR UPDATE OR DELETE ON calibrations
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- competencies
DROP TRIGGER IF EXISTS trg_audit_competencies ON competencies;
CREATE TRIGGER trg_audit_competencies
AFTER INSERT OR UPDATE OR DELETE ON competencies
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- departments
DROP TRIGGER IF EXISTS trg_audit_departments ON departments;
CREATE TRIGGER trg_audit_departments
AFTER INSERT OR UPDATE OR DELETE ON departments
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- element_results
DROP TRIGGER IF EXISTS trg_audit_element_results ON element_results;
CREATE TRIGGER trg_audit_element_results
AFTER INSERT OR UPDATE OR DELETE ON element_results
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- emergency_plans
DROP TRIGGER IF EXISTS trg_audit_emergency_plans ON emergency_plans;
CREATE TRIGGER trg_audit_emergency_plans
AFTER INSERT OR UPDATE OR DELETE ON emergency_plans
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- file_attachments
DROP TRIGGER IF EXISTS trg_audit_file_attachments ON file_attachments;
CREATE TRIGGER trg_audit_file_attachments
AFTER INSERT OR UPDATE OR DELETE ON file_attachments
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- fire_assay_details
DROP TRIGGER IF EXISTS trg_audit_fire_assay_details ON fire_assay_details;
CREATE TRIGGER trg_audit_fire_assay_details
AFTER INSERT OR UPDATE OR DELETE ON fire_assay_details
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- hazards
DROP TRIGGER IF EXISTS trg_audit_hazards ON hazards;
CREATE TRIGGER trg_audit_hazards
AFTER INSERT OR UPDATE OR DELETE ON hazards
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- maintenances
DROP TRIGGER IF EXISTS trg_audit_maintenances ON maintenances;
CREATE TRIGGER trg_audit_maintenances
AFTER INSERT OR UPDATE OR DELETE ON maintenances
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- method_validations
DROP TRIGGER IF EXISTS trg_audit_method_validations ON method_validations;
CREATE TRIGGER trg_audit_method_validations
AFTER INSERT OR UPDATE OR DELETE ON method_validations
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- methods
DROP TRIGGER IF EXISTS trg_audit_methods ON methods;
CREATE TRIGGER trg_audit_methods
AFTER INSERT OR UPDATE OR DELETE ON methods
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- periodic_checks
DROP TRIGGER IF EXISTS trg_audit_periodic_checks ON periodic_checks;
CREATE TRIGGER trg_audit_periodic_checks
AFTER INSERT OR UPDATE OR DELETE ON periodic_checks
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- personnel
DROP TRIGGER IF EXISTS trg_audit_personnel ON personnel;
CREATE TRIGGER trg_audit_personnel
AFTER INSERT OR UPDATE OR DELETE ON personnel
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- qc_measurements
DROP TRIGGER IF EXISTS trg_audit_qc_measurements ON qc_measurements;
CREATE TRIGGER trg_audit_qc_measurements
AFTER INSERT OR UPDATE OR DELETE ON qc_measurements
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- reagent_lots
DROP TRIGGER IF EXISTS trg_audit_reagent_lots ON reagent_lots;
CREATE TRIGGER trg_audit_reagent_lots
AFTER INSERT OR UPDATE OR DELETE ON reagent_lots
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- reagent_usages
DROP TRIGGER IF EXISTS trg_audit_reagent_usages ON reagent_usages;
CREATE TRIGGER trg_audit_reagent_usages
AFTER INSERT OR UPDATE OR DELETE ON reagent_usages
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- reagents
DROP TRIGGER IF EXISTS trg_audit_reagents ON reagents;
CREATE TRIGGER trg_audit_reagents
AFTER INSERT OR UPDATE OR DELETE ON reagents
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- reference_materials
DROP TRIGGER IF EXISTS trg_audit_reference_materials ON reference_materials;
CREATE TRIGGER trg_audit_reference_materials
AFTER INSERT OR UPDATE OR DELETE ON reference_materials
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- report_signatures
DROP TRIGGER IF EXISTS trg_audit_report_signatures ON report_signatures;
CREATE TRIGGER trg_audit_report_signatures
AFTER INSERT OR UPDATE OR DELETE ON report_signatures
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- report_stages
DROP TRIGGER IF EXISTS trg_audit_report_stages ON report_stages;
CREATE TRIGGER trg_audit_report_stages
AFTER INSERT OR UPDATE OR DELETE ON report_stages
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- trainings
DROP TRIGGER IF EXISTS trg_audit_trainings ON trainings;
CREATE TRIGGER trg_audit_trainings
AFTER INSERT OR UPDATE OR DELETE ON trainings
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DO $$
BEGIN
  RAISE NOTICE 'Phase 0.5 Task C: 已挂载 21 张业务表 audit trigger';
END $$;
