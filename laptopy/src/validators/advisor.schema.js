import { z } from 'zod';

export const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
});

export const compareSchema = z.object({
  ids: z.array(z.string().min(1).max(60)).min(2).max(4),
  lang: z.enum(['ar', 'en']).default('ar'),
});
