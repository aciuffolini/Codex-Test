/**
 * Base Agent Class
 * All agents extend this for consistent interface
 */

import { AgentMessage, AgentCapability, TaskRequest, TaskResponse } from "@farm-visit/shared";

export interface AgentContext {
  visit?: unknown;
  user?: unknown;
  farm?: unknown;
  [key: string]: unknown;
}

export abstract class BaseAgent {
  abstract readonly agentId: string;
  abstract readonly agentType: AgentCapability["agentType"];
  abstract readonly capabilities: string[];

  /**
   * Execute a task - must be implemented by each agent
   */
  abstract execute(
    task: string,
    input: unknown,
    context: AgentContext
  ): Promise<unknown>;

  /**
   * Handle incoming message from another agent
   */
  async handleMessage(message: AgentMessage): Promise<AgentMessage | null> {
    if (message.to !== this.agentId && !Array.isArray(message.to)) {
      return null; // Not for this agent
    }

    const isTaskRequest = message.type === "request" || message.type === "delegation";

    if (isTaskRequest) {
      try {
        const result = await this.execute(message.task, message.payload, message.metadata as AgentContext || {});
        
        return {
          from: this.agentId,
          to: message.from,
          type: "response",
          task: message.task,
          payload: result,
          correlationId: message.correlationId,
          timestamp: Date.now(),
        } as AgentMessage;
      } catch (error: any) {
        return {
          from: this.agentId,
          to: message.from,
          type: "response",
          task: message.task,
          payload: null,
          correlationId: message.correlationId,
          timestamp: Date.now(),
          metadata: { error: error.message },
        } as AgentMessage;
      }
    }

    return null;
  }

  /**
   * Get agent capability description
   */
  getCapability(): AgentCapability {
    return {
      agentId: this.agentId,
      agentType: this.agentType,
      capabilities: this.capabilities,
      status: "online",
    };
  }
}


