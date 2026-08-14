# 前端 UI 设计参数 · 字体与配色规范

> 主题：新中式奢华科技风（墨黑 + 辉金）
> 文件：`src/app/globals.css`

---

## 一、字体（Font）

### 1.1 字体栈

| 用途 | 字体栈 |
|------|--------|
| 主字体（sans） | `'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial` |
| 等宽字体（mono） | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New'` |

### 1.2 渲染参数

| 参数 | 值 |
|------|-----|
| 抗锯齿 | `-webkit-font-smoothing: antialiased` / `-moz-osx-font-smoothing: grayscale` |
| 行高 | `1.6` |
| 字间距 | `0.01em` |
| 圆角基准 | `0.5rem`（radius） |

---

## 二、主色（金色系）

| 变量 | 色值 | 用途 |
|------|------|------|
| `--gold` | `#D4AF37` | 主金 · 辉金 |
| `--gold-bright` | `#F5D76E` | 亮金 · 高光 |
| `--gold-hover` | `#E5C158` | 悬停金 |
| `--gold-dark` | `#8B6914` | 深金 · 阴影 |
| `--gold-muted` | `rgba(212, 175, 55, 0.12)` | 淡金背景 |
| `--gold-glow` | `rgba(212, 175, 55, 0.35)` | 金色光晕 |
| `--gold-border` | `rgba(212, 175, 55, 0.25)` | 金色边框 |
| `--gold-gradient` | `linear-gradient(135deg, #D4AF37 0%, #F5D76E 50%, #D4AF37 100%)` | 金色渐变 |

---

## 三、背景色（墨黑层次）

| 变量 | 色值 | 用途 |
|------|------|------|
| `--bg-primary` | `#08080A` | 主背景 · 深墨黑 |
| `--bg-secondary` | `#0E0E12` | 次级背景 |
| `--bg-tertiary` | `#16161C` | 三级背景 |
| `--bg-card` | `#111115` | 卡片背景 |
| `--bg-hover` | `#1C1C24` | 悬停背景 |
| `--bg-active` | `#242430` | 激活背景 |
| `--bg-elevated` | `#1A1A22` | 悬浮背景 |
| `--bg-overlay` | `rgba(8, 8, 10, 0.9)` | 遮罩层 |
| `--bg-glass` | `rgba(17, 17, 21, 0.85)` | 玻璃拟态 |

---

## 四、边框色

| 变量 | 色值 | 用途 |
|------|------|------|
| `--border-color` | `#252530` | 默认边框 |
| `--border-light` | `#35354A` | 亮边框 |
| `--border-gold` | `rgba(212, 175, 55, 0.3)` | 金色边框 |
| `--border-gold-hover` | `rgba(212, 175, 55, 0.5)` | 金色悬停边框 |

---

## 五、文字色

| 变量 | 色值 | 用途 |
|------|------|------|
| `--text-primary` | `#F8F6F0` | 主文字 · 象牙白 |
| `--text-secondary` | `#B8B4A8` | 次级文字 |
| `--text-muted` | `#6A6860` | 弱化文字 |
| `--text-dim` | `#454540` | 暗淡文字 |
| `--text-inverse` | `#0A0A08` | 反色文字 |
| `--text-gold` | `#D4AF37` | 金色文字 |

---

## 六、功能色（中国风）

| 变量 | 色值 | 名称 |
|------|------|------|
| `--success` | `#4A9A7A` | 翠玉绿 |
| `--error` | `#B85450` | 朱砂红 |
| `--warning` | `#C49A3A` | 琥珀黄 |
| `--info` | `#5A7AB8` | 青花蓝 |
| `--success-light` | `rgba(74, 154, 122, 0.12)` | 翠绿淡背景 |
| `--error-light` | `rgba(184, 84, 80, 0.12)` | 朱砂淡背景 |
| `--warning-light` | `rgba(196, 154, 58, 0.12)` | 琥珀淡背景 |
| `--info-light` | `rgba(90, 122, 184, 0.12)` | 青花淡背景 |

---

## 七、阴影系统

| 变量 | 值 |
|------|-----|
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.4)` |
| `--shadow-md` | `0 4px 12px rgba(0, 0, 0, 0.5)` |
| `--shadow-lg` | `0 8px 24px rgba(0, 0, 0, 0.6)` |
| `--shadow-xl` | `0 16px 48px rgba(0, 0, 0, 0.7)` |
| `--shadow-gold` | `0 4px 20px rgba(212, 175, 55, 0.15)` |
| `--shadow-gold-lg` | `0 8px 32px rgba(212, 175, 55, 0.2)` |
| `--shadow-gold-glow` | `0 0 30px rgba(212, 175, 55, 0.3)` |

---

## 八、过渡动画

| 变量 | 值 |
|------|-----|
| `--transition-fast` | `150ms cubic-bezier(0.4, 0, 0.2, 1)` |
| `--transition-normal` | `250ms cubic-bezier(0.4, 0, 0.2, 1)` |
| `--transition-slow` | `350ms cubic-bezier(0.4, 0, 0.2, 1)` |
| `--transition-spring` | `400ms cubic-bezier(0.34, 1.56, 0.64, 1)` |

---

## 九、特色背景（SVG 纹样）

**中心光晕**：
```css
radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212, 175, 55, 0.08) 0%, transparent 60%)
```

**网格纹样**（120x120，金色低透明度）：
- 方形网格：`stroke #D4AF37` · 0.3 宽 · opacity 0.04
- 同心圆：r=40 / 25 / 12 · 0.25/0.2/0.15 宽 · opacity 0.03/0.025/0.02
- 对角线：0.2 宽 · opacity 0.02
- 四角圆点：r=8 · 0.15 宽 · opacity 0.015

---

## 十、Shadcn 变量映射

| Shadcn 变量 | 映射 |
|-------------|------|
| `--background` | `--bg-primary` |
| `--foreground` | `--text-primary` |
| `--card` | `--bg-card` |
| `--primary` | `--gold` |
| `--primary-foreground` | `--text-inverse` |
| `--secondary` | `--bg-tertiary` |
| `--muted` | `--bg-tertiary` |
| `--muted-foreground` | `--text-muted` |
| `--accent` | `--bg-hover` |
| `--destructive` | `--error` |
| `--border` | `--border-color` |
| `--ring` | `--gold` |
| `--sidebar` | `--bg-secondary` |
| `--sidebar-primary` | `--gold` |

---

## 十一、配色速查

```
主色     #D4AF37   （辉金）
背景     #08080A   （墨黑）
文字     #F8F6F0   （象牙白）
点缀     #4A9A7A   （翠玉绿）
警示     #B85450   （朱砂红）
信息     #5A7AB8   （青花蓝）
警告     #C49A3A   （琥珀黄）
```
