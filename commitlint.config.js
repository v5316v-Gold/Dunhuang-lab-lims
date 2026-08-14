// =====================================================
// commitlint 配置 — Phase 1 Task 1.1 (CODE-EXECUTION-PLAN §2.2)
// 强制约定式提交(Conventional Commits)
// 规则: type(scope): subject
//   type: build|ci|docs|feat|fix|perf|refactor|style|test|chore|revert
//   subject 小写开头(英文)/ 中文允许
// 安装: pnpm add -D commitlint @commitlint/cli @commitlint/config-conventional
// 用法: echo "fix(audit): 修复断链" | pnpm commitlint
// =====================================================

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // type 枚举(与仓库既有 commit 一致)
    'type-enum': [
      2,
      'always',
      [
        'build',   // 构建/依赖
        'ci',      // CI 配置
        'docs',    // 文档
        'feat',    // 新功能
        'fix',     // 修复
        'perf',    // 性能
        'refactor',// 重构
        'style',   // 格式
        'test',    // 测试
        'chore',   // 杂项
        'revert',  // 回滚
      ],
    ],
    // subject 不允许空
    'subject-empty': [2, 'never'],
    // type 不允许空
    'type-empty': [2, 'never'],
    // subject 最大长度 100
    'subject-max-length': [2, 'always', 100],
    // header 总长 ≤ 120
    'header-max-length': [2, 'always', 120],
    // body 每行 ≤ 200(中文长描述)
    'body-max-line-length': [0],
    // 允许 WIP
    'wip-allow': [0],
  },
};
