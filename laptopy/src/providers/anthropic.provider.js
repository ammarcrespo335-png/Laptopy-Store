import Anthropic from '@anthropic-ai/sdk';

/**
 * Thin wrapper around the Anthropic SDK.
 * The advisor depends only on this small interface (streamText / complete),
 * which keeps it easy to test and to swap providers.
 */
export class AnthropicProvider {
  constructor({ apiKey, model }) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  /** Streams the reply, calling onDelta(text) for every chunk. */
  async streamText({ system, messages, maxTokens = 700, signal, onDelta }) {
    const stream = this.client.messages.stream(
      { model: this.model, max_tokens: maxTokens, system, messages },
      { signal },
    );
    stream.on('text', onDelta);
    await stream.finalMessage();
  }

  /** Returns the whole reply as a string. */
  async complete({ system, messages, maxTokens = 600, signal }) {
    const response = await this.client.messages.create(
      { model: this.model, max_tokens: maxTokens, ...(system ? { system } : {}), messages },
      { signal },
    );
    return response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');
  }
}
