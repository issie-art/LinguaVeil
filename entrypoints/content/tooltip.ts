/**
 * Tooltip_Widget 模块
 * 1. 划词：选中文本 → Google Translate 翻译 + "添加生词"按钮（单词时显示）
 * 2. hover 标注词：显示释义 + "已掌握"按钮
 */

import { addWord, markAsMastered, getWord } from '../lib/word-store';
import { translate } from '../lib/translate';
import { TECH_WORDS } from '../lib/tech-words';

export interface TooltipData {
  word: string;
  definition: string;
  partOfSpeech: string;
  type: 'ordinary' | 'technical';
}

let tooltipEl: HTMLDivElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let onMouseOver: ((e: Event) => void) | null = null;
let onMouseOut: ((e: Event) => void) | null = null;
let onMouseUp: ((e: Event) => void) | null = null;
let onClickOutside: ((e: Event) => void) | null = null;
let onWordAdded: (() => void) | null = null;
let translationEnabled = true;

function clearHideTimer(): void {
  if (hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null; }
}

function esc(str: string): string {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/**
 * 设置划词翻译模式开关
 */
export function setTranslationMode(enabled: boolean): void {
  translationEnabled = enabled;
}

/**
 * 初始化 Tooltip 系统
 */
export function initTooltip(onAdded?: () => void): void {
  if (tooltipEl) return;
  onWordAdded = onAdded ?? null;

  tooltipEl = document.createElement('div');
  tooltipEl.className = 'lv-tooltip';
  document.body.appendChild(tooltipEl);

  tooltipEl.addEventListener('mouseenter', () => clearHideTimer());
  tooltipEl.addEventListener('mouseleave', () => hideTooltip());

  // === hover 已标注生词 ===
  onMouseOver = (e: Event) => {
    const target = (e.target as HTMLElement).closest?.('.lv-word') as HTMLElement | null;
    if (!target) return;
    clearHideTimer();
    showAnnotationTooltip(target);
  };

  onMouseOut = (e: Event) => {
    const target = (e.target as HTMLElement).closest?.('.lv-word') as HTMLElement | null;
    if (!target) return;
    hideTooltip();
  };

  document.addEventListener('mouseover', onMouseOver);
  document.addEventListener('mouseout', onMouseOut);

  // === 划词选择 ===
  onMouseUp = (e: Event) => {
    if (tooltipEl?.contains(e.target as Node)) return;

    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const text = selection.toString().trim();
      if (!text || text.length > 1000) return;

      // 判断是单词还是句子/短语
      const isSingleWord = /^[a-zA-Z]{1,}$/.test(text);

      // 如果翻译模式关闭，只处理 .markdown-body 内的单词（用于添加生词）
      // 如果翻译模式开启，处理所有 .markdown-body 内的选中文本
      if (!translationEnabled && !isSingleWord) return;

      // 确保在 .markdown-body 内
      const anchorNode = selection.anchorNode;
      if (!anchorNode) return;
      const el = anchorNode.nodeType === Node.TEXT_NODE
        ? anchorNode.parentNode as Element | null
        : anchorNode as Element;
      if (!el || !el.closest?.('.markdown-body')) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      showSelectionTooltip(rect, text);
    }, 10);
  };

  onClickOutside = (e: Event) => {
    if (tooltipEl?.contains(e.target as Node)) return;
    if ((e.target as HTMLElement).closest?.('.lv-word')) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      hideTooltipImmediate();
    }, 20);
  };

  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mousedown', onClickOutside);
}


/**
 * hover 已标注生词 → 从 store 读取释义 + 已掌握按钮
 */
async function showAnnotationTooltip(target: HTMLElement): Promise<void> {
  if (!tooltipEl) return;

  const word = target.dataset.word ?? '';
  const isTech = target.classList.contains('lv-technical');

  // 先从 store 读取已保存的释义
  const stored = await getWord(word);
  const definition = stored?.definition || '加载中...';
  const pos = stored?.partOfSpeech || '';

  tooltipEl.innerHTML = `
    <div class="lv-tooltip-word">${esc(word)}${pos ? `<span class="lv-tooltip-pos">${esc(pos)}</span>` : ''}</div>
    <div class="lv-tooltip-def">${esc(definition)}</div>
    <button class="lv-tooltip-mastered">✓ 已掌握</button>
  `;

  const btn = tooltipEl.querySelector('.lv-tooltip-mastered') as HTMLButtonElement;
  btn?.addEventListener('click', async () => {
    await markAsMastered(word);
    const lower = word.toLowerCase();
    document.querySelectorAll('.lv-word').forEach((span) => {
      if ((span as HTMLElement).dataset.word?.toLowerCase() === lower) {
        const textNode = document.createTextNode(span.textContent ?? '');
        span.parentNode?.replaceChild(textNode, span);
      }
    });
    document.body.normalize();
    hideTooltipImmediate();
  });

  positionTooltip(target.getBoundingClientRect());

  // 如果释义是空的，异步翻译并更新
  if (!stored?.definition) {
    const result = await translate(word);
    const defEl = tooltipEl?.querySelector('.lv-tooltip-def');
    if (defEl) defEl.textContent = result.translation;
  }
}

/**
 * 划词弹窗：翻译 + 添加生词（单词时）
 */
async function showSelectionTooltip(rect: DOMRect, text: string): Promise<void> {
  if (!tooltipEl) return;

  const isSingleWord = /^[a-zA-Z]{3,}$/.test(text);

  // 先显示加载状态
  tooltipEl.innerHTML = `
    <div class="lv-tooltip-word">${esc(text.length > 50 ? text.slice(0, 50) + '...' : text)}</div>
    <div class="lv-tooltip-def lv-tooltip-loading">翻译中...</div>
  `;
  positionTooltip(rect);

  // 调用 Google Translate
  const result = await translate(text);

  if (!tooltipEl) return;

  // 构建内容
  let html = `
    <div class="lv-tooltip-word">${esc(text.length > 50 ? text.slice(0, 50) + '...' : text)}${
      result.partOfSpeech ? `<span class="lv-tooltip-pos">${esc(result.partOfSpeech)}</span>` : ''
    }</div>
    <div class="lv-tooltip-def">${esc(result.translation)}</div>
  `;

  // 单词才显示"添加生词"按钮
  if (isSingleWord) {
    const existing = await getWord(text);
    if (existing && !existing.mastered) {
      html += `<div class="lv-tooltip-hint">已在生词本中</div>`;
    } else if (!existing) {
      html += `<button class="lv-tooltip-add">+ 添加生词</button>`;
    }
  }

  tooltipEl.innerHTML = html;
  positionTooltip(rect);

  // 绑定添加生词按钮
  if (isSingleWord) {
    const btn = tooltipEl.querySelector('.lv-tooltip-add') as HTMLButtonElement | null;
    btn?.addEventListener('click', async () => {
      const lower = text.toLowerCase();
      const type = TECH_WORDS.has(lower) ? 'technical' as const : 'ordinary' as const;
      await addWord(text, result.translation, result.partOfSpeech, type);
      btn.textContent = '✓ 已添加';
      btn.disabled = true;
      btn.classList.add('lv-tooltip-add--done');
      onWordAdded?.();
      setTimeout(() => hideTooltipImmediate(), 600);
    });
  }
}

function positionTooltip(rect: DOMRect): void {
  if (!tooltipEl) return;
  tooltipEl.style.display = 'block';
  const tr = tooltipEl.getBoundingClientRect();
  const gap = 6;

  let top = rect.bottom + gap;
  if (top + tr.height > window.innerHeight) top = rect.top - tr.height - gap;
  if (top < 0) top = gap;

  let left = rect.left + (rect.width - tr.width) / 2;
  if (left + tr.width > window.innerWidth) left = window.innerWidth - tr.width - gap;
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
  if (tooltipEl) tooltipEl.style.display = 'none';
}

export function destroyTooltip(): void {
  clearHideTimer();
  if (onMouseOver) { document.removeEventListener('mouseover', onMouseOver); onMouseOver = null; }
  if (onMouseOut) { document.removeEventListener('mouseout', onMouseOut); onMouseOut = null; }
  if (onMouseUp) { document.removeEventListener('mouseup', onMouseUp); onMouseUp = null; }
  if (onClickOutside) { document.removeEventListener('mousedown', onClickOutside); onClickOutside = null; }
  if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
  onWordAdded = null;
}