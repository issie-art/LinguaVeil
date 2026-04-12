/**
 * Flashcard_Store 模块
 * 知识概念卡数据 CRUD
 * 与生词本独立，定位为记住抽象概念/语法规则/设计模式
 */

export interface FlashcardEntry {
  id: string;
  front: string;
  back: string;
  topic: string;
  sourceUrl: string;
  langFront: "en" | "zh";
  langBack: "en" | "zh";
  createdAt: number;
  reviewCount: number;
  lastReviewed: number | null;
}

const STORAGE_KEY = "lv_flashcards";

/** 检查扩展上下文是否仍然有效 */
function isContextValid(): boolean {
  try {
    return !!browser.runtime?.id;
  } catch {
    return false;
  }
}

/** 从 storage 读取全部抽认卡记录 */
async function loadAll(): Promise<Record<string, FlashcardEntry>> {
  if (!isContextValid()) return {};
  try {
    const result = await browser.storage.local.get(STORAGE_KEY);
    return (result[STORAGE_KEY] as Record<string, FlashcardEntry>) ?? {};
  } catch (err) {
    if (String(err).includes("Extension context invalidated")) return {};
    console.error("[LinguaVeil] Failed to load flashcards from storage:", err);
    return {};
  }
}

/** 将全部抽认卡记录写入 storage */
async function saveAll(cards: Record<string, FlashcardEntry>): Promise<void> {
  if (!isContextValid()) return;
  try {
    await browser.storage.local.set({ [STORAGE_KEY]: cards });
  } catch (err) {
    if (String(err).includes("Extension context invalidated")) return;
    console.error("[LinguaVeil] Failed to save flashcards to storage:", err);
  }
}

/**
 * 创建一张知识概念卡
 */
export async function addCard(
  data: Omit<FlashcardEntry, "id" | "createdAt" | "reviewCount" | "lastReviewed">,
): Promise<FlashcardEntry> {
  const id = crypto.randomUUID();
  const entry: FlashcardEntry = {
    id,
    front: data.front,
    back: data.back,
    topic: data.topic ?? "",
    sourceUrl: data.sourceUrl,
    langFront: data.langFront ?? "en",
    langBack: data.langBack ?? "zh",
    createdAt: Date.now(),
    reviewCount: 0,
    lastReviewed: null,
  };

  const cards = await loadAll();
  cards[id] = entry;
  await saveAll(cards);
  return entry;
}

/**
 * 删除一张抽认卡
 */
export async function deleteCard(id: string): Promise<void> {
  const cards = await loadAll();
  if (cards[id]) {
    delete cards[id];
    await saveAll(cards);
  }
}

/**
 * 更新一张抽认卡
 */
export async function updateCard(
  id: string,
  partial: Partial<Omit<FlashcardEntry, "id" | "createdAt">>,
): Promise<void> {
  const cards = await loadAll();
  if (cards[id]) {
    Object.assign(cards[id], partial);
    await saveAll(cards);
  }
}

/**
 * 查询单张抽认卡
 */
export async function getCard(id: string): Promise<FlashcardEntry | null> {
  const cards = await loadAll();
  return cards[id] ?? null;
}

/**
 * 查询抽认卡列表
 */
export async function queryCards(filter?: {
  topic?: string;
}): Promise<FlashcardEntry[]> {
  const cards = await loadAll();
  let entries = Object.values(cards);

  if (filter?.topic) {
    entries = entries.filter((e) => e.topic === filter.topic);
  }

  return entries;
}

/**
 * 获取全部抽认卡数量
 */
export async function getCardCount(): Promise<number> {
  const cards = await loadAll();
  return Object.keys(cards).length;
}
