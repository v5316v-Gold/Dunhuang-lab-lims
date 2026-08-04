# ADR-0010:PWA 离线 + IndexedDB + LWW 冲突解决

> **状态**: Accepted
> **日期**: 2026-08-04
> **决策人**: 天枢(架构师)+ 前端工程师
> **影响范围**: 离线场景、现场采样、数据冲突解决

## 背景

敦煌金质检的**现场采样场景**经常遇到网络不可用:

- **矿山现场**:无 4G/5G 信号
- **冶炼厂车间**:金属屏蔽
- **客户送检车**:移动场景
- **地下室 / 库房**:信号差

现场检测员必须能:
1. **接收样品**(拍照 + 称重 + 编号)
2. **录入检测数据**
3. **查看历史数据**(离线)
4. **同步到服务器**(网络恢复时)

## 决策

**PWA(Service Worker)+ IndexedDB(本地存储)+ LWW(Last-Write-Wins)冲突解决**。

### 1. 架构

```
┌──────────────────────────────────────┐
│  前端 PWA (apps/frontend/)           │
│  ┌─────────────────────────────────┐ │
│  │ React UI                        │ │
│  ├─────────────────────────────────┤ │
│  │ TanStack Query (缓存 + 重试)    │ │
│  ├─────────────────────────────────┤ │
│  │ 业务逻辑层                      │ │
│  ├─────────────────────────────────┤ │
│  │ Data 层 + 离线队列 (IndexedDB)  │ │
│  ├─────────────────────────────────┤ │
│  │ Service Worker (离线拦截)       │ │
│  └─────────────────────────────────┘ │
└──────────────────────────────────────┘
            ↕ HTTPS (在线)
┌──────────────────────────────────────┐
│  后端 (apps/backend/)                │
│  ┌─────────────────────────────────┐ │
│  │ 离线同步 API                    │ │
│  │ POST /sync/batch                │ │
│  │ (LWW 冲突解决)                  │ │
│  ├─────────────────────────────────┤ │
│  │ 业务模块 + 审计链               │ │
│  └─────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### 2. IndexedDB 离线队列

```typescript
// apps/frontend/src/data/offline-queue.ts
import { openDB, IDBPDatabase } from 'idb';

interface QueuedOperation {
  id: string;             // UUID
  url: string;            // '/samples'
  method: 'POST' | 'PATCH' | 'DELETE';
  body: any;
  timestamp: number;
  retryCount: number;
  conflictResolution?: 'lww' | 'manual';
}

class OfflineQueue {
  private db!: IDBPDatabase;

  async init() {
    this.db = await openDB('dunhuang-lims', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { keyPath: 'id' });
        }
      },
    });
  }

  async enqueue(op: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount'>) {
    await this.db.add('queue', {
      ...op,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
    });
  }

  async drain(handler: (op: QueuedOperation) => Promise<void>) {
    const ops = await this.db.getAll('queue');
    ops.sort((a, b) => a.timestamp - b.timestamp);

    for (const op of ops) {
      try {
        await handler(op);
        await this.db.delete('queue', op.id);
      } catch (e) {
        op.retryCount++;
        if (op.retryCount >= 5) {
          // 入死信队列 + 通知用户
          await this.db.put('dead-letter', op);
          await this.db.delete('queue', op.id);
        } else {
          await this.db.put('queue', op);
        }
      }
    }
  }
}
```

### 3. Service Worker 离线拦截

```typescript
// apps/frontend/src/service-worker/sw.ts
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('dunhuang-lims-v1').then((cache) =>
      cache.addAll([
        '/',
        '/index.html',
        '/offline.html',
        '/assets/logo.png',
      ])
    )
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // GET 静态资源:Cache First
  if (event.request.method === 'GET' && url.pathname.startsWith('/assets/')) {
    event.respondWith(CacheFirst({ cacheName: 'static' }));
    return;
  }

  // GET 样品列表:Network First,失败回退到 IndexedDB
  if (event.request.method === 'GET' && url.pathname === '/api/samples') {
    event.respondWith(
      NetworkFirst({
        cacheName: 'samples',
        networkTimeoutSeconds: 5,
      }).catch(() => caches.match('/offline-samples.json'))
    );
    return;
  }

  // POST / PATCH / DELETE:写入离线队列
  if (['POST', 'PATCH', 'DELETE'].includes(event.request.method)) {
    event.respondWith(
      fetch(event.request.clone()).catch(async () => {
        const body = await event.request.clone().json();
        await offlineQueue.enqueue({
          url: url.pathname,
          method: event.request.method as any,
          body,
        });
        return new Response(JSON.stringify({ queued: true }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }
});

// 同步:网络恢复时,自动 drain 队列
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(offlineQueue.drain(syncHandler));
  }
});
```

### 4. 后端同步 API

```typescript
// apps/backend/src/modules/sync/sync.controller.ts

interface SyncBatchRequest {
  operations: Array<{
    clientId: string;      // 客户端生成的 UUID,用于幂等
    url: string;
    method: 'POST' | 'PATCH';
    body: any;
    clientTimestamp: number; // 客户端时间,用于 LWW
  }>;
}

@Post('sync/batch')
async syncBatch(@Body() req: SyncBatchRequest, @CurrentUser() user: User) {
  const results = [];

  for (const op of req.operations) {
    try {
      // 幂等:用 clientId 去重
      const existing = await prisma.syncOperation.findUnique({
        where: { clientId: op.clientId },
      });
      if (existing) {
        results.push({ clientId: op.clientId, status: 'duplicate', result: existing.result });
        continue;
      }

      // LWW 冲突解决:客户端时间 vs 服务器时间
      // 如果服务器上的 updated_at > op.clientTimestamp → 服务器赢(已被其他人更新)
      // 否则 → 客户端赢(应用变更)
      const resource = await this.applyWithLWW(op, user);

      // 入审计链(自动通过 PG 触发器)
      await prisma.syncOperation.create({
        data: {
          clientId: op.clientId,
          operation: op,
          result: resource,
        },
      });

      results.push({ clientId: op.clientId, status: 'applied', result: resource });
    } catch (e) {
      results.push({ clientId: op.clientId, status: 'error', error: e.message });
    }
  }

  return { results };
}
```

### 5. LWW 冲突解决

```typescript
async applyWithLWW(op: SyncOperation, user: User) {
  // 例:更新样品
  if (op.url.match(/^\/samples\/([^/]+)$/)) {
    const sampleId = op.url.split('/').pop();
    const existing = await prisma.sample.findUnique({ where: { id: sampleId } });

    if (existing && existing.updatedAt.getTime() > op.clientTimestamp) {
      // 服务器已有更新,客户端赢(但记录冲突)
      // 实际生产环境可能用 CRDT 或人工干预
      await prisma.auditLog.create({
        data: {
          action: 'sync.conflict.lww',
          tableName: 'samples',
          recordId: sampleId,
          newData: {
            clientTime: op.clientTimestamp,
            serverTime: existing.updatedAt,
            resolved: 'client-wins',
          },
          userId: user.id,
          username: user.username,
        },
      });
    }

    // 应用变更(无论是否冲突)
    return await prisma.sample.update({
      where: { id: sampleId },
      data: op.body,
    });
  }
}
```

## 理由

### 为什么 PWA(而非纯 Web)

- ✅ **离线可用**:Service Worker 缓存 + IndexedDB
- ✅ **类原生体验**:可添加到桌面 / 全屏
- ✅ **iOS Safari 支持**(iOS 16.4+):虽然是 Apple 限制,PWA 仍可用
- ✅ **无需 App Store**:免审核;快速迭代
- ✅ **HTTPS 自动**:PWA 要求 HTTPS

### 为什么 IndexedDB(而非 localStorage)

| 维度 | IndexedDB | localStorage |
|---|---|---|
| **容量** | 数 GB(浏览器配额) | 5-10 MB |
| **异步** | ✅ 不阻塞 UI | ❌ 同步阻塞 |
| **事务** | ✅ 完整 ACID | ❌ |
| **二进制** | ✅ Blob / File | ❌ 仅字符串 |
| **索引** | ✅ 复杂查询 | ❌ |

### 为什么 LWW(而非 CRDT 或 OT)

| 方案 | 复杂度 | 适用场景 | 选择 |
|---|---|---|---|
| **LWW(Last-Write-Wins)** | ⭐ 简单 | 单字段覆盖;冲突少见 | ✅ 推荐 |
| **CRDT** | ⭐⭐⭐ 复杂 | 协同编辑(Google Docs) | ❌ 过度设计 |
| **OT(Operational Transform)** | ⭐⭐⭐⭐ 极复杂 | 实时协同 | ❌ |
| **人工干预** | ⭐ 简单 | 关键冲突 | ⚠️ 兜底 |

LWW 在样品编号 / 检测结果(检测员独占设备)的场景下,冲突少见,LWW 足够。

### 为什么离线时拍照存本地

- 现场无网络时,拍照必须存本地 IndexedDB
- 网络恢复时上传到 MinIO + 入 audit_logs

## 替代方案

### 备选 1:原生 App(iOS / Android)
- **优势**: 体验最佳;离线稳定
- **拒绝理由**: 双端维护成本;App Store 审核;慢迭代

### 备选 2:仅 Web(无离线)
- **优势**: 简单
- **拒绝理由**: 现场无网络不可用

### 备选 3:Web + 离线 SQLite(WASM)
- **优势**: 性能好
- **拒绝理由**: 复杂;IndexedDB 已够用

### 备选 4:CRDT / OT
- **优势**: 复杂协同
- **拒绝理由**: 过度设计;LWW 够用

## 影响

### 正面影响
- ✅ **现场可用**:无网络也能工作
- ✅ **类原生体验**:桌面图标 / 全屏
- ✅ **数据零丢失**:离线队列 + 重试
- ✅ **冲突可追溯**:LWW 冲突入审计链

### 负面影响 + 缓解
- ⚠️ **IndexedDB 浏览器配额**:Safari 较严(~1GB);缓解:定期清理已同步数据
- ⚠️ **Service Worker 调试复杂**:缓解:Workbox + 详细日志
- ⚠️ **iOS Safari 限制**:Service Worker 会被 iOS 清理;缓解:Background Sync API(部分支持)
- ⚠️ **LWW 误覆盖**:缓解:关键字段(检测结果)不可覆盖,需人工介入

### 关键约束

1. **离线数据必须经审计链**:联网同步时,PG 触发器自动审计
2. **客户端时间必须记录**:用于 LWW 判断
3. **冲突必须入审计**:即使 LWW 解决,也要记 audit_log
4. **死信队列**:5 次重试失败入死信,通知用户
5. **PWA 必须 HTTPS**:生产强制 TLS

## 验证标准

- [ ] Service Worker 离线拦截 GET / POST / PATCH / DELETE
- [ ] IndexedDB 离线队列 + 死信队列工作
- [ ] 网络恢复自动 sync(Background Sync API)
- [ ] LWW 冲突解决 + 审计记录
- [ ] 性能:离线模式启动 < 500ms
- [ ] 容量:IndexedDB 可存 1000 条离线操作
- [ ] 测试:模拟离线 → 操作 → 在线 → 同步成功
- [ ] 测试:LWW 冲突场景(两个客户端同时改同一样品)
- [ ] CNAS 现场验证:审核员可演示离线操作 + 同步

## 相关决策

- ADR-0003: 审计链 SHA256
- ADR-0011: 贵金属检测业务约束

## 参考

- [PWA 文档](https://web.dev/progressive-web-apps/)
- [Workbox 文档](https://developer.chrome.com/docs/workbox)
- [IndexedDB 最佳实践](https://web.dev/articles/indexeddb-best-practices)
- [Background Sync API](https://developer.chrome.com/docs/capabilities/background-sync)
- [RFC 7396 JSON Merge Patch(LWW 简化版)](https://www.rfc-editor.org/rfc/rfc7396)