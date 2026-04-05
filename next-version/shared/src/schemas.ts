import { z } from "zod";

/**
 * Visit Schema
 */
export const VisitSchema = z.object({
  id: z.string().default(() => {
    if (typeof globalThis !== 'undefined' && globalThis.crypto) {
      return globalThis.crypto.randomUUID();
    }
    // Fallback for environments without crypto
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }),
  ts: z.number().int(),
  field_id: z.string().optional(),
  crop: z.string().optional(),
  issue: z.string().optional(),
  severity: z.number().int().min(1).max(5).optional(),
  note: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  acc: z.number().int().optional(),
  photo_present: z.boolean().default(false),
});

export type Visit = z.infer<typeof VisitSchema>;

/**
 * Chat Message Schema
 */
export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/**
 * Chat Request Schema
 */
export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema),
  meta: z
    .object({
      visit: VisitSchema.nullable().optional(),
      intent: z.enum(["structure", "chat"]).optional(),
    })
    .optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

