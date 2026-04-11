/**
 * Mode_Manager 模块
 * 并行能力开关管理：translate / flashcard 可同时启用
 * translate: 划词翻译 + 生词标注
 * flashcard: 划词创建知识卡片
 */

export interface FeatureFlags {
  translate: boolean;
  flashcard: boolean;
  toc: boolean;
}

const MODES_KEY = "lv_modes";

const DEFAULT_FLAGS: FeatureFlags = { translate: true, flashcard: false, toc: false };

/** 当前内存中的能力状态 */
let currentFlags: FeatureFlags = { ...DEFAULT_FLAGS };

/** 是否已从 storage 加载 */
let loaded = false;

/** 检查扩展上下文是否仍然有效 */
function isContextValid(): boolean {
  try {
    return !!browser.runtime?.id;
  } catch {
    return false;
  }
}

/**
 * 从旧格式迁移到新格式
 * 旧格式: { activeMode: "learning" | "translation" | "flashcard" | "off" }
 * 新格式: { translate: boolean; flashcard: boolean }
 */
function migrateFromLegacy(stored: any): FeatureFlags | null {
  if (stored && typeof stored.activeMode === "string") {
    switch (stored.activeMode) {
      case "learning":
      case "translation":
        return { translate: true, flashcard: false, toc: false };
      case "flashcard":
        return { translate: false, flashcard: true, toc: false };
      case "off":
        return { translate: false, flashcard: false, toc: false };
      default:
        return null;
    }
  }
  return null;
}

/**
 * 从 chrome.storage.local 加载能力状态
 */
export async function loadFlags(): Promise<FeatureFlags> {
  if (!isContextValid()) {
    currentFlags = { ...DEFAULT_FLAGS };
    loaded = true;
    return currentFlags;
  }
  try {
    const result = await browser.storage.local.get(MODES_KEY);
    const stored = result[MODES_KEY] as any;
    if (stored) {
      // 尝试新格式
      if (typeof stored.translate === "boolean") {
        currentFlags = {
          translate: stored.translate,
          flashcard: !!stored.flashcard,
          toc: !!stored.toc,
        };
      } else {
        // 尝试旧格式迁移
        const migrated = migrateFromLegacy(stored);
        if (migrated) {
          currentFlags = migrated;
          // 异步写回新格式
          browser.storage.local.set({ [MODES_KEY]: currentFlags }).catch(() => {});
        } else {
          currentFlags = { ...DEFAULT_FLAGS };
        }
      }
    } else {
      currentFlags = { ...DEFAULT_FLAGS };
    }
  } catch {
    currentFlags = { ...DEFAULT_FLAGS };
  }
  loaded = true;
  return currentFlags;
}

/**
 * 获取当前能力状态
 */
export function getFlags(): FeatureFlags {
  return currentFlags;
}

/**
 * 设置能力状态并持久化
 */
export async function setFlags(flags: FeatureFlags): Promise<void> {
  currentFlags = { ...flags };
  if (!isContextValid()) return;
  try {
    await browser.storage.local.set({ [MODES_KEY]: currentFlags });
  } catch {
    // 静默失败
  }
}

/**
 * 判断是否有任何能力开启
 */
export function anyFlagOn(): boolean {
  return currentFlags.translate || currentFlags.flashcard || currentFlags.toc;
}
