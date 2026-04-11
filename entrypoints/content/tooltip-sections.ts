/**
 * Tooltip_Sections 模块
 * 各模式独立渲染器，互不组合
 */

import type { TranslateResult } from "../lib/translate";
import type { WordEntry } from "../lib/messages";

/** HTML 转义 */
function esc(str: string): string {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ===== Translation Content (learning + translation 模式共用) =====

/**
 * 渲染翻译内容（单词：音标+词性+释义；短语/句子：纯翻译）
 */
export function renderTranslationContent(
  text: string,
  result: TranslateResult,
  isSingleWord: boolean,
): string {
  if (isSingleWord) {
    return `
      <div class="lv-tooltip-word">
        ${esc(text)}
        ${result.partOfSpeech ? `<span class="lv-tooltip-pos">${esc(result.partOfSpeech)}</span>` : ''}
      </div>
      ${result.phonetic ? `<div class="lv-tooltip-phonetic">/${esc(result.phonetic)}/</div>` : ''}
      <div class="lv-tooltip-def">${esc(result.translation)}</div>
    `;
  }

  return `
    <div class="lv-tooltip-word">${esc(text.length > 50 ? text.slice(0, 50) + '...' : text)}</div>
    <div class="lv-tooltip-def">${esc(result.translation)}</div>
  `;
}

/**
 * 渲染翻译加载中状态
 */
export function renderTranslationLoading(text: string): string {
  return `
    <div class="lv-tooltip-word">${esc(text.length > 50 ? text.slice(0, 50) + "..." : text)}</div>
    <div class="lv-tooltip-def lv-tooltip-loading">翻译中...</div>
  `;
}

// ===== Vocab Actions (仅 learning 模式) =====

/**
 * 渲染生词操作区域（添加/已存在/已掌握恢复）
 */
export function renderVocabActions(
  text: string,
  existing: WordEntry | null,
): string {
  if (existing && !existing.mastered) {
    return `<div class="lv-tooltip-hint">已在生词本中</div>`;
  }

  if (existing && existing.mastered) {
    return `<div class="lv-tooltip-hint">已掌握 · <a class="lv-tooltip-restore" href="#">重新加入生词本？</a></div>`;
  }

  return `<button class="lv-tooltip-add">+ 添加生词</button>`;
}

// ===== Annotation Tooltip (hover 已标注词) =====

/**
 * 渲染 hover 标注词的 tooltip 内容
 */
export function renderAnnotationContent(
  word: string,
  definition: string,
  partOfSpeech: string,
): string {
  return `
    <div class="lv-tooltip-word">
      ${esc(word)}
      ${partOfSpeech ? `<span class="lv-tooltip-pos">${esc(partOfSpeech)}</span>` : ""}
    </div>
    <div class="lv-tooltip-def">${esc(definition)}</div>
    <button class="lv-tooltip-mastered">✓ 已掌握</button>
  `;
}

// ===== Flashcard Section (仅 flashcard 模式) =====

export interface FlashcardSectionData {
  text: string;
  translation?: string;
}

/**
 * 渲染划词后的小方块触发按钮
 */
export function renderFlashcardTrigger(): string {
  return `
    <div class="lv-flashcard-trigger" title="添加知识卡片">💡</div>
  `;
}

/**
 * 渲染知识概念卡片编辑框
 * 支持 #标签 格式（不能有空格）
 * 支持原文/译文切换（当提供 translation 时）
 */
export function renderFlashcardEditor(
  data: FlashcardSectionData,
  existingTags?: string[],
  showTranslationToggle?: boolean,
  isShowingTranslation?: boolean,
): string {
  const { text, translation } = data;
  const displayText = text.length > 40 ? text.slice(0, 40) + '...' : text;
  const displayTranslation = translation && translation.length > 40
    ? translation.slice(0, 40) + '...'
    : (translation || '');

  let tagSuggestions = '';
  if (existingTags && existingTags.length > 0) {
    const pills = existingTags.map(
      (t) => `<button class="lv-flashcard-tag-pill" data-tag="${esc(t)}">#${esc(t)}</button>`
    ).join('');
    tagSuggestions = `<div class="lv-flashcard-tag-suggestions">${pills}</div>`;
  }

  // 原文/译文切换按钮
  const toggleBtn = showTranslationToggle && translation
    ? `<button class="lv-flashcard-translation-toggle" data-action="toggle-translation" title="切换原文/译文">
        ${isShowingTranslation ? '原' : '译'}
       </button>`
    : '';

  // 当前显示的正面内容
  const currentFrontText = isShowingTranslation && translation ? displayTranslation : displayText;
  const frontDataAttr = isShowingTranslation && translation ? 'data-front-translation="1"' : '';

  return `
    <div class="lv-flashcard-editor">
      <div class="lv-flashcard-editor-header">
        <span class="lv-flashcard-editor-title">添加知识卡片</span>
        <button class="lv-flashcard-editor-close" title="关闭">×</button>
      </div>
      <div class="lv-flashcard-front-wrapper">
        <div class="lv-flashcard-front" ${frontDataAttr} data-original-text="${esc(text)}" data-translation-text="${esc(translation || '')}">${esc(currentFrontText)}</div>
        ${toggleBtn}
      </div>
      <textarea
        class="lv-flashcard-back-input"
        placeholder="可留空快速标记，#标签 分类"
        rows="4"
      ></textarea>
      ${tagSuggestions}
      <div class="lv-flashcard-hint">提示：使用 #标签 格式添加标签，如 #react #hooks</div>
      <div class="lv-flashcard-actions">
        <button class="lv-flashcard-cancel-btn">取消</button>
        <button class="lv-flashcard-create-btn">保存</button>
      </div>
    </div>
  `;
}
