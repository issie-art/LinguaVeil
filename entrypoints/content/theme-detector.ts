/**
 * Theme_Detector 模块
 * 检测页面深浅色主题，为 tooltip 和标注提供主题适配
 *
 * 检测策略：
 * 1. 主策略：OS 级 prefers-color-scheme
 * 2. 辅助策略：采样页面 body 背景色亮度
 */

export type Theme = "dark" | "light";

/** 将 RGB 各通道解析为 0-1 数值 */
function parseColor(color: string): { r: number; g: number; b: number } | null {
  // 处理 rgb(r, g, b) 格式
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]) / 255,
      g: parseInt(rgbMatch[2]) / 255,
      b: parseInt(rgbMatch[3]) / 255,
    };
  }
  return null;
}

/** 计算相对亮度（WCAG 标准） */
function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * 检测当前页面的主题
 * 综合考虑 OS 偏好和页面实际背景色
 */
export function detectTheme(): Theme {
  // 主策略：OS 级偏好
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  // 辅助策略：采样页面 body 背景色
  try {
    const bgColor = getComputedStyle(document.body).backgroundColor;
    const parsed = parseColor(bgColor);
    if (parsed) {
      const lum = luminance(parsed.r, parsed.g, parsed.b);
      // 背景色亮度低于 0.5 → 深色页面
      // 如果 body 背景透明（如 rgba(0,0,0,0)），亮度为 0 但实际可能不是深色
      // 检测透明度：如果 alpha 为 0，则回退到 OS 偏好
      const alphaMatch = bgColor.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\)/);
      if (alphaMatch && parseFloat(alphaMatch[1]) === 0) {
        return prefersDark ? "dark" : "light";
      }
      return lum < 0.5 ? "dark" : "light";
    }
  } catch {
    // getComputedStyle 可能失败
  }

  return prefersDark ? "dark" : "light";
}

/**
 * 应用主题到 DOM
 * 在 document.documentElement 上设置 data-lv-theme 属性
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.lvTheme = theme;
}

/**
 * 获取当前主题
 */
export function getCurrentTheme(): Theme {
  return (document.documentElement.dataset.lvTheme as Theme) || detectTheme();
}

/**
 * 监听主题变化
 * 返回一个取消监听的函数
 */
export function watchTheme(callback: (theme: Theme) => void): () => void {
  // 监听 OS 级偏好变化
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    const theme = detectTheme();
    applyTheme(theme);
    callback(theme);
  };

  mediaQuery.addEventListener("change", handler);

  // 返回取消函数
  return () => {
    mediaQuery.removeEventListener("change", handler);
  };
}

/**
 * 初始化主题检测
 * 检测并应用主题，同时启动监听
 */
export function initThemeDetector(onChange?: (theme: Theme) => void): () => void {
  const theme = detectTheme();
  applyTheme(theme);
  return watchTheme(onChange ?? (() => {}));
}
