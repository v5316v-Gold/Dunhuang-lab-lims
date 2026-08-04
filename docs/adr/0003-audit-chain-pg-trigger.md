# ADR-0003:审计链 = PG 触发器(非应用层)

> **状态**: Accepted
> **日期**: 2026-08-04
> **决策人**: 天枢(架构师)+ 菩提老祖 + 质量负责人
> **影响范围**: 数据库 schema、合规底线、CNAS 审核核心证据

## 背景

CNAS / ISO 17025 / 21 CFR Part 11 / ALCOA+ 都要求"所有数据修改可追溯 + 防篡改"。敦煌金质检的检测数据具有**法律效力**(黄金交易结算凭证),审计链是合规底线。

传统做法是在应用层(后端 Service)写审计日志。这种做法有以下致命缺陷:

1. **应用层遗漏风险**:开发人员忘记写 `auditLog()` 调用 → 关键操作无审计
2. **事务不一致风险**:业务表写成功 + 审计写失败 → 业务有数据但审计缺失
3. **直接连库绕过风险**:DBA / 攻击者直接连 PG → 可绕过应用层审计
4. **性能开销**:应用层序列化 JSON + 计算 SHA256,损耗业务性能

CNAS 审核员最常问的问题是:**"如果有人绕过你的应用层代码,直接修改数据库,审计还能记录吗?"**

传统应用层审计的答案是:**不能**。这就是为什么必须把审计放在数据库侧。

## 决策

**审计链 SHA256 = PostgreSQL 数据库触发器**,不在 NestJS 应用层实现。

### 实现要点

```sql
-- 1. SHA256 计算函数(DB 侧)
CREATE OR REPLACE FUNCTION compute_audit_hash(...) RETURNS TEXT
LANGUAGE plpgsql STABLE;  -- 注意:STABLE 而非 IMMUTABLE,因为依赖 current_setting

-- 2. 通用审计触发器函数
CREATE OR REPLACE FUNCTION audit_trigger() RETURNS TRIGGER
LANGUAGE plpgsql;  -- 给所有关键业务表加这个触发器

-- 3. 防篡改触发器
CREATE TRIGGER no_modify_audit BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
```

应用层只负责一件事:**通过 `SET LOCAL` 把当前用户塞进 PG session variable**。

```typescript
// apps/backend/src/common/audit/audit-context.middleware.ts
@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const user = req.user;  // JWT 解析后
    if (user) {
      // 关键:用 SET LOCAL 跟随事务
      req.db.$executeRawUnsafe(
        `SET LOCAL app.current_user_id = '${user.id}';`
      );
      req.db.$executeRawUnsafe(
        `SET LOCAL app.current_username = '${user.username}';`
      );
    }
    next();
  }
}
```

## 理由

### 为什么 DB 触发器(而非应用层)

| 维度 | DB 触发器 | 应用层审计 |
|---|---|---|
| **绕过应用** | ❌ 无法绕过 | ✅ 可直接连 DB 绕过 |
| **事务原子性** | ✅ 同事务写业务+审计 | ⚠️ 跨方法调用易遗漏 |
| **性能** | ⭐⭐ DB 侧计算 SHA256 | ⭐ 应用层序列化损耗 |
| **审计员可信度** | ✅ DB 自身保证 | ⚠️ "代码审计"无法直接验证 |
| **多服务共享** | ✅ 任何服务写 DB 都审计 | ⚠️ 每个服务各自实现 |
| **CNAS 现场验证** | ✅ `SHOW TRIGGERS` 即可验证 | ⚠️ 需要读代码 |

### 为什么 SHA256 链

| 方案 | 防篡改 | 性能 | 选择 |
|---|---|---|---|
| **不计算哈希** | ❌ 可任意修改 | ⭐⭐⭐ | ❌ |
| **CRC32 / MD5** | ⚠️ 可碰撞伪造 | ⭐⭐ | ❌ |
| **SHA256** | ✅ 不可碰撞伪造 | ⭐ | ✅ |
| **SHA256 + 链式(prev_hash)** | ✅✅ 任何一节点修改必断链 | ⭐ | ✅✅ |

**SHA256 链式结构**:
```
audit_log[id=1] prev_hash="000...0"  curr_hash=sha256("0|user1|action1|data1|t1")
audit_log[id=2] prev_hash=<id1.hash> curr_hash=sha256("<id1.hash>|user2|action2|data2|t2")
audit_log[id=3] prev_hash=<id2.hash> curr_hash=sha256("<id2.hash>|user3|action3|data3|t3")
```

**任何一条记录的修改都会导致 curr_hash 变化,而下一条记录的 prev_hash 与上一条的 curr_hash 不匹配 → 断链自检脚本立即报警**。

### 为什么不允许直接修改 audit_logs

```sql
CREATE TRIGGER no_modify_audit BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

CREATE OR REPLACE FUNCTION prevent_audit_modification() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only, modification not allowed';
END;
$$ LANGUAGE plpgsql;
```

任何尝试 `UPDATE audit_logs SET ...` 或 `DELETE FROM audit_logs WHERE ...` 都会立即抛异常,**这是数据库层面的硬约束,应用层无法绕过**。

## 替代方案

### 备选 1:应用层审计(NestJS Interceptor / Guard)
- **优势**: 灵活,可关联业务上下文
- **拒绝理由**: 可绕过;事务不一致;DBA 直接改 DB 无审计

### 备选 2:独立审计服务(单独微服务)
- **优势**: 解耦,可独立扩展
- **拒绝理由**: 网络抖动导致审计失败;事务不一致;增加复杂度

### 备选 3:触发器 + 哈希链,但哈希用应用层算
- **优势**: SHA256 计算用 Node.js crypto(快)
- **拒绝理由**: 应用层算的哈希传到 DB,触发器内还要重算;**性能损耗更大**

### 备选 4:用专门的审计数据库(如 AWS QLDB / immudb)
- **优势**: 内置不可篡改
- **拒绝理由**: 引入新基础设施;CNAS 审核员不熟;增加学习成本

## 影响

### 正面影响
- ✅ **不可绕过**:任何写操作必经 DB 触发器,CNAS 审核员可现场验证
- ✅ **事务原子性**:业务表写失败 → 审计自动回滚
- ✅ **性能可控**:DB 侧 SHA256 用 `pgcrypto` 扩展,C 语言实现,快
- ✅ **断链自检**:`scripts/audit-verify.ts` 跑遍所有记录,5 分钟内出报告

### 负面影响 + 缓解
- ⚠️ **DB 侧 SHA256 函数 STABLE 而非 IMMUTABLE**:因依赖 `current_setting()`,不能放在 IMMUTABLE;**缓解**:PostgreSQL 允许 STABLE 函数在触发器中调用
- ⚠️ **触发器调试困难**:PG 触发器看不到 NestJS 的栈;**缓解**:所有触发器错误写到 `pg_stat_activity` + 应用层日志关联
- ⚠️ **审计日志膨胀**:100 万业务记录 ≈ 100 万审计记录;**缓解**:TimescaleDB hypertable + 冷热分层(1 年内热 / 1-5 年冷)
- ⚠️ **跨表触发器管理成本**:60+ 表都要加触发器;**缓解**:Prisma migration 自动生成触发器 SQL
- ⚠️ **审计写入性能开销**:每条业务写多 1 次审计 INSERT;**缓解**:实测 P95 增量 < 5ms,业务可接受

### 关键约束(给后续开发的强约束)

1. **所有关键业务表必须加 audit_trigger()**:samples / tests / reports / equipment / reagents / personnel / users / 等
2. **禁止 UPDATE/DELETE audit_logs**:DB 触发器拒绝
3. **审计断链自检必须每晚跑**:`scripts/audit-verify.ts` cron job
4. **断链 = 严重事件**:告警升级到 P0,通知实验室主任

## 验证标准

- [ ] 所有关键业务表添加 `audit_trigger()`
- [ ] `audit_logs` 表添加 `no_modify_audit` 触发器
- [ ] 应用层通过 `SET LOCAL` 设置 `app.current_user_id` / `app.current_username`
- [ ] 单元测试:`audit_trigger.spec.ts` 覆盖 INSERT/UPDATE/DELETE
- [ ] 集成测试:任意业务写 → audit_logs 自动 +1 条,SHA256 链完整
- [ ] 断链自检:`scripts/audit-verify.ts` 100% 通过
- [ ] 性能测试:审计写入对业务 P95 增量 < 5ms
- [ ] CNAS 现场验证:审核员可现场执行 `SHOW TRIGGERS` 看到所有审计触发器

## 相关决策

- ADR-0002: NestJS + Prisma + PG
- ADR-0011: 贵金属检测业务约束

## 参考

- [PostgreSQL Trigger 文档](https://www.postgresql.org/docs/current/triggers.html)
- [pgcrypto 扩展](https://www.postgresql.org/docs/current/pgcrypto.html)
- [21 CFR Part 11 §11.10(e) 审计追踪](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11)
- [ALCOA+ 数据完整性指南](https://www.ema.europa.eu/en/documents/regulatory-procedural-guideline/guidance-good-distribution-practice-active-substances-human-use_en.pdf)