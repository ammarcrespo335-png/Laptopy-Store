import { z } from 'zod';

export const googleLoginSchema = z.object({ credential: z.string().min(20).max(4096) });
export const devLoginSchema = z.object({ email: z.string().trim().email().max(200) });
