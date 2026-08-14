/**
 * 贵金属枚举 - 8 种
 * 依据: lims-cnas-architecture.md §4.1
 *
 * 8 种贵金属: Au(金) Ag(银) Pt(铂) Pd(钯) Rh(铑) Ir(铱) Ru(钌) Os(锇)
 */

window.LIMS_ENUMS_PRECIOUS_METALS = [
  { code: 'Au',  symbol: 'Au', name: '金',   atomicNumber: 79  },
  { code: 'Ag',  symbol: 'Ag', name: '银',   atomicNumber: 47  },
  { code: 'Pt',  symbol: 'Pt', name: '铂',   atomicNumber: 78  },
  { code: 'Pd',  symbol: 'Pd', name: '钯',   atomicNumber: 46  },
  { code: 'Rh',  symbol: 'Rh', name: '铑',   atomicNumber: 45  },
  { code: 'Ir',  symbol: 'Ir', name: '铱',   atomicNumber: 77  },
  { code: 'Ru',  symbol: 'Ru', name: '钌',   atomicNumber: 44  },
  { code: 'Os',  symbol: 'Os', name: '锇',   atomicNumber: 76  }
];

/**
 * 工具函数
 */
window.LIMS_ENUMS = window.LIMS_ENUMS || {};
window.LIMS_ENUMS.metals = {
  ALL: window.LIMS_ENUMS_PRECIOUS_METALS,
  byCode: function(code) {
    return window.LIMS_ENUMS_PRECIOUS_METALS.find(function(m) { return m.code === code; });
  },
  bySymbol: function(symbol) {
    return window.LIMS_ENUMS_PRECIOUS_METALS.find(function(m) { return m.symbol === symbol; });
  }
};
