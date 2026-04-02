import './content/styles.css';
import { scanContainer, annotateWords, removeAnnotations } from './content/scanner';
import { initTooltip, destroyTooltip, setTranslationMode } from './content/tooltip';
import { startObserving, stopObserving } from './content/observer';
import { getVocabWords } from './lib/word-store';
import type { Message } from './lib/messages';

const MODES_KEY = 'lv_modes';

/**
 * GitHub 页面上的 markdown 内容区域选择器
 * 直接匹配所有 .markdown-body，排除编辑器和表单内的
 */
const CONTENT_SELECTORS = [
  '#readme .markdown-body',           // 仓库首页 README
  '.js-discussion .markdown-body',    // PR / Issue 描述
  '.comment-body .markdown-body',     // PR / Issue 评论
  '.blob-wrapper .markdown-body',     // 查看 .md 文件
  '#wiki-body .markdown-body',        // Wiki 页面
  // GitHub 新版 UI 可能用的选择器
  '[data-target="readme-toc.content"] .markdown-body',
  '.Layout-main .markdown-body',
  'article.markdown-body',
  '.entry-content .markdown-body',
];

/** 查找页面上所有匹配的 markdown 内容容器，兜底用所有 .markdown-body */
function findContainers(): Element[] {
  // 先尝试精确选择器
  const selector = CONTENT_SELECTORS.join(', ');
  const matched = Array.from(document.querySelectorAll(selector));
  if (matched.length > 0) return matched;

  // 兜底：取所有 .markdown-body，排除在 textarea/input/form 内的
  return Array.from(document.querySelectorAll('.markdown-body')).filter(el => {
    // 排除编辑器内的
    if (el.closest('textarea, .CodeMirror, .cm-editor')) return false;
    // 排除太小的（可能是 inline 片段）
    if (el.textContent && el.textContent.trim().length < 50) return false;
    return true;
  });
}

async function isLearningModeOn(): Promise<boolean> {
  try {
    const result = await browser.storage.local.get(MODES_KEY);
    const modes = (result[MODES_KEY] as { learning: boolean; translation?: boolean }) ?? { learning: true };
    return modes.learning;
  } catch {
    return true;
  }
}

async function isTranslationModeOn(): Promise<boolean> {
  try {
    const result = await browser.storage.local.get(MODES_KEY);
    const modes = (result[MODES_KEY] as { translation?: boolean }) ?? { translation: true };
    return modes.translation ?? true;
  } catch {
    return true;
  }
}

/** 扫描并标注所有容器中用户生词本里的词 */
async function scanAll(): Promise<void> {
  const vocabWords = await getVocabWords();
  console.log('[LinguaVeil] scanAll: vocabWords size =', vocabWords.size, [...vocabWords.keys()]);
  if (vocabWords.size === 0) return;

  const containers = findContainers();
  console.log('[LinguaVeil] scanAll: containers found =', containers.length);
  // 如果没找到，打印页面上所有 .markdown-body 的父元素，帮助调试
  if (containers.length === 0) {
    const all = document.querySelectorAll('.markdown-body');
    console.log('[LinguaVeil] all .markdown-body on page:', all.length,
      Array.from(all).map(el => el.parentElement?.id || el.parentElement?.className || el.className));
  }

  for (const container of containers) {
    const results = scanContainer(container, vocabWords);
    console.log('[LinguaVeil] scanAll: scan results =', results.length);
    annotateWords(results);
  }
}

/** 移除所有容器中的标注 */
function removeAll(): void {
  for (const container of findContainers()) {
    removeAnnotations(container);
  }
}

/** 防止 rescan 循环 */
let scanning = false;

/** 重新扫描（添加生词后 / 内容变化后触发） */
function rescan(): void {
  if (scanning) return;
  scanning = true;
  // 暂停 observer，避免 DOM 修改触发循环
  stopObserving();
  removeAll();
  scanAll().finally(() => {
    scanning = false;
    // 扫描完成后重新启动 observer
    if (findContainers().length > 0) {
      startObserving(rescan);
    }
  });
}

export default defineContentScript({
  matches: ['https://github.com/*'],

  async main() {
    let learningOn = await isLearningModeOn();
    const translationOn = await isTranslationModeOn();
    setTranslationMode(translationOn);

    if (learningOn) {
      await scanAll();
      initTooltip(rescan);

      const containers = findContainers();
      if (containers.length > 0) {
        startObserving(rescan);
      }
    }

    // 监听 DOM 变化：GitHub PJAX/Turbo 导航后内容区域可能出现/消失
    let prevCount = findContainers().length;

    const docObserver = new MutationObserver(() => {
      if (!learningOn) return;

      const curCount = findContainers().length;

      if (prevCount === 0 && curCount > 0) {
        // 新内容区域出现
        scanAll().then(() => startObserving(rescan));
      } else if (prevCount > 0 && curCount === 0) {
        // 内容区域消失
        stopObserving();
      } else if (curCount > 0 && curCount !== prevCount) {
        // 容器数量变化（如新评论加载）
        rescan();
      }

      prevCount = curCount;
    });

    docObserver.observe(document.body, { childList: true, subtree: true });

    // 监听 Popup 消息
    browser.runtime.onMessage.addListener((message: Message) => {
      if (message.type === 'LEARNING_MODE_CHANGED') {
        if (!message.enabled) {
          learningOn = false;
          stopObserving();
          removeAll();
          destroyTooltip();
        } else {
          learningOn = true;
          removeAll();
          scanAll().then(() => {
            initTooltip(rescan);
            setTranslationMode(translationOn);
            if (findContainers().length > 0) {
              startObserving(rescan);
            }
          });
        }
      } else if (message.type === 'TRANSLATION_MODE_CHANGED') {
        setTranslationMode(message.enabled);
      }
    });
  },
});