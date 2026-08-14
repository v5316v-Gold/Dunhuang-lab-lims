/**
 * 检测方法枚举 - 7 种
 * 依据: lims-cnas-architecture.md §4.3, §4.4
 *
 * 7 种检测方法: 火试金 ICP-OES ICP-MS XRF AAS 重量法 分光光度法
 */

window.LIMS_ENUMS_DETECTION_METHODS = [
  { code: 'FIRE_ASSAY',   name: '火试金',      abbreviation: 'FA'   },
  { code: 'ICP_OES',      name: 'ICP-OES',     abbreviation: 'OES'  },
  { code: 'ICP_MS',       name: 'ICP-MS',      abbreviation: 'MS'   },
  { code: 'XRF',          name: 'XRF',         abbreviation: 'XRF'  },
  { code: 'AAS',          name: 'AAS',         abbreviation: 'AAS'  },
  { code: 'GRAVIMETRY',   name: '重量法',      abbreviation: 'GRV'  },
  { code: 'SPECTROPHOTO', name: '分光光度法',  abbreviation: 'UV'   }
];

if (window.LIMS_ENUMS) {
  window.LIMS_ENUMS.detectionMethods = {
    ALL: window.LIMS_ENUMS_DETECTION_METHODS,
    byCode: function(code) {
      return window.LIMS_ENUMS_DETECTION_METHODS.find(function(m) { return m.code === code; });
    }
  };
}
