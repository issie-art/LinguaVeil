/**
 * 消息通信模块
 * 处理 Popup、Background、Content Script 之间的消息传递
 */

/** 生词条目接口（与 word-store.ts 中的 WordEntry 保持一致） */
export interface WordEntry {
  word: string;
  definition: string;
  partOfSpeech: string;
  type: 'ordinary' | 'technical';
  firstSeen: number;
  mastered: boolean;
}

/** 消息联合类型 */
export type Message =
  | { type: 'LEARNING_MODE_CHANGED'; enabled: boolean }
  | { type: 'TRANSLATION_MODE_CHANGED'; enabled: boolean }
  | { type: 'MARK_MASTERED'; word: string }
  | { type: 'GET_WORD_DATA'; word: string }
  | { type: 'WORD_DATA_RESPONSE'; data: WordEntry | null };

/**
 * Popup -> Background: 发送学习模式变更消息
 */
export async function sendModeChange(enabled: boolean): Promise<void> {
  await browser.runtime.sendMessage({
    type: 'LEARNING_MODE_CHANGED',
    enabled,
  } satisfies Message);
}

/**
 * Popup -> Background: 发送翻译模式变更消息
 */
export async function sendTranslationModeChange(enabled: boolean): Promise<void> {
  await browser.runtime.sendMessage({
    type: 'TRANSLATION_MODE_CHANGED',
    enabled,
  } satisfies Message);
}

/**
 * Background -> Content Script: 转发消息到当前活动标签页
 */
export async function forwardToActiveTab(message: Message): Promise<void> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (tab?.id != null) {
    await browser.tabs.sendMessage(tab.id, message);
  }
}
