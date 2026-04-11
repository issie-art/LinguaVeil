/**
 * 目录浮动面板组件 - MVP 版本
 */

import { scanHeadings, flattenToc, getCurrentHeading, type TocItem } from "./toc-detector";
import { getCurrentTheme } from "./theme-detector";

let tocPanel: HTMLDivElement | null = null;
let tocToggle: HTMLButtonElement | null = null;
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
    tocPanel.style.display = "none";
  }
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
      tocPanel.style.display = isExpanded ? "flex" : "none";
    }
  });
  
  document.body.appendChild(tocToggle);
}

/** 创建目录面板 */
function createTocPanel(): void {
  tocPanel = document.createElement("div");
  tocPanel.className = "lv-toc-panel";
  tocPanel.dataset.lvTheme = getCurrentTheme();
  tocPanel.style.display = "none"; // 默认隐藏面板
  
  // 头部
  const header = document.createElement("div");
  header.className = "lv-toc-header";
  header.innerHTML = `
    <span class="lv-toc-title">目录</span>
    <button class="lv-toc-close" title="关闭">×</button>
  `;
  
  // 关闭按钮
  const closeBtn = header.querySelector(".lv-toc-close") as HTMLButtonElement;
  closeBtn.addEventListener("click", destroyTocWidget);
  
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
  document.body.appendChild(tocPanel);
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
  
  tocPanel?.remove();
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
    (tocPanel as HTMLDivElement).style.display = isExpanded ? "flex" : "none";
  }
}