# LinguaVeil v0.1.0 — 功能说明文档

## 产品定位

面向工程师群体的沉浸式英语学习助手浏览器扩展。核心场景：在 GitHub 阅读英文技术文档时，通过划词翻译收集生词，自动在页面上标注已收录的生词，实现"从看得懂到记得住"的学习闭环。

## v0.1.0 功能清单

### 已实现

| 功能 | 描述 | 入口 |
|------|------|------|
| 划词翻译 | 选中英文文本（单词/句子），弹出浮窗显示 Google Translate 中文翻译和词性 | 在 GitHub `.markdown-body` 区域内选中文本 |
| 添加生词 | 划词翻译浮窗中点击「+ 添加生词」，将单词存入本地生词本 | 划词浮窗内按钮 |
| 生词自动标注 | 生词本中的单词在页面上自动加下划线（普通词灰色虚线，技术词蓝色实线） | 页面加载时自动执行 |
| Hover 释义 | 鼠标悬停已标注生词，显示中文释义 + 词性 + 「已掌握」按钮 | 鼠标悬停 |
| 标记已掌握 | 点击「已掌握」后该词从标注中移除，不再标注 | Hover 浮窗内按钮 |
| 代码保护 | 扫描时跳过 `<code>` `<pre>` `<script>` `<style>` 及 LaTeX 公式 | 自动 |
| 动态内容适配 | GitHub PJAX/Turbo 导航后自动重新扫描标注 | MutationObserver |
| 模式开关 | Popup 面板控制学习模式和划词翻译的独立开关 | 浏览器工具栏图标 |

### 未实现（规划中）

| 功能 | 状态 |
|------|------|
| 写作模式（表达润色） | Popup 中显示为禁用，标注「即将推出」 |
| 生词本管理页面 | 未开发 |
| 间隔重复复习（Spaced Repetition） | 未开发 |
| 多站点支持（Reddit / Stack Overflow / 论文） | 未开发 |

## 架构概览

```
┌─────────────────────────────────────────────────────┐
│                    Browser Extension                 │
│                                                     │
│  ┌──────────┐   chrome.runtime    ┌──────────────┐  │
│  │  Popup   │ ──── sendMessage ──▶│  Background   │  │
│  │ (React)  │                     │  (Service     │  │
│  │          │                     │   Worker)     │  │
│  └──────────┘                     └──────┬───────┘  │
│                                          │          │
│                              tabs.sendMessage       │
│                                          │          │
│                                          ▼          │
│  ┌──────────────────────────────────────────────┐   │
│  │            Content Script (GitHub)            │   │
│  │                                              │   │
│  │  ┌───────────┐  ┌───────────┐  ┌──────────┐ │   │
│  │  │  Scanner  │  │  Tooltip  │  │ Observer │ │   │
│  │  │           │  │           │  │          │ │   │
│  │  │ TreeWalker│  │ 划词翻译  │  │ Mutation │ │   │
│  │  │ + 标注    │  │ Hover释义 │  │ Observer │ │   │
│  │  └─────┬─────┘  └─────┬─────┘  └──────────┘ │   │
│  │        │              │                      │   │
│  │        ▼              ▼                      │   │
│  │  ┌───────────┐  ┌───────────┐               │   │
│  │  │Code Guard │  │ Translate │               │   │
│  │  │跳过代码区域│  │Google API │               │   │
│  │  └───────────┘  └───────────┘               │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │          chrome.storage.local                 │   │
│  │  ┌─────────────┐  ┌────────────────┐         │   │
│  │  │  lv_words   │  │   lv_modes     │         │   │
│  │  │  生词本数据  │  │  模式开关状态   │         │   │
│  │  └─────────────┘  └────────────────┘         │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## 核心数据流

### 划词 → 添加生词 → 标注

```
用户选中单词
  → mouseup 事件捕获选区文本
  → 调用 Google Translate API 获取翻译
  → 浮窗显示翻译 + 「添加生词」按钮
  → 用户点击「添加生词」
  → word-store.addWord() 写入 chrome.storage.local
  → 触发 rescan 回调
  → stopObserving → removeAll → scanAll → startObserving
  → scanContainer 用 TreeWalker 遍历文本节点
  → 匹配生词本中的词 → annotateWords 插入 <span> 标注
```

### 模式切换

```
用户在 Popup 切换开关
  → 状态写入 chrome.storage.local
  → chrome.runtime.sendMessage 发送到 Background
  → Background 通过 tabs.sendMessage 转发到 Content Script
  → Content Script 执行对应操作（开启/关闭标注、开启/关闭翻译）
```

## 模块说明

| 模块 | 文件 | 职责 |
|------|------|------|
| Content Script 入口 | `entrypoints/content.ts` | 生命周期管理、容器发现、扫描调度、消息监听 |
| Scanner | `entrypoints/content/scanner.ts` | TreeWalker 遍历文本节点、匹配生词本、DOM 标注/移除 |
| Code Guard | `entrypoints/content/code-guard.ts` | 判断节点是否在代码保护区域、LaTeX 公式过滤 |
| Tooltip | `entrypoints/content/tooltip.ts` | 划词翻译浮窗、Hover 释义浮窗、添加生词/已掌握交互 |
| Observer | `entrypoints/content/observer.ts` | MutationObserver 监听内容变化，1s 防抖后触发重扫 |
| Word Store | `entrypoints/lib/word-store.ts` | 生词本 CRUD（chrome.storage.local） |
| Translate | `entrypoints/lib/translate.ts` | Google Translate 公开 API 封装 |
| Messages | `entrypoints/lib/messages.ts` | 消息类型定义、Popup↔Background↔Content 通信函数 |
| Tech Words | `entrypoints/lib/tech-words.ts` | 预定义技术词汇表（~200 词），用于生词分级 |
| Background | `entrypoints/background.ts` | 消息中转，转发失败静默处理 |
| Popup | `entrypoints/popup/App.tsx` | React 设置面板，学习模式/划词翻译/写作模式开关 |

## 存储结构

### lv_words（生词本）

```typescript
Record<string, {
  word: string;           // 单词原文（小写）
  definition: string;     // 中文释义
  partOfSpeech: string;   // 词性（n. / v. / adj.）
  type: 'ordinary' | 'technical';  // 分级
  firstSeen: number;      // 首次添加时间戳
  mastered: boolean;      // 是否已掌握
}>
```

### lv_modes（模式状态）

```typescript
{
  learning: boolean;      // 学习模式（默认 true）
  writing: boolean;       // 写作模式（默认 false，v0.1.0 未实现）
  translation: boolean;   // 划词翻译（默认 true）
}
```

## GitHub 页面覆盖范围

Content Script 匹配 `https://github.com/*`，在以下区域内激活扫描和划词：

| 选择器 | 场景 |
|--------|------|
| `#readme .markdown-body` | 仓库首页 README |
| `.js-discussion .markdown-body` | PR / Issue 描述 |
| `.comment-body .markdown-body` | PR / Issue 评论 |
| `.blob-wrapper .markdown-body` | 浏览 .md 文件 |
| `#wiki-body .markdown-body` | Wiki 页面 |
| `article.markdown-body` | GitHub 新版 UI |
| 兜底：所有 `.markdown-body` | 以上都不匹配时 |

## 技术栈

| 技术 | 用途 |
|------|------|
| WXT 0.20 | 浏览器扩展开发框架 |
| React 19 | Popup 面板 UI |
| TypeScript 5.9 | 类型安全 |
| Chrome Extension MV3 | 扩展规范 |
| Google Translate API | 划词翻译（免费公开接口，无需 Key） |
| chrome.storage.local | 生词本 + 模式状态持久化 |

## 已知限制

1. Google Translate 公开 API 无 SLA，高频调用可能被限流
2. 生词本存储在 chrome.storage.local，不支持跨设备同步（需 chrome.storage.sync 或后端）
3. 仅支持 GitHub 站点，其他站点需扩展 content script 的 matches 配置
4. 划词翻译仅限 `.markdown-body` 区域内，不覆盖 GitHub 的导航栏、侧边栏等
5. 无离线翻译能力，依赖网络连接

## 开发

```bash
pnpm install        # 安装依赖
pnpm dev            # 开发模式（热更新）
pnpm build          # 构建生产版本（输出到 .output/chrome-mv3/）
pnpm zip            # 打包 zip
```