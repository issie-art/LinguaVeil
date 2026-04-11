import { type Message, forwardToActiveTab } from "./lib/messages";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: Message) => {
    if (message.type === "FLAGS_CHANGED") {
      forwardToActiveTab(message).catch((err) => {
        console.warn("[LinguaVeil] Failed to forward message:", err);
      });
      return true; // 异步处理
    }
    return false;
  });
});
