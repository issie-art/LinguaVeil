/**
 * 知识卡导出模块
 * 支持导出到 Obsidian (Markdown) 和 Notion (CSV)
 */

import type { FlashcardEntry } from "./flashcard-store";

/** 导出格式类型 */
export type ExportFormat = "obsidian" | "notion";

/**
 * 将知识卡导出为 Obsidian Markdown 格式
 * 每个卡片一个文件，包含 YAML frontmatter
 */
export function exportToObsidian(cards: FlashcardEntry[]): { filename: string; content: string }[] {
  return cards.map((card) => {
    // 清理文件名中的非法字符
    const safeFilename = sanitizeFilename(card.front).slice(0, 50) || "untitled";
    const filename = `${safeFilename}.md`;

    // 解析标签
    const tags = card.topic
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    // 构建 YAML frontmatter
    const frontmatter = [
      "---",
      `tags: [${tags.map((t) => `"${t}"`).join(", ")}]`,
      `source: "${card.sourceUrl}"`,
      `created: ${formatDate(card.createdAt)}`,
      `lang-front: ${card.langFront}`,
      `lang-back: ${card.langBack}`,
      "---",
      "",
    ].join("\n");

    // 构建内容
    const content = [
      frontmatter,
      `# ${card.front}`,
      "",
      card.context ? `> ${card.context}` : "",
      "",
      "## 背面",
      "",
      card.back,
    ]
      .filter(Boolean)
      .join("\n");

    return { filename, content };
  });
}

/**
 * 将知识卡导出为 Notion CSV 格式
 */
export function exportToNotion(cards: FlashcardEntry[]): { filename: string; content: string } {
  const filename = "linguaveil-cards.csv";

  // CSV 表头
  const headers = ["正面", "背面", "标签", "上下文", "来源", "创建时间", "正面语言", "背面语言"];

  // CSV 行
  const rows = cards.map((card) => [
    escapeCsv(card.front),
    escapeCsv(card.back),
    escapeCsv(card.topic),
    escapeCsv(card.context),
    escapeCsv(card.sourceUrl),
    escapeCsv(formatDateTime(card.createdAt)),
    card.langFront,
    card.langBack,
  ]);

  // 构建 CSV 内容 (UTF-8 BOM 确保 Excel 正确识别中文)
  const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
  const content = "\uFEFF" + csvContent; // 添加 BOM

  return { filename, content };
}

/**
 * 下载文件
 */
export function downloadFile(filename: string, content: string, mimeType: string = "text/plain"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 批量下载 Obsidian 文件 (打包为 zip 提示用户逐个下载)
 */
export function downloadObsidianFiles(files: { filename: string; content: string }[]): void {
  // 由于浏览器扩展限制，逐个下载文件
  files.forEach((file, index) => {
    setTimeout(() => {
      downloadFile(file.filename, file.content, "text/markdown");
    }, index * 200); // 延迟避免浏览器阻塞
  });
}

/** 清理文件名中的非法字符 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "-") // Windows 非法字符
    .replace(/\s+/g, "-") // 空格转连字符
    .replace(/-+/g, "-") // 多个连字符合并
    .trim();
}

/** 格式化日期 YYYY-MM-DD */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split("T")[0];
}

/** 格式化日期时间 YYYY-MM-DD HH:mm:ss */
function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().replace("T", " ").slice(0, 19);
}

/** 转义 CSV 字段 */
function escapeCsv(value: string): string {
  if (!value) return "";
  // 如果包含逗号、引号或换行，需要用引号包裹并转义内部引号
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
