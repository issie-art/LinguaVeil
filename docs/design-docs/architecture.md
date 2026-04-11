# LinguaVeil 架构文档

## 多进程架构

LinguaVeil 遵循 Chrome Extension MV3 架构，由三个独立进程组成：

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Popup      │     │   Background      │     │  Content Script  │
│  (React UI)  │────▶│ (Service Worker)  │────▶│  (注入网页)       │
│              │     │                   │     │                  │
│ - 能力开关    │     │ - 消息转发         │     │ - 划词翻译        │
│ - 打开面板    │     │                   │     │ - 生词扫描/标注   │
└─────────────┘     └──────────────────┘     │ - 知识卡片创建    │
                                              └─────────────────┘
                                              
┌─────────────────┐
│   Side Panel     │
│  (React UI)      │
│                  │
│ - 知识卡片管理    │
│ - 搜索/筛选/编辑  │
└─────────────────┘
```

## 目录结构

```
entrypoints/
├── content.ts                  # Content Script 主入口
├── background.ts               # Background Service Worker
├── content/
│   ├── tooltip.ts              # 划词翻译 Tooltip 核心（521 行）
│   ├── tooltip-sections.ts     # Tooltip 各模式渲染器
│   ├── scanner.ts              # 生词扫描与 DOM 标注
│   ├── observer.ts             # MutationObserver 管理
│   ├── code-guard.ts           # 代码/公式保护区域检测
│   ├── theme-detector.ts       # 主题深浅色检测
│   └── styles.css              # 注入样式（371 行）
├── lib/
│   ├── mode-manager.ts         # 并行能力开关管理
│   ├── messages.ts             # 消息类型定义 + 转发函数
│   ├── translate.ts            # Google Translate API 调用
│   ├── translate-cache.ts      # 双层翻译缓存
│   ├── word-store.ts           # 生词本 CRUD
│   ├── flashcard-store.ts      # 知识卡片 CRUD
│   └── tech-words.ts           # 预置技术词汇表（~300 词）
├── popup/
│   ├── App.tsx                 # Popup 主组件
│   ├── App.css                 # Popup 样式
│   ├── main.tsx                # Popup React 入口
│   └── index.html              # Popup HTML
└── flashcards/
    ├── App.tsx                 # Side Panel 主组件
    ├── FlashcardItem.tsx       # 单张卡片组件
    ├── FlashcardList.tsx       # 卡片列表容器
    ├── main.tsx                # Side Panel React 入口
    ├── style.css               # Side Panel 样式
    └── index.html              # Side Panel HTML
```

## 模块依赖关系

```
content.ts (主入口)
├── content/scanner.ts
│   └── content/code-guard.ts
├── content/tooltip.ts
│   ├── lib/word-store.ts
│   ├── lib/translate.ts
│   │   └── lib/translate-cache.ts
│   ├── lib/tech-words.ts
│   ├── lib/mode-manager.ts
│   ├── lib/flashcard-store.ts (动态 import)
│   ├── content/theme-detector.ts
│   └── content/tooltip-sections.ts
├── content/observer.ts
├── lib/word-store.ts
├── lib/mode-manager.ts
└── lib/messages.ts

background.ts
└── lib/messages.ts

popup/App.tsx
├── lib/messages.ts
└── lib/mode-manager.ts (类型引用)

flashcards/App.tsx
├── lib/flashcard-store.ts
├── flashcards/FlashcardItem.tsx
│   └── lib/flashcard-store.ts (类型引用)
└── BackInputWithTags (内置组件)  # 标签高亮输入组件
```

## 消息传递协议

### FLAGS_CHANGED 消息流

当用户在 Popup 切换能力开关时：

```
Popup (App.tsx)
  │  sendFlagsChange({ translate, flashcard })
  ▼
Background (background.ts)
  │  forwardToActiveTab(message)
  │  → browser.tabs.query({ active: true, currentWindow: true })
  │  → browser.tabs.sendMessage(tab.id, message)
  ▼
Content Script (content.ts)
  │  handleFlagsChange(newFlags)
  │  → 差量更新：只处理变化的开关
  │  → translate 关闭：stopObserving + removeAnnotations
  │  → translate 开启：initTooltip + scanAll + startObserving
  │  → 全关：destroyTooltip
  │  → 全开到全关：destroyTooltip
  ▼
实时生效（无需刷新页面）
```

### 消息类型定义

```typescript
type Message =
  | { type: "FLAGS_CHANGED"; flags: FeatureFlags }
  | { type: "MARK_MASTERED"; word: string }
  | { type: "GET_WORD_DATA"; word: string }
  | { type: "WORD_DATA_RESPONSE"; data: WordEntry | null };
```

## Content Script 生命周期

```
页面加载
  │
  ▼
loadFlags()  ← 从 chrome.storage.local 读取开关状态
  │
  ├── anyFlagOn() → initTooltip(rescan)
  │     初始化 tooltip DOM + 注册 mouseup/mouseover/mouseout/mousedown 事件
  │
  ├── flags.translate → scanAll()
  │     getVocabWords() → scanContainer(body) → annotateWords()
  │     startObserving(rescan)  ← MutationObserver 1s 防抖
  │
  └── 监听 runtime.onMessage → handleFlagsChange()
```

## 划词翻译路由逻辑

mouseup 事件触发后（10ms 延迟）：

```
选中文本
  │
  ├── 检测：flags 任一开启？
  ├── 检测：selection 非空？
  ├── 检测：text 长度 ≤ 1000？
  ├── 判断：isSingleWord = /^[a-zA-Z]{3,}$/
  ├── 判断：hasChinese = /[\u4e00-\u9fff]/
  ├── 判断：canTranslate = flags.translate && !hasChinese
  ├── 判断：canFlashcard = flags.flashcard
  ├── 过滤：不在 textarea/input/contenteditable/CodeMirror 内
  │
  ├── canTranslate && canFlashcard → showCombinedTooltip()
  │     翻译内容 + (单词 ? 生词操作 : 无) + 分割线 + 💡标记按钮
  │     点击标记按钮 → showFlashcardEditor(传入翻译结果)
  │
  ├── canTranslate only
  │   ├── isSingleWord → showLearningTooltip()
  │   │     翻译内容（音标+词性+释义）+ 生词操作按钮
  │   └── else → showTranslationTooltip()
  │         纯翻译内容（原文+释义）
  │
  └── canFlashcard only → showFlashcardTooltip()
        💡小方块触发按钮 → 展开编辑器（无翻译切换）
```

## 翻译管线

```
translate(text)
  │
  ├── 内存缓存命中？→ 返回
  ├── 持久层缓存命中？→ 回填内存层 → 返回
  │     检查 7 天过期
  │
  └── API 调用
      fetch(translate.googleapis.com/...)
        │
        ├── 解析 data[0] → 翻译文本
        ├── 解析 data[1] → 词性 → posToAbbr()
        ├── 解析 data[0][x][3] → 音标
        │
        └── 写入缓存
            ├── memoryCache.set(key, result)
            └── storageCache[key] = { ...result, timestamp }
                pruneIfNeeded()  ← 过期淘汰 + 超量淘汰最旧 25%
                flushStorageCache()  ← 异步写入 chrome.storage.local
```

## 生词扫描与标注

```
scanAll()
  │
  ├── getVocabWords() → Map<word, "ordinary" | "technical">
  │     从 chrome.storage.local 读取，过滤 mastered=false
  │
  └── scanContainer(body, vocabWords)
        │
        ├── TreeWalker 遍历所有 Text 节点
        ├── isProtectedNode() → 跳过 CODE/PRE/SCRIPT 等
        ├── extractScannableText() → 剔除 LaTeX 公式
        ├── /[a-zA-Z]{3,}/g → 匹配 3+ 字母单词
        └── vocabWords.get(lower) → 只标注生词本中的词

annotateWords(results)
  │
  ├── 按节点分组
  ├── 逆序处理（保持偏移量正确）
  └── splitText → createElement("span") → replaceChild
        class: lv-word + (lv-ordinary | lv-technical)
        data-word: 原始单词
```

## 主题检测策略

```
detectTheme()
  │
  ├── 主策略：window.matchMedia("(prefers-color-scheme: dark)")
  │
  └── 辅助策略：getComputedStyle(body).backgroundColor
        │
        ├── parseColor(rgb/rgba) → { r, g, b }
        ├── luminance(r, g, b) → WCAG 相对亮度
        ├── alpha === 0？→ 回退到 OS 偏好
        └── lum < 0.5 → "dark"，否则 → "light"
```

**应用范围**：
- Content Script：检测注入页面主题，应用到 tooltip 和标注下划线
- Side Panel：独立检测 OS 偏好（`prefers-color-scheme`），不采样背景色

## 样式隔离

- Tooltip 使用 `position: fixed; z-index: 2147483647`（最大值）确保始终在最上层
- 所有 CSS 类名使用 `lv-` 前缀避免与宿主页面冲突
- 主题变量通过 `[data-lv-theme]` 属性选择器控制
- Side Panel 作为独立页面，无需与宿主页面隔离

## 扩展上下文保护

全局守卫函数 `isContextValid()` 在多个模块中使用：

```typescript
function isContextValid(): boolean {
  try {
    return !!browser.runtime?.id;
  } catch {
    return false;
  }
}
```

**使用位置**：`mode-manager.ts`、`word-store.ts`、`flashcard-store.ts`、`translate-cache.ts`、`content.ts`

**目的**：当扩展被更新/卸载导致上下文失效时，优雅降级而非抛出异常。
