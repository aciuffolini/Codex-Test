/**
 * Agent System Exports
 * Central export point for all agent-related functionality
 */

export * from "./BaseAgent";
export * from "./AgentRegistry";
export * from "./AgentMessaging";
export * from "./SwarmTaskRouter";
export * from "./FieldAgent";

// Singleton instances
export { agentRegistry } from "./AgentRegistry";
export { agentMessaging } from "./AgentMessaging";
export { swarmTaskRouter } from "./SwarmTaskRouter";


