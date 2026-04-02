import { type Message, forwardToActiveTab } from './lib/messages';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: Message) => {
    if (message.type === 'LEARNING_MODE_CHANGED' || message.type === 'TRANSLATION_MODE_CHANGED') {
      forwardToActiveTab(message).catch((err) => {
        console.warn('[LinguaVeil] Failed to forward message to active tab:', err);
      });
    }
  });
});
