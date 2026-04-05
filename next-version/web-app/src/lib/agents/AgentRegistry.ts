/**
 * Agent Registry
 * Tracks available agents and their capabilities
 */

import { AgentCapability } from "@farm-visit/shared";

export class AgentRegistry {
  private agents: Map<string, AgentCapability> = new Map();

  /**
   * Register an agent
   */
  register(agent: AgentCapability): void {
    this.agents.set(agent.agentId, agent);
  }

  /**
   * Unregister an agent
   */
  unregister(agentId: string): void {
    this.agents.delete(agentId);
  }

  /**
   * Get agent by ID
   */
  get(agentId: string): AgentCapability | null {
    return this.agents.get(agentId) || null;
  }

  /**
   * Find agents by capability
   */
  discover(capability: string): AgentCapability[] {
    return Array.from(this.agents.values()).filter(
      (agent) =>
        agent.status === "online" &&
        (agent.capabilities.includes(capability) ||
          agent.capabilities.includes("*")) // Wildcard capability
    );
  }

  /**
   * Find agents by type
   */
  findByType(agentType: AgentCapability["agentType"]): AgentCapability[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.agentType === agentType && agent.status === "online"
    );
  }

  /**
   * List all agents
   */
  list(): AgentCapability[] {
    return Array.from(this.agents.values());
  }

  /**
   * Check if agent exists
   */
  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Clear all agents (for testing/reset)
   */
  clear(): void {
    this.agents.clear();
  }
}

// Singleton instance
export const agentRegistry = new AgentRegistry();


