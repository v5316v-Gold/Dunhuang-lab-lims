/* ESLint 配置 - 敦煌金质检 LIMS
 *
 * 关键约束(详见 ADR-0001):
 * 1. 依赖方向:apps → packages;packages 不可依赖 apps
 * 2. packages/compliance-core 仅依赖第三方,不可依赖任何业务包
 * 3. infrastructure/* 不依赖任何业务模块
 * 4. common/* 不依赖任何业务模块
 */

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./tsconfig.base.json', './apps/*/tsconfig.json', './packages/*/tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  plugins: ['@typescript-eslint', 'import', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  settings: {
    'import/resolver': {
      // Phase 0.5 Task F: 改用 eslint-import-resolver-typescript(原本写 'typescript' 是错的)
      // 解决 pnpm monorepo 下 @/* 跨包 import 解析问题
      'eslint-import-resolver-typescript': {
        alwaysTryTypes: true,
        project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'],
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
  rules: {
    /* 代码质量 */
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-empty-function': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-debugger': 'error',
    'prefer-const': 'warn',
    'eqeqeq': ['error', 'always'],

    /* Import 顺序 */
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],

    /* 依赖方向强约束(ADR-0001) */
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            /* apps/* 可依赖 packages/*;但 @dunhuang/lims-* 之外的相对路径禁止 */
            group: ['../../packages/*', '../../../packages/*'],
            message: '使用 @dunhuang/lims-* 别名引用 packages(参见 ADR-0001)',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      /* packages/compliance-core: 严禁依赖任何业务包 */
      files: ['packages/compliance-core/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@dunhuang/lims-shared-types', '@dunhuang/lims-ui-kit', '../../apps/*', '../../../apps/*'],
                message: 'compliance-core 严禁依赖任何业务包(参见 ADR-0001)',
              },
            ],
          },
        ],
      },
    },
    {
      /* packages/*: 严禁依赖 apps/* */
      files: ['packages/*/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@dunhuang/lims-backend', '../../apps/*', '../../../apps/*'],
                message: 'packages/* 严禁依赖 apps/*(参见 ADR-0001)',
              },
            ],
          },
        ],
      },
    },
    {
      /* 测试文件宽松 */
      files: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
  ],
  ignorePatterns: ['node_modules', 'dist', 'build', '.turbo', '.next', 'coverage', '*.config.js', '*.config.ts'],
};