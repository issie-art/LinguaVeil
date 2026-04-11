import "./content/styles.css";
import {
  scanContainer,
  annotateWords,
  removeAnnotations,
} from "./content/scanner";
import { initTooltip, destroyTooltip } from "./content/tooltip";
import { startObserving, stopObserving } from "./content/observer";
import { initTocWidget, destroyTocWidget, isTocInitialized, showBreadcrumb } from "./content/toc-widget";
import { getVocabWords } from "./lib/word-store";
import {
  loadFlags,
  getFlags,
  setFlags,
  anyFlagOn,
} from "./lib/mode-manager";
import type { Message } from "./lib/messages";
import type { FeatureFlags } from "./lib/mode-manager";

/** 检查扩展上下文是否仍然有效 */
function isContextValid(): boolean {
  try {
    return !!browser.runtime?.id;
  } catch {
    return false;
  }
}

/** 返回扫描容器 */
function findContainers(): Element[] {
  return document.body ? [document.body] : [];
}

/** 扫描并标注所有容器中用户生词本里的词 */
async function scanAll(): Promise<void> {
  const vocabWords = await getVocabWords();
  if (vocabWords.size === 0) return;

  const containers = findContainers();
  for (const container of containers) {
    const results = scanContainer(container, vocabWords);
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
  if (scanning || !isContextValid()) return;
  scanning = true;
  stopObserving();
  removeAll();
  scanAll().finally(() => {
    scanning = false;
    if (findContainers().length > 0) {
      startObserving(rescan);
    }
  });
}

export default defineContentScript({
  matches: ["*://*/*"],

  async main() {
    await loadFlags();

    const flags = getFlags();

    // 任一能力开启 → 初始化 tooltip
    if (anyFlagOn()) {
      initTooltip(rescan);
    }

    // translate 开启 → 扫描标注生词
    if (flags.translate) {
      await scanAll();
      if (findContainers().length > 0) {
        startObserving(rescan);
      }
    }

    // 目录功能：延迟初始化，避免阻塞主流程
    if (flags.toc) {
      // 如果开关已开启，初始化并显示面包屑
      showBreadcrumb(true).catch(console.error);
    } else {
      // 预初始化（不显示），加快后续响应
      initTocWidget().catch(console.error);
    }

    // 监听 DOM 变化（translate 开启时需要）
    let prevCount = findContainers().length;

    const docObserver = new MutationObserver(() => {
      if (!getFlags().translate) return;

      const curCount = findContainers().length;

      if (prevCount === 0 && curCount > 0) {
        scanAll().then(() => startObserving(rescan));
      } else if (prevCount > 0 && curCount === 0) {
        stopObserving();
      } else if (curCount > 0 && curCount !== prevCount) {
        rescan();
      }

      prevCount = curCount;
    });

    docObserver.observe(document.body, { childList: true, subtree: true });

    // 监听 Popup 消息
    browser.runtime.onMessage.addListener((message: Message) => {
      if (message.type === "FLAGS_CHANGED") {
        handleFlagsChange(message.flags);
        return true; // 异步处理
      }
      if (message.type === "TOGGLE_TOC") {
        // 切换面包屑显示状态
        const flags = getFlags();
        showBreadcrumb(flags.toc).catch(console.error);
        return true;
      }
      return false;
    });
  },
});

/**
 * 处理能力开关变更
 * 差量更新：只处理变化的开关
 */
async function handleFlagsChange(newFlags: FeatureFlags): Promise<void> {
  const prevFlags = getFlags();
  await setFlags(newFlags);

  const anyOn = newFlags.translate || newFlags.flashcard || newFlags.toc;
  const wasAnyOn = prevFlags.translate || prevFlags.flashcard || prevFlags.toc;

  // translate 关闭 → 停止扫描/标注
  if (prevFlags.translate && !newFlags.translate) {
    stopObserving();
    removeAll();
  }

  // translate 开启 → 启动扫描/标注
  if (!prevFlags.translate && newFlags.translate) {
    if (!wasAnyOn) {
      initTooltip(rescan);
    }
    await scanAll();
    if (findContainers().length > 0) {
      startObserving(rescan);
    }
  }

  // toc 开关变化 - 控制面包屑显示/隐藏
  if (prevFlags.toc !== newFlags.toc) {
    showBreadcrumb(newFlags.toc).catch(console.error);
  }

  // 任一能力从全关到开启 → 确保 tooltip 初始化
  if (!wasAnyOn && anyOn) {
    initTooltip(rescan);
    return;
  }

  // 全部关闭 → 销毁 tooltip
  if (wasAnyOn && !anyOn) {
    destroyTooltip();
  }
}
