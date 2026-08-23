// =====================================================
// Ant Design 主题 — 新中式奢华科技风(墨黑 + 辉金)
// 依据: docs/UI-DESIGN-PARAMS.md §10 (Shadcn 变量映射) + 2026-08-16 参数表
// 与 src/styles/design-tokens.css 保持单一真源对齐
// 使用: <ConfigProvider theme={antdTheme}>
// =====================================================

import type { ThemeConfig } from 'antd';

// 与 design-tokens.css 对应的 JS 常量(改动需两处同步)
export const DESIGN_TOKENS = {
  gold: '#d4af37',
  goldBright: '#f5d76e',
  goldHover: '#e5c158',
  goldDark: '#8b6914',
  bgPrimary: '#08080a',
  bgSecondary: '#0e0e12',
  bgTertiary: '#16161c',
  bgCard: '#111115',
  bgHover: '#1c1c24',
  bgActive: '#242430',
  bgElevated: '#1a1a22',
  borderColor: '#252530',
  borderLight: '#35354a',
  textPrimary: '#f8f6f0',
  textSecondary: '#b8b4a8',
  textMuted: '#6a6860',
  textDim: '#454540',
  success: '#4a9a7a',   // 翠玉绿
  error: '#b85450',     // 朱砂红
  warning: '#c49a3a',   // 琥珀黄
  info: '#5a7ab8',      // 青花蓝
} as const;

export const antdTheme: ThemeConfig = {
  token: {
    // 主色系(辉金)
    colorPrimary: DESIGN_TOKENS.gold,
    colorInfo: DESIGN_TOKENS.gold,
    colorSuccess: DESIGN_TOKENS.success,
    colorError: DESIGN_TOKENS.error,
    colorWarning: DESIGN_TOKENS.warning,

    // 背景层次(墨黑)
    colorBgBase: DESIGN_TOKENS.bgPrimary,
    colorBgContainer: DESIGN_TOKENS.bgCard,
    colorBgElevated: DESIGN_TOKENS.bgElevated,
    colorBgLayout: DESIGN_TOKENS.bgPrimary,
    colorBgSpotlight: DESIGN_TOKENS.bgActive,

    // 文字层次(象牙白灰阶)
    colorText: DESIGN_TOKENS.textPrimary,
    colorTextSecondary: DESIGN_TOKENS.textSecondary,
    colorTextTertiary: DESIGN_TOKENS.textMuted,
    colorTextQuaternary: DESIGN_TOKENS.textDim,

    // 边框
    colorBorder: DESIGN_TOKENS.borderColor,
    colorBorderSecondary: DESIGN_TOKENS.borderLight,
    colorSplit: DESIGN_TOKENS.borderColor,

    // 交互
    colorPrimaryHover: DESIGN_TOKENS.goldHover,
    colorPrimaryActive: DESIGN_TOKENS.goldBright,
    colorBgTextHover: DESIGN_TOKENS.bgHover,
    colorFillTertiary: DESIGN_TOKENS.bgHover,

    // 链接
    colorLink: DESIGN_TOKENS.gold,
    colorLinkHover: DESIGN_TOKENS.goldHover,

    // 几何与字号
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    fontSize: 15,      // 组件基线 15px(按钮/表格/菜单/表单)
    fontSizeSM: 13,    // 小号(标签/提示)
    fontSizeLG: 17,    // 大号(统计数字/强调)
    lineHeight: 1.6,
  },
  components: {
    Layout: {
      headerBg: DESIGN_TOKENS.bgSecondary,
      siderBg: DESIGN_TOKENS.bgSecondary,
      bodyBg: DESIGN_TOKENS.bgPrimary,
      headerHeight: 56,
      headerPadding: '0 24px',
    },
    Menu: {
      darkItemBg: DESIGN_TOKENS.bgSecondary,
      darkItemSelectedBg: 'rgba(212, 175, 55, 0.12)', // gold-muted
      darkItemSelectedColor: DESIGN_TOKENS.gold,
      darkItemHoverBg: DESIGN_TOKENS.bgHover,
      darkItemColor: DESIGN_TOKENS.textSecondary,
      itemBorderRadius: 8,
      itemMarginInline: 8,
      itemHeight: 44,
    },
    Table: {
      headerBg: DESIGN_TOKENS.bgTertiary,
      headerColor: DESIGN_TOKENS.textSecondary,
      rowHoverBg: DESIGN_TOKENS.bgHover,
      borderColor: DESIGN_TOKENS.borderColor,
      colorBgContainer: 'transparent',
      headerSplitColor: 'rgba(212, 175, 55, 0.2)',
    },
    Card: {
      colorBgContainer: DESIGN_TOKENS.bgCard,
      headerBg: 'transparent',
    },
    Modal: {
      contentBg: DESIGN_TOKENS.bgCard,
      headerBg: DESIGN_TOKENS.bgCard,
      titleColor: DESIGN_TOKENS.textPrimary,
    },
    Drawer: {
      colorBgElevated: DESIGN_TOKENS.bgCard,
    },
    Message: {
      contentBg: DESIGN_TOKENS.bgElevated,
      colorText: DESIGN_TOKENS.textPrimary,
      borderRadiusLG: 8,
    },
    Notification: {
      colorBgElevated: DESIGN_TOKENS.bgElevated,
    },
    Tooltip: {
      colorBgSpotlight: DESIGN_TOKENS.bgActive,
      colorText: DESIGN_TOKENS.textPrimary,
    },
    Popover: {
      colorBgElevated: DESIGN_TOKENS.bgElevated,
    },
    Dropdown: {
      colorBgElevated: DESIGN_TOKENS.bgElevated,
      colorText: DESIGN_TOKENS.textSecondary,
    },
    Input: {
      colorBgContainer: DESIGN_TOKENS.bgTertiary,
      colorBorder: DESIGN_TOKENS.borderColor,
      colorText: DESIGN_TOKENS.textPrimary,
      activeBorderColor: DESIGN_TOKENS.gold,
      hoverBorderColor: DESIGN_TOKENS.borderLight,
      activeShadow: '0 0 0 3px rgba(212, 175, 55, 0.12)',
    },
    Select: {
      colorBgContainer: DESIGN_TOKENS.bgTertiary,
      colorBorder: DESIGN_TOKENS.borderColor,
      optionSelectedBg: 'rgba(212, 175, 55, 0.12)',
      optionSelectedColor: DESIGN_TOKENS.gold,
      selectorBg: DESIGN_TOKENS.bgTertiary,
    },
    DatePicker: {
      colorBgContainer: DESIGN_TOKENS.bgTertiary,
      colorBorder: DESIGN_TOKENS.borderColor,
      activeBorderColor: DESIGN_TOKENS.gold,
    },
    Tabs: {
      inkBarColor: DESIGN_TOKENS.gold,
      itemSelectedColor: DESIGN_TOKENS.gold,
      itemHoverColor: DESIGN_TOKENS.goldHover,
      itemColor: DESIGN_TOKENS.textSecondary,
    },
    Tag: {
      defaultBg: DESIGN_TOKENS.bgTertiary,
      defaultColor: DESIGN_TOKENS.textSecondary,
    },
    Pagination: {
      itemActiveBg: 'rgba(212, 175, 55, 0.12)',
      colorPrimary: DESIGN_TOKENS.gold,
      colorPrimaryHover: DESIGN_TOKENS.goldHover,
    },
    Form: {
      labelColor: DESIGN_TOKENS.textSecondary,
    },
    Alert: {
      colorInfoBg: 'rgba(90, 122, 184, 0.12)',
      colorSuccessBg: 'rgba(74, 154, 122, 0.12)',
      colorWarningBg: 'rgba(196, 154, 58, 0.12)',
      colorErrorBg: 'rgba(184, 84, 80, 0.12)',
    },
    Progress: {
      remainingColor: DESIGN_TOKENS.bgHover,
    },
    Segmented: {
      itemSelectedBg: DESIGN_TOKENS.bgActive,
      itemSelectedColor: DESIGN_TOKENS.gold,
    },
    Statistic: {
      colorText: DESIGN_TOKENS.textPrimary,
    },
    Empty: {
      colorTextDescription: DESIGN_TOKENS.textMuted,
    },
    Skeleton: {
      colorBgBase: DESIGN_TOKENS.bgTertiary,
    },
    Steps: {
      colorText: DESIGN_TOKENS.textSecondary,
    },
    Descriptions: {
      labelBg: DESIGN_TOKENS.bgTertiary,
      titleColor: DESIGN_TOKENS.textPrimary,
    },
    Radio: {
      buttonCheckedBg: DESIGN_TOKENS.bgActive,
    },
    Checkbox: {
      colorPrimary: DESIGN_TOKENS.gold,
    },
    Switch: {
      colorPrimary: DESIGN_TOKENS.gold,
    },
    Timeline: {
      dotBg: DESIGN_TOKENS.bgCard,
    },
  },
};
