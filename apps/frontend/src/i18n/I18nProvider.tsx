// =====================================================
// W5 i18n(中英双语) - 纯 Context + 字典,零依赖
// =====================================================

import { createContext, useContext, useState, ReactNode } from 'react';

export type Lang = 'zh' | 'en';

const DICT: Record<Lang, Record<string, string>> = {
  zh: {
    'nav.dashboard': '仪表盘',
    'nav.samples': '样品管理',
    'nav.batches': '批次管理',
    'nav.tests': '检测任务',
    'nav.reports': '检测报告',
    'nav.equipment': '设备管理',
    'nav.personnel': '人员管理',
    'nav.reagents': '试剂库存',
    'nav.gas': '气体管理',
    'nav.waste': '危废管理',
    'nav.container': '容器管理',
    'nav.precious': '贵金属业务',
    'nav.qc': 'QC 监控',
    'nav.audit': '审计日志',
    'common.system': '敦煌金质检 LIMS',
    'common.cnas': 'CNAS 合规实验室信息管理系统',
    'common.login': '登 录',
    'common.logout': '退出登录',
    'common.summary': '合规摘要',
    'common.create': '创建',
    'common.createRecord': '取样登记',
    'common.scan': '扫码追溯',
    'common.transfer': '转移',
    'common.dispose': '处置',
    'common.borrow': '领用',
    'common.purchase': '采购',
    'common.return': '归还',
    'common.accepted': '已验收',
    'common.rejected': '已拒收',
    'common.ordered': '已下单',
    'common.inspection': '合规摘要',
    'common.notFound': '不存在',
    'common.unknownError': '未知错误',
    'common.lastUpdate': '最后更新',
    'common.refresh': '刷新',
    'common.search': '搜索',
    'common.export': '导出',
    'common.compliance': '合规率',
    'common.health': '健康率',
    'common.usageRate': '使用率',
    'common.lowStockAlert': '低库存预警',
    'common.activeGases': '活跃气体',
    'common.totalGases': '气体总数',
    'common.totalPurchases': '采购总数',
    'common.totalUsages': '使用记录',
    'common.totalBars': '条码总数',
    'common.totalSampling': '取样记录',
    'common.totalContainers': '容器总数',
    'common.inUse': '使用中',
    'common.notReturned': '未归还',
    'common.needsCalibration': '需校准',
    'common.weight': '重量',
    'common.purity': '纯度',
    'common.grade': '成色',
    'common.location': '位置',
    'common.status': '状态',
    'common.quantity': '数量',
    'common.total': '总计',
    'common.alert': '告警',
    'common.realtimeCenter': '实时事件中心',
    'common.connected': '已连接',
    'common.disconnected': '已断开',
    'common.noEvents': '暂无事件',
    'common.realtimeHint': 'W5 实时事件中心',
    'compliance.title': '合规摘要',
    'dashboard.title': '仪表盘',
  },
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.samples': 'Samples',
    'nav.batches': 'Batches',
    'nav.tests': 'Tests',
    'nav.reports': 'Reports',
    'nav.equipment': 'Equipment',
    'nav.personnel': 'Personnel',
    'nav.reagents': 'Reagents',
    'nav.gas': 'Gas',
    'nav.waste': 'Waste',
    'nav.container': 'Containers',
    'nav.precious': 'Precious Metal',
    'nav.qc': 'QC',
    'nav.audit': 'Audit Log',
    'common.system': 'Dunhuang LIMS',
    'common.cnas': 'CNAS Compliant LIMS',
    'common.login': 'Login',
    'common.logout': 'Logout',
    'common.summary': 'Summary',
    'common.create': 'Create',
    'common.createRecord': 'New Record',
    'common.scan': 'Scan',
    'common.transfer': 'Transfer',
    'common.dispose': 'Dispose',
    'common.borrow': 'Borrow',
    'common.purchase': 'Purchase',
    'common.return': 'Return',
    'common.accepted': 'Inspected',
    'common.rejected': 'Rejected',
    'common.ordered': 'Ordered',
    'common.inspection': 'Inspection',
    'common.notFound': 'Not Found',
    'common.unknownError': 'Unknown Error',
    'common.lastUpdate': 'Last Updated',
    'common.refresh': 'Refresh',
    'common.search': 'Search',
    'common.export': 'Export',
    'common.compliance': 'Compliance',
    'common.health': 'Health',
    'common.usageRate': 'Usage',
    'common.lowStockAlert': 'Low Stock Alert',
    'common.activeGases': 'Active Gases',
    'common.totalGases': 'Total Gases',
    'common.totalPurchases': 'Total Purchases',
    'common.totalUsages': 'Total Usages',
    'common.totalBars': 'Total Bars',
    'common.totalSampling': 'Total Sampling',
    'common.totalContainers': 'Total Containers',
    'common.inUse': 'In Use',
    'common.notReturned': 'Not Returned',
    'common.needsCalibration': 'Needs Calibration',
    'common.weight': 'Weight',
    'common.purity': 'Purity',
    'common.grade': 'Grade',
    'common.location': 'Location',
    'common.status': 'Status',
    'common.quantity': 'Quantity',
    'common.total': 'Total',
    'common.alert': 'Alert',
    'common.realtimeCenter': 'Realtime Center',
    'common.connected': 'Connected',
    'common.disconnected': 'Disconnected',
    'common.noEvents': 'No Events',
    'common.realtimeHint': 'W5 Realtime Events',
    'compliance.title': 'Compliance Summary',
    'dashboard.title': 'Dashboard',
  },
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nCtx>({
  lang: 'zh',
  setLang: () => {},
  t: (k: string) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) ?? 'zh');
  const value: I18nCtx = {
    lang,
    setLang: (l: Lang) => {
      localStorage.setItem('lang', l);
      setLang(l);
    },
    t: (k: string) => DICT[lang][k] ?? DICT.zh[k] ?? k,
  };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}