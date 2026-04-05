/**
 * Swarm Task Router
 * Routes tasks to appropriate agents (local or remote)
 * Supports delegation and multi-agent coordination
 */

import { TaskRequest, TaskResponse } from "@farm-visit/shared";
import { agentRegistry } from "./AgentRegistry";
import { agentMessaging } from "./AgentMessaging";
import { BaseAgent, AgentContext } from "./BaseAgent";

export interface RoutingResult {
  agent: BaseAgent;
  agentId: string;
  task: string;
  result: unknown;
}

export class SwarmTaskRouter {
  /**
   * Route a task to the appropriate agent
   */
  async route(
    intent: string,
    input: unknown,
    context: AgentContext = {},
    preferredAgent?: string
  ): Promise<RoutingResult> {
    // If preferred agent specified, try that first
    if (preferredAgent) {
      const agent = agentRegistry.get(preferredAgent);
      if (agent && agent.status === "online") {
        const result = await this.executeWithAgent(preferredAgent, intent, input, context);
        if (result) {
          return result;
        }
      }
    }

    // Find agents capable of handling this task
    const capableAgents = agentRegistry.discover(intent);
    
    if (capableAgents.length === 0) {
      // Fallback to field agent (default)
      const fieldAgents = agentRegistry.findByType("field");
      if (fieldAgents.length > 0) {
        return await this.executeWithAgent(
          fieldAgents[0].agentId,
          intent,
          input,
          context
        );
      }
      throw new Error(`No agent found capable of handling task: ${intent}`);
    }

    // Use first available agent
    const selectedAgent = capableAgents[0];
    return await this.executeWithAgent(selectedAgent.agentId, intent, input, context);
  }

  /**
   * Execute task with specific agent
   */
  private async executeWithAgent(
    agentId: string,
    task: string,
    input: unknown,
    context: AgentContext
  ): Promise<RoutingResult> {
    const agent = agentRegistry.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Delegate to agent via messaging
    const result = await agentMessaging.delegate(task, input, agentId, context);

    // Note: We need to get the actual agent instance
    // For now, we'll create a response structure
    return {
      agent: null as any, // Will be resolved from registry
      agentId,
      task,
      result,
    };
  }

  /**
   * Delegate task to specific agent
   */
  async delegate(
    task: string,
    input: unknown,
    toAgentId: string,
    context: AgentContext = {}
  ): Promise<unknown> {
    return await agentMessaging.delegate(task, input, toAgentId, context);
  }

  /**
   * Execute multi-agent task (future: parallel coordination)
   */
  async coordinate(
    tasks: Array<{ task: string; input: unknown; agentId?: string }>,
    context: AgentContext = {}
  ): Promise<unknown[]> {
    // Execute tasks sequentially for now
    // Future: can be parallelized
    const results: unknown[] = [];
    for (const { task, input, agentId } of tasks) {
      if (agentId) {
        const result = await this.delegate(task, input, agentId, context);
        results.push(result);
      } else {
        const routed = await this.route(task, input, context);
        results.push(routed.result);
      }
    }
    return results;
  }
}

// Singleton instance
export const swarmTaskRouter = new SwarmTaskRouter();


