import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  queryCards,
  deleteCard,
  updateCard,
  addCard,
  getCardCount,
  type FlashcardEntry,
} from "../lib/flashcard-store";
import {
  exportToObsidian,
  exportToNotion,
  downloadObsidianFiles,
  downloadFile,
} from "../lib/export";
import FlashcardList from "./FlashcardList";

/** 从卡片列表中提取所有唯一标签 */
function extractAllTags(cards: FlashcardEntry[]): string[] {
  const tagSet = new Set<string>();
  cards.forEach((card) => {
    if (card.topic) {
      card.topic.split(",").forEach((tag) => {
        if (tag.trim()) tagSet.add(tag.trim());
      });
    }
  });
  return Array.from(tagSet).sort();
}

/** Side Panel 内的主题检测（与 content script 独立） */
function detectSidePanelTheme(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** 支持标签高亮的输入组件 - 使用 textarea + 高亮层叠加方案 */
interface BackInputWithTagsProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function BackInputWithTags({ value, onChange, placeholder }: BackInputWithTagsProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // 将文本中的 #标签 渲染为高亮 HTML
  const renderHighlight = (text: string): string => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/#([^\s#]+)/g, '<mark class="sp-highlight-tag">#$1</mark>');
  };

  // 同步滚动位置
  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  return (
    <div
      className={`sp-input-with-tags ${isFocused ? "sp-input-with-tags--focused" : ""}`}
    >
      {/* 高亮层 - 显示带样式的文本 */}
      <div
        ref={highlightRef}
        className="sp-highlight-layer"
        aria-hidden="true"
        dangerouslySetInnerHTML={{
          __html: renderHighlight(value) + '<br />'
        }}
      />
      {/* 输入层 - 实际接收输入 */}
      <textarea
        ref={textareaRef}
        className="sp-textarea-layer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        rows={3}
      />
    </div>
  );
}

function App() {
  const [cards, setCards] = useState<FlashcardEntry[]>([]);
  const [count, setCount] = useState(0);
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 提取所有唯一标签
  const allTags = useMemo(() => extractAllTags(cards), [cards]);

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      // 并行加载卡片和计数
      const [list, total] = await Promise.all([queryCards(), getCardCount()]);
      list.sort((a, b) => b.createdAt - a.createdAt);
      setCards(list);
      setCount(total);
    } catch (err) {
      console.error("[LinguaVeil] Failed to load flashcards:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 筛选后的卡片列表（标签 + 搜索）
  const filteredCards = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return cards.filter((card) => {
      // tag 筛选
      if (tagFilter !== "all") {
        const cardTags = card.topic ? card.topic.split(",").map((t) => t.trim()) : [];
        if (!cardTags.includes(tagFilter)) {
          return false;
        }
      }
      // 搜索筛选
      if (q) {
        const matchFront = card.front.toLowerCase().includes(q);
        const matchBack = card.back.toLowerCase().includes(q);
        const matchTopic = card.topic?.toLowerCase().includes(q);
        if (!matchFront && !matchBack && !matchTopic) {
          return false;
        }
      }
      return true;
    });
  }, [cards, tagFilter, searchQuery]);

  // 初始化加载
  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // 主题检测
  useEffect(() => {
    const apply = (theme: "dark" | "light") => {
      document.documentElement.dataset.lvTheme = theme;
    };
    apply(detectSidePanelTheme());

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => apply(detectSidePanelTheme());
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // 监听 storage 变化 → 防抖刷新
  useEffect(() => {
    const listener = (changes: { [key: string]: any }) => {
      if (changes["lv_flashcards"]) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          loadCards();
        }, 300);
      }
    };
    browser.storage.local.onChanged.addListener(listener);
    return () => {
      browser.storage.local.onChanged.removeListener(listener);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [loadCards]);

  const handleDelete = async (id: string) => {
    await deleteCard(id);
    await loadCards();
  };

  const handleUpdate = async (
    id: string,
    partial: Partial<Omit<FlashcardEntry, "id" | "createdAt">>,
  ) => {
    await updateCard(id, partial);
    await loadCards();
  };

  const handleAddNew = () => {
    setIsAdding(true);
    setNewFront("");
    setNewBack("");
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewFront("");
    setNewBack("");
  };

  const handleSaveNew = async () => {
    if (!newFront.trim()) return;

    // 从背面内容解析标签（支持 #标签 格式）
    const tagRegex = /#([^\s#]+)/g;
    const tags: string[] = [];
    let match;
    while ((match = tagRegex.exec(newBack)) !== null) {
      tags.push(match[1]);
    }
    const cleanBack = newBack.replace(tagRegex, "").trim();

    await addCard({
      front: newFront.trim(),
      back: cleanBack,
      topic: tags.join(","),
      sourceUrl: "",
      langFront: /[\u4e00-\u9fff]/.test(newFront) ? "zh" : "en",
      langBack: /[\u4e00-\u9fff]/.test(cleanBack) ? "zh" : "en",
    });

    setIsAdding(false);
    setNewFront("");
    setNewBack("");
    await loadCards();
  };

  // 导出处理函数
  const handleExportObsidian = () => {
    if (cards.length === 0) {
      alert("没有知识卡片可导出");
      return;
    }
    const files = exportToObsidian(cards);
    downloadObsidianFiles(files);
    setShowExportMenu(false);
  };

  const handleExportNotion = () => {
    if (cards.length === 0) {
      alert("没有知识卡片可导出");
      return;
    }
    const { filename, content } = exportToNotion(cards);
    downloadFile(filename, content, "text/csv");
    setShowExportMenu(false);
  };

  return (
    <div className="sp-container">
      <header className="sp-header">
        <h1 className="sp-title">知识卡片</h1>
        <div className="sp-header-actions">
          <span className="sp-count">{count}</span>
          <div className="sp-export-wrapper">
            <button 
              className="sp-export-btn" 
              onClick={() => setShowExportMenu(!showExportMenu)}
              title="导出"
            >
              导出 ▼
            </button>
            {showExportMenu && (
              <div className="sp-export-menu">
                <button className="sp-export-option" onClick={handleExportObsidian}>
                  📄 Obsidian (Markdown)
                </button>
                <button className="sp-export-option" onClick={handleExportNotion}>
                  📊 Notion (CSV)
                </button>
              </div>
            )}
          </div>
          <button className="sp-add-btn" onClick={handleAddNew} title="添加卡片">
            + 添加
          </button>
        </div>
      </header>

      {/* 添加卡片表单 */}
      {isAdding && (
        <div className="sp-add-form">
          <div className="sp-add-form-header">
            <span className="sp-add-form-title">添加新卡片</span>
            <button className="sp-add-form-close" onClick={handleCancelAdd} title="关闭">
              ×
            </button>
          </div>
          <input
            className="sp-add-input"
            type="text"
            placeholder="正面内容（原文）"
            value={newFront}
            onChange={(e) => setNewFront(e.target.value)}
          />
          <BackInputWithTags
            value={newBack}
            onChange={setNewBack}
            placeholder="背面内容（可留空），使用 #标签 格式添加标签"
          />
          <div className="sp-add-form-actions">
            <button className="sp-btn sp-btn--cancel" onClick={handleCancelAdd}>
              取消
            </button>
            <button
              className="sp-btn sp-btn--save"
              onClick={handleSaveNew}
              disabled={!newFront.trim()}
            >
              保存
            </button>
          </div>
        </div>
      )}

      {/* 搜索框 */}
      <div className="sp-search">
        <input
          className="sp-search-input"
          type="text"
          placeholder="搜索卡片..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* 标签筛选 */}
      {allTags.length > 0 && (
        <div className="sp-tag-filters">
          <button
            className={`sp-tag-filter-btn ${tagFilter === "all" ? "sp-tag-filter-btn--active" : ""}`}
            onClick={() => setTagFilter("all")}
          >
            全部
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`sp-tag-filter-btn ${tagFilter === tag ? "sp-tag-filter-btn--active" : ""}`}
              onClick={() => setTagFilter(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="sp-empty">加载中...</div>
      ) : filteredCards.length === 0 ? (
        <div className="sp-empty">
          {searchQuery
            ? "没有匹配的卡片"
            : tagFilter === "all"
              ? "还没有知识卡片"
              : "没有符合条件的卡片"}
        </div>
      ) : (
        <FlashcardList
          cards={filteredCards}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}

export default App;
