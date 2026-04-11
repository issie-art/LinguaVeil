/**
 * 目录检测模块 - MVP 版本
 * 识别页面中的文章标题层级
 */

/** 目录项结构 */
export interface TocItem {
  id: string;
  level: number;
  text: string;
  element: HTMLElement;
  children: TocItem[];
}

/** 查找文章主容器 */
function findArticleContainer(): HTMLElement | null {
  // 常见文章容器选择器（按优先级）
  const selectors = [
    'article',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.markdown-body',
    '.content',
    'main',
    '.documentation',
    '.docs-content',
    '.blog-post',
    // Product School 常见选择器
    '.entry-content',
    '.post',
    '.single-post',
    '[class*="content"]',
    '[class*="article"]'
  ];

  console.log("[LinguaVeil TOC] Trying selectors...");
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const isValid = el && isValidContainer(el as HTMLElement);
    console.log(`[LinguaVeil TOC] Selector "${selector}":`, el ? (isValid ? "✓ valid" : "✗ invalid (no headings)") : "not found");
    if (el && isValid) {
      return el as HTMLElement;
    }
  }

  // 启发式：找包含最多标题的区域
  console.log("[LinguaVeil TOC] Falling back to heading dense area detection");
  return findHeadingDenseArea();
}

/** 检查容器是否有效 */
function isValidContainer(el: HTMLElement): boolean {
  const headings = el.querySelectorAll('h1, h2, h3, h4, h5, h6');
  return headings.length >= 2; // 至少要有2个标题才认为是文章
}

/** 找标题最密集的区域 */
function findHeadingDenseArea(): HTMLElement | null {
  const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  console.log("[LinguaVeil TOC] Total headings in document:", allHeadings.length);
  
  if (allHeadings.length === 0) return null;
  if (allHeadings.length < 2) return document.body;

  // 简单策略：找包含最多标题的父元素
  const parentMap = new Map<HTMLElement, number>();

  allHeadings.forEach(h => {
    let parent = h.parentElement;
    while (parent && parent !== document.body) {
      parentMap.set(parent, (parentMap.get(parent) || 0) + 1);
      parent = parent.parentElement;
    }
  });

  let bestParent: HTMLElement | null = null;
  let maxCount = 0;

  parentMap.forEach((count, parent) => {
    if (count > maxCount) {
      maxCount = count;
      bestParent = parent;
    }
  });

  console.log("[LinguaVeil TOC] Best parent found:", bestParent ? (bestParent as HTMLElement).tagName : "none", "with", maxCount, "headings");
  return bestParent || document.body;
}

/** 提取标题文本 */
function extractHeadingText(el: HTMLElement): string {
  // 克隆元素以避免修改原 DOM
  const clone = el.cloneNode(true) as HTMLElement;
  
  // 移除常见的非标题内容（如锚点链接、代码标记等）
  clone.querySelectorAll('.anchor, .headerlink, .hash-link, [aria-hidden="true"]').forEach(el => el.remove());
  
  let text = clone.textContent?.trim() || '';
  
  // 限制长度
  if (text.length > 100) {
    text = text.slice(0, 100) + '...';
  }
  
  return text;
}

/** 扫描页面标题 */
export function scanHeadings(): TocItem[] {
  console.log("[LinguaVeil TOC] Scanning headings...");
  
  const container = findArticleContainer();
  console.log("[LinguaVeil TOC] Container found:", container?.tagName || "none");
  
  if (!container) return [];

  const headingElements = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const headings: HTMLElement[] = [];

  console.log("[LinguaVeil TOC] Raw heading elements:", headingElements.length);

  headingElements.forEach((el, index) => {
    const htmlEl = el as HTMLElement;
    
    // 过滤条件
    if (!isVisible(htmlEl)) {
      console.log("[LinguaVeil TOC] Skipping hidden element:", el.tagName);
      return;
    }
    
    const text = extractHeadingText(htmlEl);
    if (!text || text.length < 2) {
      console.log("[LinguaVeil TOC] Skipping empty text:", el.tagName);
      return;
    }

    // 确保有 ID（用于锚点跳转）
    if (!htmlEl.id) {
      htmlEl.id = `lv-toc-${index}`;
    }

    headings.push(htmlEl);
  });

  console.log("[LinguaVeil TOC] Valid headings:", headings.length);

  return buildTocTree(headings);
}

/** 检查元素是否可见 */
function isVisible(el: HTMLElement): boolean {
  try {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0';
  } catch {
    return true; // 如果无法获取样式，默认可见
  }
}

/** 构建目录树 */
function buildTocTree(headings: HTMLElement[]): TocItem[] {
  const root: TocItem[] = [];
  const stack: TocItem[] = [];

  headings.forEach((el) => {
    const level = parseInt(el.tagName[1]); // h1 -> 1, h2 -> 2, etc.
    const text = extractHeadingText(el);
    
    const item: TocItem = {
      id: el.id,
      level,
      text,
      element: el,
      children: []
    };

    // 找到正确的父级
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(item);
    } else {
      stack[stack.length - 1].children.push(item);
    }

    stack.push(item);
  });

  return root;
}

/** 扁平化目录（用于渲染） */
export function flattenToc(items: TocItem[]): Array<{ id: string; level: number; text: string }> {
  const result: Array<{ id: string; level: number; text: string }> = [];
  
  function traverse(items: TocItem[]) {
    for (const item of items) {
      result.push({ id: item.id, level: item.level, text: item.text });
      if (item.children.length > 0) {
        traverse(item.children);
      }
    }
  }
  
  traverse(items);
  return result;
}

/** 获取当前可见的标题 */
export function getCurrentHeading(items: TocItem[]): string | null {
  const scrollY = window.scrollY + 100; // 偏移量，提前触发
  
  let currentId: string | null = null;
  
  function traverse(items: TocItem[]) {
    for (const item of items) {
      const rect = item.element.getBoundingClientRect();
      const elementTop = rect.top + window.scrollY;
      
      if (elementTop <= scrollY) {
        currentId = item.id;
      }
      
      if (item.children.length > 0) {
        traverse(item.children);
      }
    }
  }
  
  traverse(items);
  return currentId;
}
