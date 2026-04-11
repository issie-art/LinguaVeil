import { useEffect, useState } from "react";
import { sendFlagsChange, sendToggleToc } from "../lib/messages";
import type { FeatureFlags } from "../lib/mode-manager";
import "./App.css";

const MODES_KEY = "lv_modes";
const DEFAULT_FLAGS: FeatureFlags = { translate: true, flashcard: false, toc: false };

interface ToggleOption {
  key: keyof FeatureFlags;
  label: string;
  desc: string;
}

const TOGGLES: ToggleOption[] = [
  { key: "translate", label: "翻译", desc: "划词翻译英文 · 生词自动标注" },
  { key: "flashcard", label: "标记", desc: "划词创建知识卡片" },
  { key: "toc", label: "目录", desc: "生成文章目录导航" },
];

function App() {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);

  useEffect(() => {
    browser.storage.local
      .get(MODES_KEY)
      .then((result) => {
        const stored = result[MODES_KEY] as any;
        if (stored && typeof stored.translate === "boolean") {
          setFlags({ translate: stored.translate, flashcard: !!stored.flashcard, toc: !!stored.toc });
        } else if (stored?.activeMode) {
          // 旧格式兼容
          const migrated: FeatureFlags =
            stored.activeMode === "flashcard"
              ? { translate: false, flashcard: true, toc: false }
              : stored.activeMode === "off"
                ? { translate: false, flashcard: false, toc: false }
                : { translate: true, flashcard: false, toc: false };
          setFlags(migrated);
        }
      })
      .catch((err) => {
        console.warn("[LinguaVeil] Failed to load flags:", err);
      });
  }, []);

  const handleToggle = async (key: keyof FeatureFlags) => {
    const next = { ...flags, [key]: !flags[key] };
    setFlags(next);
    await browser.storage.local.set({ [MODES_KEY]: next });
    
    // 目录开关特殊处理：直接触发显示/隐藏
    if (key === "toc") {
      try {
        await sendToggleToc();
      } catch {
        /* tab may not exist */
      }
    } else {
      try {
        await sendFlagsChange(next);
      } catch {
        /* tab may not exist */
      }
    }
  };

  const openSidePanel = async () => {
    const chromeApi = (globalThis as any).chrome;
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      await chromeApi.sidePanel.open({ tabId: tab?.id });
    } catch {
      const url = browser.runtime.getURL("/flashcards.html" as any);
      browser.tabs.create({ url });
    }
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1 className="popup-title">LinguaVeil</h1>
        <p className="popup-subtitle">能力开关</p>
      </header>

      <div className="feature-toggles">
        {TOGGLES.map((opt) => (
          <div key={opt.key} className="feature-toggle">
            <div className="feature-toggle-info">
              <span className="feature-toggle-label">{opt.label}</span>
              <span className="feature-toggle-desc">{opt.desc}</span>
            </div>
            <button
              className={`toggle-switch ${flags[opt.key] ? "toggle-switch--on" : ""}`}
              onClick={() => handleToggle(opt.key)}
              role="switch"
              aria-checked={flags[opt.key]}
            >
              <span className="toggle-switch-thumb" />
            </button>
          </div>
        ))}
      </div>

      <div className="popup-divider" />

      <button className="sidepanel-btn" onClick={openSidePanel}>
        打开知识卡片面板
      </button>
    </div>
  );
}

export default App;
