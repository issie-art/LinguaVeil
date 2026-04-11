# 执行计划：已掌握词汇重新加入生词本

> ✅ 已完成 — 代码已合入，待重新构建（`pnpm run dev` 或 `pnpm run build`）后生效。

## 背景

当前用户将生词标记为"已掌握"后，该词从页面标注中永久移除。如果用户后续再次划词翻译该单词，浮窗只显示翻译结果和"添加生词"按钮——但实际上这个词已经在 storage 中存在（mastered: true），点击"添加生词"不会生效（addWord 检查 `!words[key]` 会跳过）。

用户无法将已掌握的词重新放回生词本。

## 目标

用户划词翻译一个已掌握的单词时，轻量提示"已掌握"状态，并提供一键恢复到生词本的入口。

## 交互设计

划词选中单词后，浮窗根据单词在 storage 中的状态显示不同 UI：

| 状态 | 浮窗内容 |
|------|---------|
| 不在生词本 | 翻译 + 音标 + `[+ 添加生词]` 按钮 |
| 在生词本，未掌握 | 翻译 + 音标 + "已在生词本中" 提示 |
| 在生词本，已掌握 | 翻译 + 音标 + "已掌握 · `重新加入生词本？`" 链接 |

点击"重新加入生词本？"后：
1. 调用 `unmaster(word)` → 将 `mastered` 改回 `false`
2. 链接文字变为 "✓ 已恢复"
3. 触发 `rescan` 回调 → 页面重新标注该词

## 改动清单

### 1. word-store.ts — 新增 `unmaster` 函数

位置：`markAsMastered` 函数后面。

```typescript
export async function unmaster(word: string): Promise<void> {
  const words = await loadAll();
  const key = word.toLowerCase();
  if (words[key]) {
    words[key].mastered = false;
    await saveAll(words);
  }
}
```

### 2. tooltip.ts → showSelectionTooltip — 处理已掌握状态

import 新增 `unmaster`：

```typescript
import { addWord, markAsMastered, getWord, unmaster } from "../lib/word-store";
```

状态分支补全（原先缺少 `existing.mastered === true` 的分支）：

```typescript
if (isSingleWord) {
  const existing = await getWord(text);
  if (existing && !existing.mastered) {
    html += `<div class="lv-tooltip-hint">已在生词本中</div>`;
  } else if (existing && existing.mastered) {
    html += `<div class="lv-tooltip-hint">已掌握 · <a class="lv-tooltip-restore" href="#">重新加入生词本？</a></div>`;
  } else {
    html += `<button class="lv-tooltip-add">+ 添加生词</button>`;
  }
}
```

恢复链接点击事件绑定（在添加生词按钮绑定之前）：

```typescript
const restoreLink = tooltipEl.querySelector('.lv-tooltip-restore');
restoreLink?.addEventListener('click', async (e) => {
  e.preventDefault();
  await unmaster(text);
  restoreLink.textContent = '✓ 已恢复';
  onWordAdded?.();
});
```

### 3. styles.css — 新增恢复链接样式

```css
.lv-tooltip-restore {
  color: #60a5fa;
  text-decoration: none;
  cursor: pointer;
}

.lv-tooltip-restore:hover {
  text-decoration: underline;
}
```

## 不涉及的文件

- `content.ts` — 无需改动，rescan 回调已通过 `onWordAdded` 传入
- `background.ts` — 无需改动，不涉及消息通信
- `messages.ts` — 无需改动，不新增消息类型
- `scanner.ts` — 无需改动，`getVocabWords` 已正确过滤 mastered 词汇

## 验证方式

1. 划词翻译一个新单词 → 点击"添加生词" → 页面出现下划线标注
2. hover 标注词 → 点击"已掌握" → 标注消失
3. 再次划词翻译同一个单词 → 浮窗显示"已掌握 · 重新加入生词本？"
4. 点击"重新加入生词本？" → 文字变为"✓ 已恢复" → 页面重新出现下划线标注

## 备注

- 源码改动已完成并通过类型检查，生产构建产物（`.output/chrome-mv3/`）已包含改动
- 开发构建产物（`.output/chrome-mv3-dev/`）为旧版本，需重新执行 `pnpm run dev` 更新
