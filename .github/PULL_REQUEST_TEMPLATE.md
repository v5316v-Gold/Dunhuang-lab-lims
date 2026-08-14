# Pull Request 模板 — 敦煌金质检 LIMS

> 提交 PR 前请自查:代码通过 lint(0 errors)+ typecheck + 测试全 PASS。

## 变更类型

- [ ] feat(新功能)
- [ ] fix(缺陷修复)
- [ ] refactor(重构,无行为变化)
- [ ] test(测试)
- [ ] docs(文档)
- [ ] ci / chore / build(工程)

## 关联项

- **任务编号**: Phase __ Task __(见 `docs/implementation/CODE-EXECUTION-PLAN.md`)
- **ADR 依据**: ADR-____(如适用)
- **架构层**: L0.5 / L1 / L2 / L3 / L4 / L5 / L6 / L7 / L8(对应 `docs/architecture/`)

## 变更内容

<!-- 简述本次变更做了什么,为什么 -->

## 测试与验证

- [ ] `pnpm lint` 0 errors
- [ ] `pnpm typecheck` PASS
- [ ] 单元/集成测试 PASS(列出新增用例)
- [ ] 实盘验证说明(如适用)

## 代码评审五维自查

| 维度 | 自查结果 |
|---|---|
| 可读性 | 命名清晰/注释必要/复杂度可控 |
| 可维护性 | 模块边界/依赖方向(ADR-0001)/无重复 |
| 性能 | 无 N+1 / 无大表全扫 / 索引利用 |
| 安全 | 无注入/无越权/敏感数据不落日志 |
| 合规 | 审计事件覆盖 / 软删除 / 状态机守卫 / DTO 校验 |

## 截图(如适用)

<!-- 前端变更请附截图 -->

## 其他说明

<!-- 风险点、回滚预案、后续 TODO -->
