import { useState } from "react";
import type { FlashcardEntry } from "../lib/flashcard-store";

interface FlashcardItemProps {
  card: FlashcardEntry;
  onDelete: (id: string) => void;
  onUpdate: (
    id: string,
    partial: Partial<Omit<FlashcardEntry, "id" | "createdAt">>,
  ) => void;
}

/** 解析标签：从文本中提取 #标签 格式 */
function parseTags(text: string): { content: string; tags: string[] } {
  const tagRegex = /#([^\s#]+)/g;
  const tags: string[] = [];
  let match;
  while ((match = tagRegex.exec(text)) !== null) {
    tags.push(match[1]);
  }
  const content = text.replace(tagRegex, "").trim();
  return { content, tags };
}

/** 将标签格式化为显示文本 */
function formatTagsForInput(back: string, topic: string): string {
  const tags = topic ? topic.split(",").filter(Boolean) : [];
  if (tags.length === 0) return back;
  return `${back} ${tags.map((t) => `#${t}`).join(" ")}`;
}

function FlashcardItem({ card, onDelete, onUpdate }: FlashcardItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBack, setEditBack] = useState(formatTagsForInput(card.back, card.topic));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dateStr = new Date(card.createdAt).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });

  const handleSaveEdit = () => {
    const trimmed = editBack.trim();

    // 解析标签和内容（允许空内容）
    const { content, tags } = parseTags(trimmed);

    onUpdate(card.id, {
      back: content,
      topic: tags.join(","),
    });
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditBack(formatTagsForInput(card.back, card.topic));
    setEditing(false);
  };

  const handleDeleteClick = () => {
    if (confirmDelete) {
      onDelete(card.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div className="sp-card" onClick={() => {
      // 非编辑状态下点击卡片切换展开
      if (!editing) {
        setExpanded(!expanded);
      }
    }}>
      <div className="sp-card-header">
        <span className="sp-card-date">{dateStr}</span>
      </div>

      <div className="sp-card-front">{card.front}</div>

      {/* 编辑区域：独立于展开状态，编辑时始终显示 */}
      {editing && (
        <div className="sp-card-detail sp-card-detail--editing">
          <div className="sp-card-edit" onClick={(e) => e.stopPropagation()}>
            <textarea
              className="sp-edit-textarea"
              value={editBack}
              onChange={(e) => setEditBack(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="sp-edit-actions">
              <button className="sp-btn sp-btn--save" onClick={handleSaveEdit}>
                保存
              </button>
              <button className="sp-btn sp-btn--cancel" onClick={handleCancelEdit}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 详情区域：仅在展开且非编辑状态时显示 */}
      {expanded && !editing && (
        <div className="sp-card-detail">
          <div className="sp-card-back">
            {card.back || <span className="sp-card-back--empty">(快速标记)</span>}
          </div>

          {card.context && (
            <div className="sp-card-context">
              <span className="sp-card-context-label">上下文</span>
              <p>{card.context}</p>
            </div>
          )}

          {card.topic && (
            <div className="sp-card-tags">
              {card.topic.split(",").filter(Boolean).map((tag) => (
                <span key={tag} className="sp-card-tag">
                  <span className="sp-card-tag-hash">#</span>{tag}
                </span>
              ))}
            </div>
          )}

          <div className="sp-card-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="sp-btn sp-btn--edit"
              onClick={() => setEditing(true)}
            >
              编辑
            </button>
            <button
              className={`sp-btn sp-btn--delete ${confirmDelete ? "sp-btn--confirm" : ""}`}
              onClick={handleDeleteClick}
            >
              {confirmDelete ? "确认删除" : "删除"}
            </button>
            {card.sourceUrl && (
              <a
                className="sp-btn sp-btn--link"
                href={card.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                来源
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FlashcardItem;
