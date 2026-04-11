/**
 * 消息通信模块
 * 处理 Popup、Background、Content Script 之间的消息传递
 */

import type { FeatureFlags } from "./mode-manager";

/** 生词条目接口 */
export interface WordEntry {
  word: string;
  definition: string;
  partOfSpeech: string;
  type: "ordinary" | "technical";
  firstSeen: number;
  mastered: boolean;
}

/** 抽认卡条目接口 */
export interface FlashcardEntry {
  id: string;
  front: string;
  back: string;
  topic: string;
  context: string;
  sourceUrl: string;
  langFront: "en" | "zh";
  langBack: "en" | "zh";
  createdAt: number;
  reviewCount: number;
  lastReviewed: number | null;
}

/** 消息联合类型 */
export type Message =
  | { type: "FLAGS_CHANGED"; flags: FeatureFlags }
  | { type: "MARK_MASTERED"; word: string }
  | { type: "GET_WORD_DATA"; word: string }
  | { type: "WORD_DATA_RESPONSE"; data: WordEntry | null }
  | { type: "TOGGLE_TOC" };

/**
 * Popup -> Background: 发送能力开关变更消息
 */
export async function sendFlagsChange(flags: FeatureFlags): Promise<void> {
  await browser.runtime.sendMessage({
    type: "FLAGS_CHANGED",
    flags,
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

/**
 * Popup -> Content Script: 发送切换目录消息
 */
export async function sendToggleToc(): Promise<void> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (tab?.id != null) {
    await browser.tabs.sendMessage(tab.id, { type: "TOGGLE_TOC" } satisfies Message);
  }
}
