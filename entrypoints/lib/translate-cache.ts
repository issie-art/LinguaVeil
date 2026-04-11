/**
 * Translate_Cache 模块
 * 两层缓存：内存层（Map）+ 持久层（chrome.storage.local）
 * 缓存命中时直接返回，避免重复网络请求
 */

import type { TranslateResult } from "./translate";

const STORAGE_KEY = "lv_translate_cache";
const MAX_ENTRIES = 500;
const PRUNE_RATIO = 0.25;
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

interface CachedEntry {
  translation: string;
  partOfSpeech: string;
  phonetic: string;
  timestamp: number;
}

/** 内存层缓存 */
const memoryCache = new Map<string, TranslateResult>();

/** 持久层缓存（懒加载） */
let storageCache: Record<string, CachedEntry> | null = null;

/** 检查扩展上下文是否仍然有效 */
function isContextValid(): boolean {
  try {
    return !!browser.runtime?.id;
  } catch {
    return false;
  }
}

/** 生成缓存 key：单词全小写，短语保留大小写 */
function cacheKey(text: string): string {
  const trimmed = text.trim();
  // 单个英文单词 → 小写
  if (/^[a-zA-Z]+$/.test(trimmed)) return trimmed.toLowerCase();
  return trimmed;
}

/** 懒加载持久层缓存 */
async function loadStorageCache(): Promise<Record<string, CachedEntry>> {
  if (storageCache !== null) return storageCache;
  if (!isContextValid()) {
    storageCache = {};
    return storageCache;
  }
  try {
    const result = await browser.storage.local.get(STORAGE_KEY);
    storageCache = (result[STORAGE_KEY] as Record<string, CachedEntry>) ?? {};
  } catch {
    storageCache = {};
  }
  return storageCache;
}

/** 持久化写入 */
async function flushStorageCache(): Promise<void> {
  if (!isContextValid() || storageCache === null) return;
  try {
    await browser.storage.local.set({ [STORAGE_KEY]: storageCache });
  } catch {
    // 静默失败
  }
}

/** 淘汰过期和超量条目 */
function pruneIfNeeded(cache: Record<string, CachedEntry>): void {
  const now = Date.now();

  // 1. 移除过期条目
  for (const [key, entry] of Object.entries(cache)) {
    if (now - entry.timestamp > EXPIRY_MS) {
      delete cache[key];
    }
  }

  // 2. 超量淘汰最旧的 25%
  const keys = Object.keys(cache);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys.sort(
      (a, b) => cache[a].timestamp - cache[b].timestamp,
    );
    const pruneCount = Math.ceil(keys.length * PRUNE_RATIO);
    for (let i = 0; i < pruneCount; i++) {
      delete cache[sorted[i]];
    }
  }
}

/** 从 CachedEntry 转换为 TranslateResult */
function toResult(entry: CachedEntry): TranslateResult {
  return {
    translation: entry.translation,
    partOfSpeech: entry.partOfSpeech,
    phonetic: entry.phonetic,
  };
}

/**
 * 查询缓存
 * 查找顺序：内存 → 持久层
 */
export async function getCached(text: string): Promise<TranslateResult | null> {
  const key = cacheKey(text);

  // 内存层
  const memHit = memoryCache.get(key);
  if (memHit) return memHit;

  // 持久层
  const storage = await loadStorageCache();
  const entry = storage[key];

  if (!entry) return null;

  // 检查过期
  if (Date.now() - entry.timestamp > EXPIRY_MS) {
    delete storage[key];
    return null;
  }

  const result = toResult(entry);
  // 回填内存层
  memoryCache.set(key, result);
  return result;
}

/**
 * 写入缓存
 * 同时写入内存层和持久层
 */
export async function setCached(
  text: string,
  result: TranslateResult,
): Promise<void> {
  const key = cacheKey(text);

  // 内存层
  memoryCache.set(key, result);

  // 持久层
  const storage = await loadStorageCache();
  storage[key] = {
    translation: result.translation,
    partOfSpeech: result.partOfSpeech,
    phonetic: result.phonetic,
    timestamp: Date.now(),
  };

  // 淘汰检查
  pruneIfNeeded(storage);

  // 异步持久化，不阻塞返回
  flushStorageCache();
}
