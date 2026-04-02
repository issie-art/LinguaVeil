/**
 * Google Translate 公开 API
 * 免费、无需 API Key，适合 MVP
 */

export interface TranslateResult {
  translation: string;
  partOfSpeech: string;
}

/**
 * 调用 Google Translate API 翻译英文到中文
 */
export async function translate(text: string): Promise<TranslateResult> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&dt=bd&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();

    // data[0] 是翻译结果数组
    const translation = data[0]
      ?.map((item: any[]) => item[0])
      ?.filter(Boolean)
      ?.join('') ?? text;

    // data[1] 是词性信息（仅单词有）
    let partOfSpeech = '';
    if (data[1] && Array.isArray(data[1]) && data[1].length > 0) {
      // data[1][0][0] 是词性，如 "noun", "verb"
      const pos = data[1][0]?.[0] ?? '';
      partOfSpeech = posToAbbr(pos);
    }

    return { translation, partOfSpeech };
  } catch (err) {
    console.warn('[LinguaVeil] Translation failed:', err);
    return { translation: '翻译失败', partOfSpeech: '' };
  }
}

/** 英文词性转缩写 */
function posToAbbr(pos: string): string {
  const map: Record<string, string> = {
    noun: 'n.',
    verb: 'v.',
    adjective: 'adj.',
    adverb: 'adv.',
    pronoun: 'pron.',
    preposition: 'prep.',
    conjunction: 'conj.',
    interjection: 'interj.',
    exclamation: 'excl.',
  };
  return map[pos.toLowerCase()] ?? pos;
}