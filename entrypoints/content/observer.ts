/**
 * MutationObserver 管理模块
 * 监听所有 GitHub markdown 内容区域的变化
 */

const CONTENT_SELECTORS = [
  '#readme .markdown-body',
  '.js-discussion .markdown-body',
  '.comment-body .markdown-body',
  '.blob-wrapper .markdown-body',
  '#wiki-body .markdown-body',
];

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 启动对所有 markdown 内容容器的 MutationObserver 监听
 * 500ms 防抖后触发回调
 */
export function startObserving(onContentChange: () => void): void {
  stopObserving();

  const selector = CONTENT_SELECTORS.join(', ');
  const containers = document.querySelectorAll(selector);
  if (containers.length === 0) return;

  observer = new MutationObserver(() => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      onContentChange();
    }, 1000);  // 1s 防抖，避免标注过程中的 DOM 变化触发重扫
  });

  containers.forEach((container) => {
    observer!.observe(container, { childList: true, subtree: true });
  });
}

/**
 * 停止监听并清理资源
 */
export function stopObserving(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}