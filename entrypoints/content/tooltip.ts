/**
 * Tooltip_Widget 模块
 * 基于 FeatureFlags 并行能力：
 * 1. translate: 划词翻译 + 生词标注（单词显示翻译+生词按钮，短句纯翻译）
 * 2. flashcard: 划词创建知识卡片
 * 3. 两者同时开启时：上半部分翻译 + 分割线 + 下半部分标记按钮
 * 4. hover 已标注生词：translate 开启时显示释义 + 已掌握
 */

import { addWord, markAsMastered, getWord, unmaster } from "../lib/word-store";
import { translate } from "../lib/translate";
import { TECH_WORDS } from "../lib/tech-words";
import { getFlags } from "../lib/mode-manager";
import { initThemeDetector, getCurrentTheme } from "./theme-detector";
import {
  renderTranslationContent,
  renderTranslationLoading,
  renderVocabActions,
  renderAnnotationContent,
  renderFlashcardTrigger,
  renderFlashcardEditor,
} from "./tooltip-sections";

let tooltipEl: HTMLDivElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let onMouseOver: ((e: Event) => void) | null = null;
let onMouseOut: ((e: Event) => void) | null = null;
let onMouseUp: ((e: Event) => void) | null = null;
let onClickOutside: ((e: Event) => void) | null = null;
let onWordAdded: (() => void) | null = null;
let unwatchTheme: (() => void) | null = null;
let isEditing = false; // 标记是否处于编辑模式

function clearHideTimer(): void {
  if (hideTimer !== null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

/**
 * 初始化 Tooltip 系统
 */
export function initTooltip(onAdded?: () => void): void {
  if (tooltipEl) return;
  onWordAdded = onAdded ?? null;

  // 初始化主题检测
  unwatchTheme = initThemeDetector((theme) => {
    if (tooltipEl) tooltipEl.dataset.lvTheme = theme;
  });

  tooltipEl = document.createElement("div");
  tooltipEl.className = "lv-tooltip";
  tooltipEl.dataset.lvTheme = getCurrentTheme();
  document.body.appendChild(tooltipEl);

  tooltipEl.addEventListener("mouseenter", () => clearHideTimer());
  tooltipEl.addEventListener("mouseleave", () => {
    // 编辑模式下不自动隐藏
    if (!isEditing) {
      hideTooltip();
    }
  });

  // === hover 已标注生词（translate 开启时） ===
  onMouseOver = (e: Event) => {
    const target = (e.target as HTMLElement).closest?.(
      ".lv-word",
    ) as HTMLElement | null;
    if (!target) return;
    if (!getFlags().translate) return;
    clearHideTimer();
    showAnnotationTooltip(target);
  };

  onMouseOut = (e: Event) => {
    const target = (e.target as HTMLElement).closest?.(
      ".lv-word",
    ) as HTMLElement | null;
    if (!target) return;
    hideTooltip();
  };

  document.addEventListener("mouseover", onMouseOver);
  document.addEventListener("mouseout", onMouseOut);

  // === 划词选择（基于 flags 组合） ===
  onMouseUp = (e: Event) => {
    if (tooltipEl?.contains(e.target as Node)) return;

    setTimeout(() => {
      const flags = getFlags();
      console.log("[LinguaVeil] mouseUp triggered, flags:", flags);

      if (!flags.translate && !flags.flashcard) {
        console.log("[LinguaVeil] Both flags off, skipping");
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        console.log("[LinguaVeil] No selection or collapsed");
        return;
      }

      const text = selection.toString().trim();
      console.log("[LinguaVeil] Selected text:", text);

      if (!text || text.length > 1000) {
        console.log("[LinguaVeil] Text empty or too long");
        return;
      }

      const isSingleWord = /^[a-zA-Z]{3,}$/.test(text);
      const hasChinese = /[\u4e00-\u9fff]/.test(text);

      // translate 模式不响应中文
      const canTranslate = flags.translate && !hasChinese;
      // flashcard 响应所有文本
      const canFlashcard = flags.flashcard;

      console.log("[LinguaVeil] canTranslate:", canTranslate, "canFlashcard:", canFlashcard);

      if (!canTranslate && !canFlashcard) {
        console.log("[LinguaVeil] Neither can translate nor flashcard");
        return;
      }

      // 确保不在输入框/编辑器内
      const anchorNode = selection.anchorNode;
      if (!anchorNode) return;
      const el =
        anchorNode.nodeType === Node.TEXT_NODE
          ? (anchorNode.parentNode as Element | null)
          : (anchorNode as Element);
      if (!el) return;
      if (el.closest?.('textarea, input, [contenteditable="true"], .CodeMirror, .cm-editor')) {
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // 并行能力：根据 flags 组合决定显示内容
      if (canTranslate && canFlashcard) {
        showCombinedTooltip(rect, text, isSingleWord);
      } else if (canTranslate) {
        // translate only: 单词显示翻译+生词，短句纯翻译
        if (isSingleWord) {
          showLearningTooltip(rect, text);
        } else {
          showTranslationTooltip(rect, text, isSingleWord);
        }
      } else if (canFlashcard) {
        showFlashcardTooltip(rect, text);
      }
    }, 10);
  };

  onClickOutside = (e: Event) => {
    if (tooltipEl?.contains(e.target as Node)) return;
    if ((e.target as HTMLElement).closest?.(".lv-word")) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      hideTooltipImmediate();
    }, 20);
  };

  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("mousedown", onClickOutside);
}

/**
 * hover 已标注生词 → 释义 + 已掌握
 */
async function showAnnotationTooltip(target: HTMLElement): Promise<void> {
  if (!tooltipEl) return;

  const word = target.dataset.word ?? "";
  const stored = await getWord(word);
  const definition = stored?.definition || "加载中...";
  const pos = stored?.partOfSpeech || "";

  tooltipEl.innerHTML = renderAnnotationContent(word, definition, pos);

  const btn = tooltipEl.querySelector(
    ".lv-tooltip-mastered",
  ) as HTMLButtonElement;
  btn?.addEventListener("click", async () => {
    await markAsMastered(word);
    const lower = word.toLowerCase();
    document.querySelectorAll(".lv-word").forEach((span) => {
      if ((span as HTMLElement).dataset.word?.toLowerCase() === lower) {
        const textNode = document.createTextNode(span.textContent ?? "");
        span.parentNode?.replaceChild(textNode, span);
      }
    });
    document.body.normalize();
    hideTooltipImmediate();
  });

  positionTooltip(target.getBoundingClientRect());

  if (!stored?.definition) {
    const result = await translate(word);
    const defEl = tooltipEl?.querySelector(".lv-tooltip-def");
    if (defEl) defEl.textContent = result.translation;
  }
}

// ===== 翻译模式：单词级翻译 + 添加生词 =====

async function showLearningTooltip(
  rect: DOMRect,
  text: string,
): Promise<void> {
  if (!tooltipEl) return;

  // 显示加载状态
  tooltipEl.innerHTML = renderTranslationLoading(text);
  positionTooltip(rect);

  const result = await translate(text);
  if (!tooltipEl) return;

  // 查询生词状态
  const existing = await getWord(text);

  tooltipEl.innerHTML = renderTranslationContent(text, result, true) +
    renderVocabActions(text, existing);
  positionTooltip(rect);

  bindVocabActions(text, result);
}

// ===== 划词翻译：纯翻译，无生词按钮 =====

async function showTranslationTooltip(
  rect: DOMRect,
  text: string,
  isSingleWord: boolean,
): Promise<void> {
  if (!tooltipEl) return;

  tooltipEl.innerHTML = renderTranslationLoading(text);
  positionTooltip(rect);

  const result = await translate(text);
  if (!tooltipEl) return;

  tooltipEl.innerHTML = renderTranslationContent(text, result, isSingleWord);
  positionTooltip(rect);
}

// ===== 并行模式：翻译 + 标记 =====

async function showCombinedTooltip(
  rect: DOMRect,
  text: string,
  isSingleWord: boolean,
): Promise<void> {
  if (!tooltipEl) return;

  // 加载状态
  tooltipEl.innerHTML = renderTranslationLoading(text);
  positionTooltip(rect);

  const result = await translate(text);
  if (!tooltipEl) return;

  // 查询生词状态（仅单词）
  const existing = isSingleWord ? await getWord(text) : null;

  // 构建翻译部分
  let html = renderTranslationContent(text, result, isSingleWord);
  if (isSingleWord) {
    html += renderVocabActions(text, existing);
  }

  // 分割线 + 标记按钮
  html += `<div class="lv-tooltip-divider"></div>`;
  html += renderFlashcardTrigger();

  tooltipEl.innerHTML = html;
  positionTooltip(rect);

  // 绑定生词操作
  if (isSingleWord) {
    bindVocabActions(text, result);
  }

  // 绑定标记触发 - 传入翻译结果以支持原文/译文切换
  const trigger = tooltipEl.querySelector(".lv-flashcard-trigger") as HTMLElement | null;
  trigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    showFlashcardEditor(rect, text, result.translation);
  });
}

/** 绑定生词相关按钮事件 */
function bindVocabActions(text: string, result: { translation: string; partOfSpeech: string }): void {
  if (!tooltipEl) return;

  // 绑定恢复已掌握单词
  const restoreLink = tooltipEl.querySelector('.lv-tooltip-restore');
  restoreLink?.addEventListener('click', async (e) => {
    e.preventDefault();
    await unmaster(text);
    restoreLink.textContent = '✓ 已恢复';
    onWordAdded?.();
  });

  // 绑定添加生词
  const addBtn = tooltipEl.querySelector(
    ".lv-tooltip-add",
  ) as HTMLButtonElement | null;
  addBtn?.addEventListener("click", async () => {
    const lower = text.toLowerCase();
    const type = TECH_WORDS.has(lower)
      ? ("technical" as const)
      : ("ordinary" as const);
    await addWord(text, result.translation, result.partOfSpeech, type);
    addBtn.textContent = "✓ 已添加";
    addBtn.disabled = true;
    addBtn.classList.add("lv-tooltip-add--done");
    onWordAdded?.();
    setTimeout(() => hideTooltipImmediate(), 600);
  });
}

// ===== 知识概念模式：知识卡片创建区 =====

/** 从文本中提取 #标签 格式的标签 */
function parseTagsFromText(text: string): { content: string; tags: string[] } {
  const tagRegex = /#([^\s#]+)/g;
  const tags: string[] = [];
  let match;
  while ((match = tagRegex.exec(text)) !== null) {
    tags.push(match[1]);
  }
  const content = text.replace(tagRegex, "").trim();
  return { content, tags };
}

/** 显示编辑框 */
async function showFlashcardEditor(
  rect: DOMRect,
  text: string,
  translation?: string,
): Promise<void> {
  if (!tooltipEl) return;

  isEditing = true;

  // 加载已有标签
  let existingTags: string[] = [];
  try {
    const { queryCards } = await import("../lib/flashcard-store");
    const allCards = await queryCards();
    const tagSet = new Set<string>();
    allCards.forEach((c) => {
      if (c.topic) {
        c.topic.split(",").forEach((t) => {
          if (t.trim()) tagSet.add(t.trim());
        });
      }
    });
    existingTags = Array.from(tagSet).sort().slice(0, 10); // 最多10个
  } catch { /* ignore */ }

  // 是否显示翻译切换（当在翻译模式下且有翻译结果时）
  const showTranslationToggle = !!translation;
  let isShowingTranslation = false;

  const renderEditor = () => {
    if (!tooltipEl) return;
    tooltipEl.innerHTML = renderFlashcardEditor(
      { text, translation },
      existingTags,
      showTranslationToggle,
      isShowingTranslation,
    );
    positionTooltip(rect);
    bindEditorEvents();
  };

  const bindEditorEvents = () => {
    if (!tooltipEl) return;

    // 绑定按钮事件
    const createBtn = tooltipEl.querySelector(
      ".lv-flashcard-create-btn",
    ) as HTMLButtonElement | null;
    const cancelBtn = tooltipEl.querySelector(
      ".lv-flashcard-cancel-btn",
    ) as HTMLButtonElement | null;
    const closeBtn = tooltipEl.querySelector(
      ".lv-flashcard-editor-close",
    ) as HTMLButtonElement | null;
    const backInput = tooltipEl.querySelector(
      ".lv-flashcard-back-input",
    ) as HTMLTextAreaElement | null;
    const toggleBtn = tooltipEl.querySelector(
      ".lv-flashcard-translation-toggle",
    ) as HTMLButtonElement | null;

    // 原文/译文切换按钮
    toggleBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      isShowingTranslation = !isShowingTranslation;
      renderEditor();
    });

    // 保存按钮
    createBtn?.addEventListener("click", async () => {
      const { addCard } = await import("../lib/flashcard-store");
      const rawInput = backInput?.value?.trim() || "";

      // 解析标签和内容（允许空内容）
      const { content, tags } = parseTagsFromText(rawInput);

      // 获取当前显示的正面内容（从 data 属性获取完整文本，避免截断）
      const frontEl = tooltipEl?.querySelector(".lv-flashcard-front") as HTMLElement | null;
      const isShowingTranslation = frontEl?.hasAttribute("data-front-translation");
      const currentFront = isShowingTranslation
        ? (frontEl?.dataset.translationText || text)
        : (frontEl?.dataset.originalText || text);

      await addCard({
        front: currentFront,
        back: content,
        topic: tags.join(","),
        context: extractContext(text),
        sourceUrl: location.href,
        langFront: "en",
        langBack: "zh",
      });

      hideTooltipImmediate();
    });

    // 取消按钮
    const handleCancel = () => {
      hideTooltipImmediate();
    };
    cancelBtn?.addEventListener("click", handleCancel);
    closeBtn?.addEventListener("click", handleCancel);

    // 标签快捷选择
    tooltipEl.querySelectorAll(".lv-flashcard-tag-pill").forEach((pill) => {
      pill.addEventListener("click", (e) => {
        e.stopPropagation();
        const tag = (pill as HTMLElement).dataset.tag;
        if (tag && backInput) {
          const current = backInput.value;
          const tagStr = `#${tag}`;
          if (!current.includes(tagStr)) {
            backInput.value = current ? `${current} ${tagStr}` : tagStr;
          }
          backInput.focus();
        }
      });
    });
  };

  renderEditor();
}

function showFlashcardTooltip(
  rect: DOMRect,
  text: string,
): void {
  showFlashcardTrigger(rect, text);
}

/** 显示小方块触发按钮 */
function showFlashcardTrigger(
  rect: DOMRect,
  text: string,
): void {
  if (!tooltipEl) return;

  isEditing = false;
  tooltipEl.innerHTML = renderFlashcardTrigger();
  positionTooltip(rect);

  // 绑定点击事件展开编辑器（无翻译模式）
  const trigger = tooltipEl.querySelector(".lv-flashcard-trigger") as HTMLElement | null;
  trigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    showFlashcardEditor(rect, text);
  });
}

/**
 * 提取选中文本的上下文句子
 */
function extractContext(selectedText: string): string {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return "";

  try {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const textContent = container.textContent || "";
    const startOffset = range.startOffset;
    const contextStart = Math.max(0, startOffset - 50);
    const contextEnd = Math.min(textContent.length, range.endOffset + 50);
    return textContent.slice(contextStart, contextEnd).trim();
  } catch {
    return selectedText;
  }
}

function positionTooltip(rect: DOMRect): void {
  if (!tooltipEl) return;
  tooltipEl.style.display = "block";
  const tr = tooltipEl.getBoundingClientRect();
  const gap = 6;

  let top = rect.bottom + gap;
  if (top + tr.height > window.innerHeight) top = rect.top - tr.height - gap;
  if (top < 0) top = gap;

  let left = rect.left + (rect.width - tr.width) / 2;
  if (left + tr.width > window.innerWidth)
    left = window.innerWidth - tr.width - gap;
  if (left < 0) left = gap;

  tooltipEl.style.top = `${top}px`;
  tooltipEl.style.left = `${left}px`;
}

export function hideTooltip(): void {
  clearHideTimer();
  hideTimer = setTimeout(() => hideTooltipImmediate(), 200);
}

function hideTooltipImmediate(): void {
  clearHideTimer();
  isEditing = false;
  if (tooltipEl) tooltipEl.style.display = "none";
}

export function destroyTooltip(): void {
  clearHideTimer();
  if (onMouseOver) {
    document.removeEventListener("mouseover", onMouseOver);
    onMouseOver = null;
  }
  if (onMouseOut) {
    document.removeEventListener("mouseout", onMouseOut);
    onMouseOut = null;
  }
  if (onMouseUp) {
    document.removeEventListener("mouseup", onMouseUp);
    onMouseUp = null;
  }
  if (onClickOutside) {
    document.removeEventListener("mousedown", onClickOutside);
    onClickOutside = null;
  }
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
  if (unwatchTheme) {
    unwatchTheme();
    unwatchTheme = null;
  }
  onWordAdded = null;
  isEditing = false;
}
