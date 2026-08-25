/**
 * 2026-08-11 阶段 3 - 设备协议适配器
 * 借鉴金现代 LIMS 日照钢铁案例：AI-OCR + 设备对接
 */

class DeviceProtocol {
  constructor(config) {
    this.config = config;
    this.lastReading = null;
  }
  async read() { throw new Error('子类必须实现 read()'); }
  parse(raw) { throw new Error('子类必须实现 parse()'); }
  async ping() { return { status: 'ok', protocol: this.config.protocol }; }
}

class ICPMSProtocol extends DeviceProtocol {
  async read() { return this.simulateReading(); }
  parse(raw) {
    const lines = raw.trim().split('\n');
    return lines.map(line => {
      const parts = line.split('\t');
      return {
        element: parts[0]?.trim(),
        value: parseFloat(parts[1]),
        unit: parts[2]?.trim(),
        timestamp: parts[3] ? new Date(parts[3].trim()) : new Date()
      };
    });
  }
  simulateReading() {
    const data = [
      { element: 'Au', value: 10.523, unit: 'ppm' },
      { element: 'Ag', value: 2.145, unit: 'ppm' },
      { element: 'Cu', value: 0.523, unit: 'ppm' }
    ];
    return data.map(r => `${r.element}\t${r.value}\t${r.unit}\t${new Date().toISOString()}`).join('\n');
  }
}

class AASProtocol extends DeviceProtocol {
  async read() { return `${this.config.element || 'Au'}\t${(10 + Math.random()).toFixed(3)}\tppm`; }
  parse(raw) {
    const [element, value, unit] = raw.split('\t');
    return [{ element, value: parseFloat(value), unit, timestamp: new Date() }];
  }
}

class XRFProtocol extends DeviceProtocol {
  async read() {
    return JSON.stringify({
      Au: 10.523, Ag: 2.145, Cu: 0.523, Fe: 5.21,
      unit: 'ppm', timestamp: new Date()
    });
  }
  parse(raw) {
    const data = JSON.parse(raw);
    return Object.entries(data).filter(([k]) => k !== 'unit' && k !== 'timestamp')
      .map(([element, value]) => ({ element, value, unit: data.unit, timestamp: new Date(data.timestamp) }));
  }
}

class SimulateProtocol extends DeviceProtocol {
  constructor(config) {
    super(config);
    this.simulatedValues = config.simulatedValues || { Au: 10.5 };
    this.noise = config.noise || 0.05;
  }
  async read() {
    const result = {};
    for (const [el, v] of Object.entries(this.simulatedValues)) {
      const noise = (Math.random() - 0.5) * 2 * this.noise;
      result[el] = +(v * (1 + noise)).toFixed(3);
    }
    return JSON.stringify({ ...result, unit: 'ppm', timestamp: new Date() });
  }
  parse(raw) {
    const data = JSON.parse(raw);
    return Object.entries(data).filter(([k]) => k !== 'unit' && k !== 'timestamp')
      .map(([element, value]) => ({ element, value, unit: data.unit, timestamp: new Date(data.timestamp) }));
  }
}

class ProtocolFactory {
  static create(config) {
    const p = (config.protocol || 'SIMULATE').toUpperCase();
    if (p === 'ICP-MS') return new ICPMSProtocol(config);
    if (p === 'AAS') return new AASProtocol(config);
    if (p === 'XRF') return new XRFProtocol(config);
    return new SimulateProtocol(config);
  }
}

module.exports = { DeviceProtocol, ICPMSProtocol, AASProtocol, XRFProtocol, SimulateProtocol, ProtocolFactory };
