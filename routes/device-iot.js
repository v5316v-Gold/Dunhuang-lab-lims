const express = require('express');
const router = express.Router();
const DeviceCollector = require('../services/device-collector');

const collector = new DeviceCollector();

// 演示设备
function initDemoDevices() {
  collector.registerDevice({ id: 1, name: 'iCAP RQ 电感耦合等离子体质谱仪', protocol: 'ICP-MS', port: 'COM3', baudRate: 9600, location: '仪器室A' });
  collector.registerDevice({ id: 2, name: 'PinAAcle 900T 火焰原子吸收', protocol: 'AAS', port: 'COM4', baudRate: 19200, location: '仪器室B' });
  collector.registerDevice({ id: 3, name: 'AFS-933 原子荧光光度计', protocol: 'SIMULATE', simulatedValues: { As: 0.05, Hg: 0.02 }, location: '化学室A' });
  collector.registerDevice({ id: 4, name: 'S8 TIGER X射线荧光光谱仪', protocol: 'XRF', port: '192.168.1.100', location: '仪器室F' });
  collector.start();
}
initDemoDevices();

router.get('/devices/iot', requireAuth, (req, res) => {
  res.json({ success: true, data: collector.listDevices() });
});

router.get('/devices/iot/:id/read', requireAuth, async (req, res) => {
  try { res.json({ success: true, data: await collector.readDevice(parseInt(req.params.id)) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/devices/iot/readings', requireAuth, (req, res) => {
  const data = {};
  for (const [id, r] of collector.lastReadings) data[id] = r;
  res.json({ success: true, data });
});

// AI-OCR 识别（演示）
router.post('/devices/ocr-recognize', requireAuth, (req, res) => {
  try {
    const { device_type, expected_unit } = req.body;
    const mockResults = {
      'AAS': [{ element: 'Au', value: 10.523, unit: 'ppm' }, { element: 'Ag', value: 2.145, unit: 'ppm' }],
      'ICP-MS': [{ element: 'Au', value: 10.523, unit: 'ppm' }, { element: 'Ag', value: 2.145, unit: 'ppm' }, { element: 'Cu', value: 0.523, unit: 'ppm' }],
      'FAAS': [{ element: 'Au', value: 10.5, unit: 'ppm' }],
      'XRF': [{ element: 'Au', value: 10.52, unit: 'ppm' }, { element: 'Ag', value: 2.14, unit: 'ppm' }, { element: 'Cu', value: 0.52, unit: 'ppm' }, { element: 'Fe', value: 5.21, unit: 'ppm' }]
    };
    const recognized = mockResults[device_type] || [{ element: 'Au', value: 10.5, unit: 'ppm' }];
    res.json({ success: true, recognized, device_type, confidence: 0.95, ocr_engine: 'mock (production: Tesseract.js / Baidu OCR)', timestamp: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/devices/iot/control', requireAuth, async (req, res) => {
  const { action } = req.body;
  if (action === 'start') { collector.start(); res.json({ success: true, status: 'started' }); }
  else if (action === 'stop') { collector.stop(); res.json({ success: true, status: 'stopped' }); }
  else if (action === 'collect') {
    await collector.collect();
    const data = {};
    for (const [id, r] of collector.lastReadings) data[id] = r;
    res.json({ success: true, data });
  } else { res.status(400).json({ error: '无效 action' }); }
});

module.exports = router;
