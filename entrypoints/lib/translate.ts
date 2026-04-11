/**
 * Google Translate 公开 API
 * 免费、无需 API Key，适合 MVP
 * 集成两层缓存（内存 + chrome.storage.local），二次查询瞬出结果
 */

import { getCached, setCached } from "./translate-cache";

export interface TranslateResult {
  translation: string;
  partOfSpeech: string;
  phonetic: string;  // 音标
}

/**
 * 调用 Google Translate API 翻译英文到中文
 * 优先从缓存读取，缓存未命中时调用 API 并写入缓存
 * dt=t 翻译文本, dt=bd 词性, dt=rm 音标/罗马音
 */
export async function translate(text: string): Promise<TranslateResult> {
  // 缓存查找
  const cached = await getCached(text);
  if (cached) return cached;

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&dt=bd&dt=rm&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();

    // data[0] 翻译结果
    const translation =
      data[0]
        ?.map((item: any[]) => item[0])
        ?.filter(Boolean)
        ?.join("") ?? text;

    // data[1] 词性信息
    let partOfSpeech = "";
    if (data[1] && Array.isArray(data[1]) && data[1].length > 0) {
      const pos = data[1][0]?.[0] ?? "";
      partOfSpeech = posToAbbr(pos);
    }

    // data[0][1][3] 或 data[0][x][3] 是源语言音标
    // Google 返回格式不太稳定，尝试多个位置
    let phonetic = "";
    if (data[0] && Array.isArray(data[0])) {
      for (const item of data[0]) {
        if (Array.isArray(item) && item[3]) {
          phonetic = item[3];
          break;
        }
      }
    }

    const result = { translation, partOfSpeech, phonetic };

    // 写入缓存
    await setCached(text, result);

    return result;
  } catch (err) {
    console.warn("[LinguaVeil] Translation failed:", err);
    return { translation: "翻译失败", partOfSpeech: "", phonetic: "" };
  }
}

/** 英文词性转缩写 */
function posToAbbr(pos: string): string {
  const map: Record<string, string> = {
    noun: "n.",
    verb: "v.",
    adjective: "adj.",
    adverb: "adv.",
    pronoun: "pron.",
    preposition: "prep.",
    conjunction: "conj.",
    interjection: "interj.",
    exclamation: "excl.",
  };
  return map[pos.toLowerCase()] ?? pos;
}