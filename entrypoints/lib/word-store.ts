/**
 * Word_Store 存储模块
 * 基于 browser.storage.local 的生词数据 CRUD
 */

export type { WordEntry } from "./messages";
import type { WordEntry } from "./messages";

const STORAGE_KEY = "lv_words";

/** 检查扩展上下文是否仍然有效 */
function isContextValid(): boolean {
  try {
    return !!browser.runtime?.id;
  } catch {
    return false;
  }
}

/** 从 storage 读取全部生词记录 */
async function loadAll(): Promise<Record<string, WordEntry>> {
  if (!isContextValid()) return {};
  try {
    const result = await browser.storage.local.get(STORAGE_KEY);
    return (result[STORAGE_KEY] as Record<string, WordEntry>) ?? {};
  } catch (err) {
    if (String(err).includes('Extension context invalidated')) return {};
    console.error("[LinguaVeil] Failed to load words from storage:", err);
    return {};
  }
}

/** 将全部生词记录写入 storage */
async function saveAll(words: Record<string, WordEntry>): Promise<void> {
  if (!isContextValid()) return;
  try {
    await browser.storage.local.set({ [STORAGE_KEY]: words });
  } catch (err) {
    if (String(err).includes('Extension context invalidated')) return;
    console.error("[LinguaVeil] Failed to save words to storage:", err);
  }
}

/**
 * 获取用户的生词本（未掌握的词）
 * 返回 Map<word, type> 用于 scanner 标注
 */
export async function getVocabWords(): Promise<
  Map<string, "ordinary" | "technical">
> {
  const words = await loadAll();
  const vocab = new Map<string, "ordinary" | "technical">();
  for (const entry of Object.values(words)) {
    if (!entry.mastered) {
      vocab.set(entry.word.toLowerCase(), entry.type);
    }
  }
  return vocab;
}

/**
 * 添加一个生词到生词本
 */
export async function addWord(
  word: string,
  definition: string,
  partOfSpeech: string,
  type: "ordinary" | "technical",
): Promise<void> {
  try {
    const words = await loadAll();
    const key = word.toLowerCase();
    if (!words[key]) {
      words[key] = {
        word: word.toLowerCase(),
        definition,
        partOfSpeech,
        type,
        firstSeen: Date.now(),
        mastered: false,
      };
      await saveAll(words);
    }
  } catch (err) {
    console.error("[LinguaVeil] Failed to add word:", err);
  }
}

/**
 * 将单词标记为已掌握（从标注中移除）
 */
export async function markAsMastered(word: string): Promise<void> {
  try {
    const words = await loadAll();
    const key = word.toLowerCase();
    if (words[key]) {
      words[key].mastered = true;
      await saveAll(words);
    }
  } catch (err) {
    console.error("[LinguaVeil] Failed to mark word as mastered:", err);
  }
}

/**
 * 将已掌握的单词恢复到生词本（mastered → false）
 */
export async function unmaster(word: string): Promise<void> {
  const words = await loadAll();
  const key = word.toLowerCase();
  if (words[key]) {
    words[key].mastered = false;
    await saveAll(words);
  }
}

/**
 * 查询生词条目
 */
export async function getWord(word: string): Promise<WordEntry | null> {
  const words = await loadAll();
  return words[word.toLowerCase()] ?? null;
}

/**
 * 按掌握状态查询生词列表
 */
export async function queryWords(filter: {
  mastered?: boolean;
}): Promise<WordEntry[]> {
  const words = await loadAll();
  const entries = Object.values(words);
  if (filter.mastered === undefined) return entries;
  return entries.filter((e) => e.mastered === filter.mastered);
}
