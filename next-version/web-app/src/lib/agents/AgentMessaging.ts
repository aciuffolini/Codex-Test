/**
 * Agent Messaging System
 * Handles communication between agents (local and remote)
 */

import { AgentMessage, TaskRequest, TaskResponse } from "@farm-visit/shared";
import { agentRegistry } from "./AgentRegistry";
import { BaseAgent } from "./BaseAgent";

export type MessageHandler = (message: AgentMessage) => void | Promise<void>;
export type Transport = "local" | "websocket" | "mcp";

export class AgentMessaging {
  private handlers: Map<string, MessageHandler[]> = new Map();
  private localAgents: Map<string, BaseAgent> = new Map();

  /**
   * Register a local agent for in-process messaging
   */
  registerAgent(agent: BaseAgent): void {
    this.localAgents.set(agent.agentId, agent);
    agentRegistry.register(agent.getCapability());
  }

  /**
   * Unregister a local agent
   */
  unregisterAgent(agentId: string): void {
    this.localAgents.delete(agentId);
    agentRegistry.unregister(agentId);
  }

  /**
   * Send a message to another agent
   */
  async send(message: AgentMessage): Promise<void> {
    // Handle local agents
    if (typeof message.to === "string") {
      const agent = this.localAgents.get(message.to);
      if (agent) {
        const response = await agent.handleMessage(message);
        if (response) {
          await this.deliver(response);
        }
        return;
      }
    }

    // Handle broadcast
    if (Array.isArray(message.to)) {
      for (const agentId of message.to) {
        const agent = this.localAgents.get(agentId);
        if (agent) {
          await agent.handleMessage({ ...message, to: agentId });
        }
      }
      return;
    }

    // Handle remote agents (WebSocket/MCP) - TODO: implement
    // For now, queue for later or log warning
    console.warn(`Agent ${message.to} not found locally, remote transport not implemented yet`);
  }

  /**
   * Deliver a message (internal routing)
   */
  private async deliver(message: AgentMessage): Promise<void> {
    // Deliver to registered handlers
    const handlers = this.handlers.get(message.type) || [];
    for (const handler of handlers) {
      await handler(message);
    }
  }

  /**
   * Subscribe to messages
   */
  onMessage(type: AgentMessage["type"], handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Delegate a task to another agent
   */
  async delegate(
    task: string,
    payload: unknown,
    toAgentId: string,
    context?: Record<string, unknown>
  ): Promise<unknown> {
    const message: AgentMessage = {
      from: "system",
      to: toAgentId,
      type: "delegation",
      task,
      correlationId: crypto.randomUUID(),
      payload,
      timestamp: Date.now(),
      metadata: context,
    };

    // Send and wait for response
    const agent = this.localAgents.get(toAgentId);
    if (agent) {
      const response = await agent.handleMessage(message);
      return response?.payload || null;
    }

    throw new Error(`Agent ${toAgentId} not found`);
  }

  /**
   * Broadcast an event to all agents
   */
  async broadcast(event: string, payload: unknown): Promise<void> {
    const message: AgentMessage = {
      from: "system",
      to: "*", // Broadcast
      type: "event",
      task: event,
      correlationId: crypto.randomUUID(),
      payload,
      timestamp: Date.now(),
    };

    // Send to all local agents
    for (const agent of this.localAgents.values()) {
      await agent.handleMessage({ ...message, to: agent.agentId });
    }

    // Also trigger event handlers
    await this.deliver(message);
  }
}

// Singleton instance
export const agentMessaging = new AgentMessaging();

