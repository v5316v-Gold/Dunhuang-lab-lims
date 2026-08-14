/**
 * 材料类型枚举 - 8 种
 * 依据: lims-cnas-architecture.md §4.1
 *
 * 8 种材料类型: 高纯金属 合金 矿石 精矿 粗炼产品 二次资源 镀层 化合物
 */

window.LIMS_ENUMS_MATERIAL_TYPES = [
  { code: 'PURE_METAL',  name: '高纯金属'  },
  { code: 'ALLOY',       name: '合金'      },
  { code: 'ORE',         name: '矿石'      },
  { code: 'CONCENTRATE', name: '精矿'      },
  { code: 'CRUDE_PRODUCT', name: '粗炼产品' },
  { code: 'SECONDARY',   name: '二次资源'  },
  { code: 'COATING',     name: '镀层'      },
  { code: 'COMPOUND',    name: '化合物'    }
];

if (window.LIMS_ENUMS) {
  window.LIMS_ENUMS.materialTypes = {
    ALL: window.LIMS_ENUMS_MATERIAL_TYPES,
    byCode: function(code) {
      return window.LIMS_ENUMS_MATERIAL_TYPES.find(function(m) { return m.code === code; });
    }
  };
}
