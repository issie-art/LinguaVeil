/**
 * 目录浮动面板组件 - MVP 版本
 */

import { scanHeadings, flattenToc, getCurrentHeading, type TocItem } from "./toc-detector";
import { getCurrentTheme } from "./theme-detector";

let tocPanel: HTMLDivElement | null = null;
let tocToggle: HTMLButtonElement | null = null;
let tocHost: HTMLDivElement | null = null; // Shadow DOM 宿主元素
let tocItems: TocItem[] = [];
let scrollListener: (() => void) | null = null;
let currentHighlightId: string | null = null;
let isExpanded = false; // 目录面板默认收起
let isBreadcrumbVisible = false; // 面包屑默认隐藏，由 Popup 开关控制
let initPromise: Promise<boolean> | null = null; // 初始化状态跟踪

/** 初始化目录组件（创建面包屑按钮，但不显示） */
export function initTocWidget(): Promise<boolean> {
  // 如果已在初始化中，返回现有 Promise
  if (initPromise) return initPromise;
  
  // 如果已初始化，立即返回成功
  if (tocToggle) return Promise.resolve(true);

  initPromise = new Promise((resolve) => {
    const init = () => {
      // 扫描标题
      tocItems = scanHeadings();
      if (tocItems.length === 0) {
        console.log("[LinguaVeil TOC] No headings found");
        initPromise = null;
        resolve(false);
        return;
      }

      console.log("[LinguaVeil TOC] Found", tocItems.length, "top-level headings");

      // 创建面包屑切换按钮（默认隐藏）
      createToggleButton();
      
      // 创建目录面板（默认隐藏）
      createTocPanel();
      
      // 绑定滚动监听
      bindScrollSync();
      
      // 如果之前请求显示面包屑，现在应用
      if (isBreadcrumbVisible && tocToggle) {
        tocToggle.style.display = "flex";
      }
      
      resolve(true);
    };

    // 如果页面已加载完成，立即执行；否则等待加载
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(init, 0); // 使用 0 延迟，让当前调用栈完成
    } else {
      document.addEventListener('DOMContentLoaded', init);
    }
  });
  
  return initPromise;
}

/** 显示/隐藏面包屑按钮 */
export async function showBreadcrumb(show: boolean): Promise<void> {
  isBreadcrumbVisible = show;
  
  // 如果组件未初始化，先初始化
  if (!tocToggle && show) {
    await initTocWidget();
  }
  
  // 应用显示状态
  if (tocToggle) {
    tocToggle.style.display = show ? "flex" : "none";
  }
  
  // 隐藏面包屑时，同时收起目录面板
  if (!show && tocPanel) {
    isExpanded = false;
    tocPanel.classList.remove("lv-toc-visible");
  }
}

/** 获取挂载容器（优先使用 GitHub 的 portal root） */
function getMountContainer(): HTMLElement {
  // 优先挂载到 GitHub 的 primer portal root，避免样式干扰
  const primerRoot = document.getElementById('__primerPortalRoot__');
  if (primerRoot) return primerRoot;
  
  // 其次使用 body
  return document.body;
}

/** 创建切换按钮（面包屑） */
function createToggleButton(): void {
  tocToggle = document.createElement("button");
  tocToggle.className = "lv-toc-toggle";
  tocToggle.style.display = "none"; // 默认隐藏，由 Popup 开关控制
  tocToggle.innerHTML = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  `;
  tocToggle.title = "点击展开目录";
  
  tocToggle.addEventListener("click", () => {
    isExpanded = !isExpanded;
    if (tocPanel) {
      tocPanel.classList.toggle("lv-toc-visible", isExpanded);
    }
  });
  
  getMountContainer().appendChild(tocToggle);
}

/** 创建目录面板 */
function createTocPanel(): void {
  // 创建宿主元素
  tocHost = document.createElement("div");
  tocHost.className = "lv-toc-host";
  tocHost.style.cssText = `
    position: fixed;
    right: 70px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2147483647;
    width: 260px;
    max-height: 70vh;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    pointer-events: none;
  `;
  
  // 使用 Shadow DOM 隔离样式
  const shadow = tocHost.attachShadow({ mode: 'open' });
  
  // 创建面板内容
  tocPanel = document.createElement("div");
  tocPanel.className = "lv-toc-panel";
  tocPanel.dataset.lvTheme = getCurrentTheme();
  
  // 注入样式到 Shadow DOM
  const style = document.createElement("style");
  style.textContent = getTocStyles();
  shadow.appendChild(style);
  
  // 头部
  const header = document.createElement("div");
  header.className = "lv-toc-header";
  header.innerHTML = `
    <span class="lv-toc-title">目录</span>
    <button class="lv-toc-close" title="关闭">×</button>
  `;
  
  // 关闭按钮 - 只收起面板，不销毁组件
  const closeBtn = header.querySelector(".lv-toc-close") as HTMLButtonElement;
  closeBtn.addEventListener("click", () => {
    isExpanded = false;
    tocPanel!.classList.remove("lv-toc-visible");
  });
  
  // 内容区
  const content = document.createElement("div");
  content.className = "lv-toc-content";
  
  // 渲染目录项
  const flatItems = flattenToc(tocItems);
  flatItems.forEach(item => {
    const link = document.createElement("a");
    link.className = "lv-toc-item";
    link.dataset.level = String(item.level);
    link.dataset.id = item.id;
    link.textContent = item.text;
    link.href = `#${item.id}`;
    
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.getElementById(item.id);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    
    content.appendChild(link);
  });
  
  tocPanel.appendChild(header);
  tocPanel.appendChild(content);
  shadow.appendChild(tocPanel);
  
  // 挂载到 body（Shadow DOM 内部样式已隔离）
  document.body.appendChild(tocHost);
}

/** 获取目录样式（用于 Shadow DOM） */
function getTocStyles(): string {
  return `
    :host {
      all: initial;
    }
    
    .lv-toc-panel {
      width: 100%;
      /* 使用固定最大高度 */
      max-height: 500px;
      display: flex;
      flex-direction: column;
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      overflow: hidden;
      visibility: hidden;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, visibility 0.2s ease;
    }
    
    .lv-toc-panel[data-lv-theme="light"] {
      background: #ffffff;
      border-color: #e2e8f0;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }
    
    .lv-toc-panel.lv-toc-visible {
      visibility: visible;
      opacity: 1;
      pointer-events: auto;
    }
    
    .lv-toc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #374151;
      flex-shrink: 0;
    }
    
    .lv-toc-panel[data-lv-theme="light"] .lv-toc-header {
      border-bottom-color: #e2e8f0;
    }
    
    .lv-toc-title {
      font-weight: 600;
      font-size: 14px;
      color: #f3f4f6;
    }
    
    .lv-toc-panel[data-lv-theme="light"] .lv-toc-title {
      color: #1f2937;
    }
    
    .lv-toc-close {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      line-height: 1;
      color: #9ca3af;
      background: transparent;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .lv-toc-panel[data-lv-theme="light"] .lv-toc-close {
      color: #64748b;
    }
    
    .lv-toc-close:hover {
      color: #f3f4f6;
      background: #374151;
    }
    
    .lv-toc-panel[data-lv-theme="light"] .lv-toc-close:hover {
      color: #1f2937;
      background: #f1f5f9;
    }
    
    .lv-toc-content {
      overflow-y: auto;
      overflow-x: hidden;
      padding: 8px 0;
      scrollbar-width: thin;
      scrollbar-color: #374151 transparent;
      flex: 1 1 auto;
      min-height: 0;
      /* 使用固定高度而不是 vh，避免 Shadow DOM 中 viewport 计算问题 */
      max-height: 400px;
    }
    
    .lv-toc-panel[data-lv-theme="light"] .lv-toc-content {
      scrollbar-color: #e2e8f0 transparent;
    }
    
    .lv-toc-content::-webkit-scrollbar {
      width: 6px;
    }
    
    .lv-toc-content::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .lv-toc-content::-webkit-scrollbar-thumb {
      background: #374151;
      border-radius: 3px;
    }
    
    .lv-toc-panel[data-lv-theme="light"] .lv-toc-content::-webkit-scrollbar-thumb {
      background: #e2e8f0;
    }
    
    .lv-toc-item {
      display: block;
      padding: 6px 16px;
      color: #9ca3af;
      text-decoration: none;
      border-left: 2px solid transparent;
      transition: all 0.15s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      font-size: 13px;
    }
    
    .lv-toc-panel[data-lv-theme="light"] .lv-toc-item {
      color: #64748b;
    }
    
    .lv-toc-item:hover {
      color: #f3f4f6;
      background: #374151;
    }
    
    .lv-toc-panel[data-lv-theme="light"] .lv-toc-item:hover {
      color: #1f2937;
      background: #f1f5f9;
    }
    
    .lv-toc-item.lv-toc-active {
      color: #3b82f6;
      background: rgba(59, 130, 246, 0.15);
      border-left-color: #3b82f6;
      font-weight: 500;
    }
    
    .lv-toc-panel[data-lv-theme="light"] .lv-toc-item.lv-toc-active {
      color: #2563eb;
      background: rgba(37, 99, 235, 0.1);
      border-left-color: #2563eb;
    }
    
    .lv-toc-item[data-level="1"] {
      font-weight: 600;
      color: #f3f4f6;
    }
    
    .lv-toc-panel[data-lv-theme="light"] .lv-toc-item[data-level="1"] {
      color: #1f2937;
    }
    
    .lv-toc-item[data-level="2"] {
      padding-left: 20px;
    }
    
    .lv-toc-item[data-level="3"] {
      padding-left: 28px;
      font-size: 12px;
    }
    
    .lv-toc-item[data-level="4"] {
      padding-left: 36px;
      font-size: 12px;
    }
    
    .lv-toc-item[data-level="5"],
    .lv-toc-item[data-level="6"] {
      padding-left: 44px;
      font-size: 11px;
    }
  `;
}

/** 绑定滚动同步 */
function bindScrollSync(): void {
  const updateHighlight = () => {
    const currentId = getCurrentHeading(tocItems);
    if (currentId && currentId !== currentHighlightId) {
      currentHighlightId = currentId;
      
      // 更新高亮
      tocPanel?.querySelectorAll(".lv-toc-item").forEach(el => {
        el.classList.toggle("lv-toc-active", (el as HTMLElement).dataset.id === currentId);
      });
      
      // 滚动到可视区
      const activeEl = tocPanel?.querySelector(`[data-id="${currentId}"]`);
      activeEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };
  
  scrollListener = () => {
    requestAnimationFrame(updateHighlight);
  };
  
  window.addEventListener("scroll", scrollListener, { passive: true });
  updateHighlight(); // 初始高亮
}

/** 销毁目录组件 */
export function destroyTocWidget(): void {
  if (scrollListener) {
    window.removeEventListener("scroll", scrollListener);
    scrollListener = null;
  }
  
  tocToggle?.remove();
  tocToggle = null;
  
  // 移除 Shadow DOM 宿主元素（包含面板）
  tocHost?.remove();
  tocHost = null;
  tocPanel = null;
  
  tocItems = [];
  currentHighlightId = null;
  isBreadcrumbVisible = false;
  isExpanded = false;
  initPromise = null; // 重置初始化状态
}

/** 检查目录是否已初始化 */
export function isTocInitialized(): boolean {
  return tocPanel !== null;
}

/** 切换目录面板显示/隐藏 */
export function toggleTocPanel(): void {
  if (!tocPanel) {
    // 如果未初始化，先初始化
    initTocWidget();
  } else {
    // 已初始化，切换显示状态
    isExpanded = !isExpanded;
    tocPanel.classList.toggle("lv-toc-visible", isExpanded);
  }
}