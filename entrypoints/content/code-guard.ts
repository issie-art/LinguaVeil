/** 需要跳过的标签名集合 */
const SKIP_TAGS = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE']);

/** LaTeX 公式正则：匹配 $$...$$ 和 $...$ */
const LATEX_PATTERN = /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g;

/**
 * 判断一个 DOM 节点是否处于代码保护区域内
 * 向上遍历祖先节点，检查是否包含 SKIP_TAGS 中的标签
 */
export function isProtectedNode(node: Node): boolean {
  let current: Node | null = node;
  while (current) {
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      SKIP_TAGS.has((current as Element).tagName)
    ) {
      return true;
    }
    current = current.parentNode;
  }
  return false;
}

/**
 * 从文本中移除 LaTeX 公式部分，返回可扫描的文本片段
 * segments 中每个元素包含可扫描的文本和其在原始文本中的偏移量
 */
export function extractScannableText(text: string): {
  segments: Array<{ text: string; offset: number }>;
} {
  const segments: Array<{ text: string; offset: number }> = [];
  let lastIndex = 0;

  // Reset regex state
  LATEX_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = LATEX_PATTERN.exec(text)) !== null) {
    // Add the text before this LaTeX match as a scannable segment
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        offset: lastIndex,
      });
    }
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last LaTeX match
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      offset: lastIndex,
    });
  }

  return { segments };
}
