import { logger } from '../utils/logger.js';
import { comparePrompt, robinSystemPrompt } from '../prompts/robin.prompts.js';

/**
 * Robin, the AI laptop advisor.
 * Uses the AI provider when available and falls back to the rule-based
 * LocalAdvisor, so a customer always gets an answer.
 */
export class AdvisorService {
  /**
   * @param provider  object with streamText()/complete(), or null when AI is not configured
   * @param local     LocalAdvisor
   */
  constructor({ provider, local, storeName, currency }) {
    this.provider = provider;
    this.local = local;
    this.storeName = storeName;
    this.currency = currency;
  }

  get aiEnabled() {
    return Boolean(this.provider);
  }

  /**
   * Streams Robin's answer through onDelta(text).
   * @returns {{mode: 'ai'|'local', truncated?: boolean}}
   */
  async streamChat({ messages, laptops, signal, onDelta }) {
    const history = trimToConversation(messages);

    if (this.provider) {
      let started = false;
      try {
        await this.provider.streamText({
          system: robinSystemPrompt({ storeName: this.storeName, currency: this.currency, laptops }),
          messages: history,
          signal,
          onDelta: (text) => {
            started = true;
            onDelta(text);
          },
        });
        return { mode: 'ai' };
      } catch (err) {
        if (signal?.aborted) return { mode: 'ai', truncated: true };
        logger.warn('AI provider failed:', err?.message ?? err);
        if (started) return { mode: 'ai', truncated: true };
      }
    }

    const customerText = history.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
    onDelta(this.local.reply(customerText, laptops));
    return { mode: 'local' };
  }

  /** @returns {{text: string, mode: 'ai'|'local'}} */
  async compare({ laptops, lang }) {
    if (this.provider) {
      try {
        const text = await this.provider.complete({
          messages: [{ role: 'user', content: comparePrompt({ laptops, currency: this.currency, lang }) }],
        });
        if (text.trim()) return { text, mode: 'ai' };
      } catch (err) {
        logger.warn('AI comparison failed:', err?.message ?? err);
      }
    }
    return { text: this.local.compareSummary(laptops, { lang }), mode: 'local' };
  }
}

/** The API needs a conversation that starts and ends with a customer turn. */
export function trimToConversation(messages) {
  const list = [...messages];
  while (list.length && list[0].role !== 'user') list.shift();
  while (list.length && list[list.length - 1].role !== 'user') list.pop();
  return list;
}
