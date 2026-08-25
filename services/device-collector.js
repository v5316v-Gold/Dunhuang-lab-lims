/**
 * 2026-08-11 阶段 3 - 设备数据采集服务
 */
const { ProtocolFactory } = require('./device-adapter');

class DeviceCollector {
  constructor() {
    this.devices = new Map();
    this.collectInterval = 60 * 1000;
    this.timer = null;
    this.listeners = [];
    this.lastReadings = new Map();
  }
  registerDevice(config) {
    const protocol = ProtocolFactory.create(config);
    this.devices.set(config.id, { config, protocol });
    console.log('[DeviceCollector] 已注册: ' + config.name + ' (' + config.protocol + ')');
  }
  start() {
    if (this.timer) return;
    console.log('[DeviceCollector] 启动数据采集（' + this.collectInterval / 1000 + 's）');
    this.collect();
    this.timer = setInterval(() => this.collect(), this.collectInterval);
  }
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  async collect() {
    for (const [deviceId, { config, protocol }] of this.devices) {
      try {
        const raw = await protocol.read();
        const data = protocol.parse(raw);
        this.lastReadings.set(deviceId, { data, timestamp: new Date(), deviceId, deviceName: config.name });
        this.listeners.forEach(fn => fn({ deviceId, deviceName: config.name, data, timestamp: new Date() }));
      } catch (e) {
        console.error('[DeviceCollector] ' + deviceId + ' 失败: ' + e.message);
      }
    }
  }
  async readDevice(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) throw new Error('设备未注册');
    const raw = await device.protocol.read();
    const data = device.protocol.parse(raw);
    return { deviceId, deviceName: device.config.name, data, timestamp: new Date() };
  }
  onData(callback) { this.listeners.push(callback); }
  getLastReading(deviceId) { return this.lastReadings.get(deviceId); }
  listDevices() {
    return Array.from(this.devices.entries()).map(([id, { config }]) => ({ id, ...config }));
  }
}

module.exports = DeviceCollector;
