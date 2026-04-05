import { z } from "zod";

/**
 * Agent Message Schema
 * Standard format for inter-agent communication
 */
export const AgentMessageSchema = z.object({
  from: z.string(), // agentId
  to: z.union([z.string(), z.array(z.string())]), // agentId or broadcast
  type: z.enum(["request", "response", "event", "delegation"]),
  task: z.string(),
  payload: z.unknown(),
  schema: z.string().optional(), // Zod schema name for validation
  correlationId: z.string().default(() => crypto.randomUUID()),
  timestamp: z.number().int().default(() => Date.now()),
  metadata: z.record(z.unknown()).optional(),
});

export type AgentMessage = z.infer<typeof AgentMessageSchema>;

/**
 * Agent Capability Schema
 */
export const AgentCapabilitySchema = z.object({
  agentId: z.string(),
  agentType: z.enum(["field", "diagnostic", "planning", "analytics", "rayban", "iot"]),
  capabilities: z.array(z.string()),
  endpoint: z.string().optional(), // For remote agents
  status: z.enum(["online", "offline"]),
  metadata: z.record(z.unknown()).optional(),
});

export type AgentCapability = z.infer<typeof AgentCapabilitySchema>;

/**
 * Task Request Schema
 */
export const TaskRequestSchema = z.object({
  task: z.string(),
  input: z.unknown(),
  context: z.record(z.unknown()).optional(),
  preferredAgent: z.string().optional(),
});

export type TaskRequest = z.infer<typeof TaskRequestSchema>;

/**
 * Task Response Schema
 */
export const TaskResponseSchema = z.object({
  success: z.boolean(),
  result: z.unknown(),
  agentId: z.string(),
  task: z.string(),
  timestamp: z.number().int(),
  error: z.string().optional(),
});

export type TaskResponse = z.infer<typeof TaskResponseSchema>;


