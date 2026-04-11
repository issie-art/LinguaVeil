# LinguaVeil 技术栈文档

## 项目概览

LinguaVeil 是一款 Chrome 浏览器扩展，基于 Manifest V3 规范，使用 WXT 框架构建，核心功能为英文网页划词翻译与知识卡片管理。

## 技术栈

| 分类 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 扩展框架 | WXT | ^0.20.20 | Chrome Extension 开发框架，基于 Vite |
| UI 框架 | React | ^19.2.4 | 用于 Popup 和 Side Panel 页面 |
| 类型系统 | TypeScript | ^5.9.3 | 全量 TS 开发 |
| 构建工具 | Vite | (WXT 内置) | 由 WXT 封装管理 |
| 包管理器 | pnpm | - | lockfile: pnpm-lock.yaml |
| React 集成 | @wxt-dev/module-react | ^1.1.5 | WXT 的 React 模块 |

## 构建与脚本

```json
{
  "dev": "wxt",
  "dev:firefox": "wxt -b firefox",
  "build": "wxt build",
  "build:firefox": "wxt build -b firefox",
  "zip": "wxt zip",
  "zip:firefox": "wxt zip -b firefox",
  "compile": "tsc --noEmit",
  "postinstall": "wxt prepare"
}
```

## Chrome Extension 配置

### Manifest 权限

| 权限 | 用途 |
|------|------|
| `storage` | chrome.storage.local 持久化数据（生词本、卡片、缓存、开关状态） |
| `sidePanel` | Side Panel API 用于知识卡片面板 |

### Host Permissions

| 域名 | 用途 |
|------|------|
| `https://translate.googleapis.com/*` | Google Translate 公开 API |

### Content Script

- 匹配模式：`*://*/*`（注入所有网页）
- 注入内容：JavaScript + CSS

## TypeScript 配置

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "jsx": "react-jsx"
  }
}
```

- 继承 WXT 自动生成的 tsconfig
- 启用 `.ts` 扩展名导入
- JSX 使用 `react-jsx` 转换（React 17+ 自动导入）

## 外部 API 依赖

### Google Translate API（公开端点）

- **端点**：`https://translate.googleapis.com/translate_a/single`
- **参数**：`client=gtx&sl=en&tl=zh-CN&dt=t&dt=bd&dt=rm&q={text}`
- **特性**：无需 API Key，免费，适合 MVP
- **返回数据**：
  - `dt=t`：翻译文本
  - `dt=bd`：词性信息
  - `dt=rm`：音标/罗马音

## 数据存储

使用 `chrome.storage.local`，共 4 个存储键：

| Key | 类型 | 说明 |
|-----|------|------|
| `lv_modes` | `{ translate: boolean, flashcard: boolean }` | 功能开关状态 |
| `lv_words` | `Record<string, WordEntry>` | 生词本数据 |
| `lv_flashcards` | `Record<string, FlashcardEntry>` | 知识卡片数据 |
| `lv_translate_cache` | `Record<string, CachedEntry>` | 翻译缓存（最大 500 条，7 天过期） |

### WordEntry 字段

```typescript
interface WordEntry {
  word: string;
  definition: string;
  partOfSpeech: string;
  type: "ordinary" | "technical";
  firstSeen: number;
  mastered: boolean;
}
```

### FlashcardEntry 字段

```typescript
interface FlashcardEntry {
  id: string;
  front: string;
  back: string;
  topic: string;          // 逗号分隔的标签
  context: string;        // 选中文本的上下文
  sourceUrl: string;      // 来源网页
  langFront: "en" | "zh";
  langBack: "en" | "zh";
  createdAt: number;
  reviewCount: number;
  lastReviewed: number | null;
}
```

## 翻译缓存策略

- **两层架构**：内存层（Map）+ 持久层（chrome.storage.local）
- **查询顺序**：内存 → 持久层（命中后回填内存）
- **缓存 Key**：单词转小写，短语保留原样
- **过期策略**：7 天过期
- **容量控制**：最大 500 条，超量淘汰最旧 25%

## 特殊组件实现

### 标签高亮输入组件（BackInputWithTags）

**位置**：`flashcards/App.tsx`（内置组件）

**技术方案**：textarea + 高亮层叠加（Flomo 风格）
- **输入层**：透明背景的 textarea，接收用户输入，文字颜色透明
- **高亮层**：底层 div，显示带样式的文本，#标签 渲染为蓝色高亮
- **同步机制**：onChange 时重新渲染高亮层，onScroll 时同步滚动位置
- **优势**：输入体验与原生 textarea 完全一致，无光标跳动问题

## 预置数据

- **技术词汇表**（`tech-words.ts`）：约 300 个预定义技术术语，用于生词分级（ordinary vs technical），涵盖编程语言、框架、设计模式、数据结构等领域
