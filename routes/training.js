const express = require('express');
const { TrainingAnnualCreateSchema, TrainingRecordCreateSchema, validate } = require('../validators/schemas');

const router = express.Router();

module.exports = router;

// GET /api/training-annual
router.get('/annual', requireAuth, (req, res) => {
  const sql = `SELECT ta.*, d.name as dept_name
              FROM training_annual_plan ta
              LEFT JOIN departments d ON ta.dept_id=d.id`;
  queryAll(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

// POST /api/training-annual
router.post('/annual', requireAuth, validate(TrainingAnnualCreateSchema), (req, res) => {
  const { year, dept_id, total_plan, total_actual, plan_target, actual_target } = req.body;
  const sql = `INSERT INTO training_annual_plan (year, dept_id, total_plan, total_actual, plan_target, actual_target)
               VALUES (?, ?, ?, ?, ?, ?)`;
  run(sql, [year, dept_id, total_plan, total_actual, plan_target, actual_target], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// PUT /api/training-annual/:id
router.put('/annual/:id', requireAuth, validate(TrainingAnnualCreateSchema), (req, res) => {
  const { year, dept_id, total_plan, total_actual, plan_target, actual_target } = req.body;
  const sql = `UPDATE training_annual_plan SET year=?, dept_id=?, total_plan=?, total_actual=?, plan_target=?, actual_target=? WHERE id=?`;
  run(sql, [year, dept_id, total_plan, total_actual, plan_target, actual_target, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ changes: this.changes });
  });
});

// DELETE /api/training-annual/:id
router.delete('/annual/:id', requireAuth, (req, res) => {
  const sql = 'DELETE FROM training_annual_plan WHERE id=?';
  run(sql, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ changes: this.changes });
  });
});

// GET /api/training-records
router.get('/records', requireAuth, (req, res) => {
  const sql = `SELECT tr.*, u.name as employee_name
              FROM training_records tr
              LEFT JOIN users u ON tr.employee_id=u.id`;
  queryAll(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

// POST /api/training-records
router.post('/records', requireAuth, validate(TrainingRecordCreateSchema), (req, res) => {
  const { employee_id, training_date, training_type, training_content, training_hours, trainer, assessment_result, certificate_no, valid_date, remark } = req.body;
  const sql = `INSERT INTO training_records (employee_id, training_date, training_type, training_content, training_hours, trainer, assessment_result, certificate_no, valid_date, remark)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  run(sql, [employee_id, training_date, training_type, training_content, training_hours, trainer, assessment_result, certificate_no, valid_date, remark], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// DELETE /api/training-records/:id
router.delete('/records/:id', requireAuth, (req, res) => {
  const sql = 'DELETE FROM training_records WHERE id=?';
  run(sql, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ changes: this.changes });
  });
});