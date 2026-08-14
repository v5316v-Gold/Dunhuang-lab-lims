// =====================================================
// Ant Design 主题 — 新中式奢华科技风(墨黑 + 辉金)
// 依据: docs/UI-DESIGN-PARAMS.md §10 (Shadcn 变量映射)
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
  // 算法: 深色
  // 注: antd v5 深色算法 theme.darkAlgorithm 需在组件内使用,
  //     此处直接给足 token 值(等同暗色效果,避免引入算法依赖)
  token: {
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

    // 文字层次(象牙白)
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
    colorHoverBg: DESIGN_TOKENS.bgHover,
    colorFillTertiary: DESIGN_TOKENS.bgHover,

    // 几何
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    fontSize: 14,
    lineHeight: 1.6,

    // 金色系容器
    colorLink: DESIGN_TOKENS.gold,
    colorLinkHover: DESIGN_TOKENS.goldHover,
  },
  components: {
    Layout: {
      headerBg: DESIGN_TOKENS.bgSecondary,
      siderBg: DESIGN_TOKENS.bgSecondary,
      bodyBg: DESIGN_TOKENS.bgPrimary,
      headerHeight: 56,
    },
    Menu: {
      darkItemBg: DESIGN_TOKENS.bgSecondary,
      darkItemSelectedBg: 'rgba(212, 175, 55, 0.12)', // gold-muted
      darkItemSelectedColor: DESIGN_TOKENS.gold,
      darkItemHoverBg: DESIGN_TOKENS.bgHover,
    },
    Table: {
      headerBg: DESIGN_TOKENS.bgTertiary,
      headerColor: DESIGN_TOKENS.textSecondary,
      rowHoverBg: DESIGN_TOKENS.bgHover,
      borderColor: DESIGN_TOKENS.borderColor,
    },
    Card: {
      colorBgContainer: DESIGN_TOKENS.bgCard,
    },
    Modal: {
      contentBg: DESIGN_TOKENS.bgCard,
      headerBg: DESIGN_TOKENS.bgCard,
    },
    Message: {
      contentBg: DESIGN_TOKENS.bgElevated,
    },
    Notification: {
      colorBgElevated: DESIGN_TOKENS.bgElevated,
    },
  },
};
