import { notFound } from '../utils/http-error.js';
import { logger } from '../utils/logger.js';
import { chatSchema, compareSchema } from '../validators/advisor.schema.js';

const sse = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

export function createAdvisorController({ advisor, laptops }) {
  return {
    /**
     * Chat with Robin, streamed as Server-Sent Events:
     *   event: delta  data: {"text": "..."}      (many)
     *   event: done   data: {"mode": "ai"|"local"}
     *   event: error  data: {"message": "..."}
     */
    async chat(req, res) {
      const { messages } = chatSchema.parse(req.body);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const abort = new AbortController();
      res.on('close', () => abort.abort());

      try {
        const result = await advisor.streamChat({
          messages,
          laptops: laptops.listPublic(),
          signal: abort.signal,
          onDelta: (text) => sse(res, 'delta', { text }),
        });
        sse(res, 'done', result);
      } catch (err) {
        logger.error('Chat failed:', err);
        sse(res, 'error', { message: 'Robin could not answer right now. Please try again.' });
      } finally {
        res.end();
      }
    },

    /** Comparison verdict for 2-4 laptops. */
    async compare(req, res) {
      const { ids, lang } = compareSchema.parse(req.body);
      const selected = ids.map((id) => laptops.getPublic(id));
      if (selected.some((l) => !l)) throw notFound('One of the laptops was not found.');
      res.json(await advisor.compare({ laptops: selected, lang }));
    },
  };
}
