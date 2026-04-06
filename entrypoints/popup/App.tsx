import { useEffect, useState } from "react";
import { sendModeChange, sendTranslationModeChange } from "../lib/messages";
import "./App.css";

interface ModeState {
  learning: boolean;
  writing: boolean;
  translation: boolean;
}

const MODES_KEY = "lv_modes";
const DEFAULT_MODES: ModeState = {
  learning: true,
  writing: false,
  translation: true,
};

function App() {
  const [modes, setModes] = useState<ModeState>(DEFAULT_MODES);

  useEffect(() => {
    browser.storage.local
      .get(MODES_KEY)
      .then((result) => {
        const stored = result[MODES_KEY] as Partial<ModeState> | undefined;
        if (stored) {
          setModes({ ...DEFAULT_MODES, ...stored });
        }
      })
      .catch((err) => {
        console.warn("[LinguaVeil] Failed to load mode state:", err);
      });
  }, []);

  const toggleLearning = async () => {
    const next = !modes.learning;
    const updated = { ...modes, learning: next };
    setModes(updated);
    await browser.storage.local.set({ [MODES_KEY]: updated });
    try {
      await sendModeChange(next);
    } catch {
      /* tab may not exist */
    }
  };

  const toggleTranslation = async () => {
    const next = !modes.translation;
    const updated = { ...modes, translation: next };
    setModes(updated);
    await browser.storage.local.set({ [MODES_KEY]: updated });
    try {
      await sendTranslationModeChange(next);
    } catch {
      /* tab may not exist */
    }
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1 className="popup-title">LinguaVeil</h1>
        <p className="popup-subtitle">插件设置 · 选择适合您的使用模式</p>
      </header>

      <div className="mode-list">
        <div className="mode-card">
          <div className="mode-icon">📖</div>
          <div className="mode-info">
            <div className="mode-name-row">
              <span className="mode-name">学习模式</span>
            </div>
            <div className="mode-desc">划词添加生词，自动标注已收录的生词</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={modes.learning}
              onChange={toggleLearning}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="mode-card">
          <div className="mode-icon">🌐</div>
          <div className="mode-info">
            <div className="mode-name-row">
              <span className="mode-name">划词翻译</span>
            </div>
            <div className="mode-desc">选中文本即时翻译，支持单词和句子</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={modes.translation}
              onChange={toggleTranslation}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="mode-card mode-card--disabled">
          <div className="mode-icon">✍️</div>
          <div className="mode-info">
            <div className="mode-name-row">
              <span className="mode-name">写作模式</span>
              <span className="mode-badge">即将推出</span>
            </div>
            <div className="mode-desc">辅助英文写作与表达润色</div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={modes.writing} disabled />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>
    </div>
  );
}

export default App;
