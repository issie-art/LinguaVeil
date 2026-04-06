/**
 * MutationObserver 管理模块
 * 监听页面内容变化，触发生词重新扫描
 */

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 启动对 document.body 的 MutationObserver 监听
 * 1s 防抖后触发回调
 */
export function startObserving(onContentChange: () => void): void {
  stopObserving();

  if (!document.body) return;

  observer = new MutationObserver(() => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      onContentChange();
    }, 1000);
  });

  observer.observe(document.body, { childList: true, subtree: true });
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