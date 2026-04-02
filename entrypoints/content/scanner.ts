import { isProtectedNode, extractScannableText } from './code-guard';

/** 英文单词提取正则：连续字母序列，长度 >= 3 */
const WORD_PATTERN = /[a-zA-Z]{3,}/g;

/** 标注 CSS 类名 */
const CLASS_WORD = 'lv-word';
const CLASS_ORDINARY = 'lv-ordinary';
const CLASS_TECHNICAL = 'lv-technical';

export interface ScanResult {
  word: string;
  type: 'ordinary' | 'technical';
  node: Text;
  offset: number;
}

/**
 * 扫描容器，只标注用户生词本中的词。
 * @param container 目标 DOM 容器
 * @param vocabWords 用户生词本（word -> type）
 */
export function scanContainer(
  container: Element,
  vocabWords: Map<string, 'ordinary' | 'technical'>,
): ScanResult[] {
  if (vocabWords.size === 0) return [];

  const results: ScanResult[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

  let textNode: Text | null;
  while ((textNode = walker.nextNode() as Text | null)) {
    if (isProtectedNode(textNode)) continue;

    const fullText = textNode.textContent ?? '';
    if (!fullText.trim()) continue;

    const { segments } = extractScannableText(fullText);

    for (const segment of segments) {
      WORD_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = WORD_PATTERN.exec(segment.text)) !== null) {
        const word = match[0];
        const lower = word.toLowerCase();

        // 只标注生词本里的词
        const type = vocabWords.get(lower);
        if (!type) continue;

        results.push({
          word,
          type,
          node: textNode,
          offset: segment.offset + match.index,
        });
      }
    }
  }

  return results;
}


/**
 * 对扫描结果执行 DOM 标注。
 * 按逆序处理（从后往前），以保持偏移量的正确性。
 */
export function annotateWords(results: ScanResult[]): void {
  // Group by node
  const nodeMap = new Map<Text, ScanResult[]>();
  for (const r of results) {
    const list = nodeMap.get(r.node);
    if (list) list.push(r);
    else nodeMap.set(r.node, [r]);
  }

  for (const [node, nodeResults] of nodeMap) {
    // Sort by offset descending within each node
    nodeResults.sort((a, b) => b.offset - a.offset);

    for (const result of nodeResults) {
      const { word, type, offset } = result;
      if (!node.parentNode) continue;

      const text = node.textContent ?? '';
      if (text.slice(offset, offset + word.length) !== word) continue;

      const afterNode = node.splitText(offset + word.length);
      const wordNode = node.splitText(offset);

      const span = document.createElement('span');
      span.className = `${CLASS_WORD} ${type === 'technical' ? CLASS_TECHNICAL : CLASS_ORDINARY}`;
      span.dataset.word = word;
      span.textContent = wordNode.textContent;

      wordNode.parentNode!.replaceChild(span, wordNode);
      void afterNode;
    }
  }
}

/**
 * 移除容器内所有生词标注，恢复原始文本。
 */
export function removeAnnotations(container: Element): void {
  const spans = container.querySelectorAll(`.${CLASS_WORD}`);
  spans.forEach((span) => {
    const textNode = document.createTextNode(span.textContent ?? '');
    span.parentNode?.replaceChild(textNode, span);
  });
  container.normalize();
}