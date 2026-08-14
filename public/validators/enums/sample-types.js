/**
 * 样品形态枚举 - 8 种
 * 依据: lims-cnas-architecture.md §4.1
 *
 * 8 种样品形态: 块状 粉状 颗粒 箔 丝 溶液 镀件 屑
 */

window.LIMS_ENUMS_SAMPLE_FORMS = [
  { code: 'BULK',    name: '块状'  },
  { code: 'POWDER',  name: '粉状'  },
  { code: 'GRAIN',   name: '颗粒'  },
  { code: 'FOIL',    name: '箔'    },
  { code: 'WIRE',    name: '丝'    },
  { code: 'SOLUTION', name: '溶液' },
  { code: 'PLATING', name: '镀件'  },
  { code: 'CHIP',    name: '屑'    }
];

if (window.LIMS_ENUMS) {
  window.LIMS_ENUMS.sampleForms = {
    ALL: window.LIMS_ENUMS_SAMPLE_FORMS,
    byCode: function(code) {
      return window.LIMS_ENUMS_SAMPLE_FORMS.find(function(s) { return s.code === code; });
    }
  };
}
