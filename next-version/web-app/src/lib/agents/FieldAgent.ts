/**
 * Field Agent
 * Handles field visit capture and extraction
 * Part of the swarm agent system
 */

import { BaseAgent, AgentContext } from "./BaseAgent";
import { Visit, VisitSchema } from "@farm-visit/shared";
import { geminiNano } from "../llm/GeminiNano";

export class FieldAgent extends BaseAgent {
  readonly agentId = "field-agent-001";
  readonly agentType = "field" as const;
  readonly capabilities = [
    "field_inspection",
    "extract_fields",
    "capture_gps",
    "capture_photo",
    "capture_audio",
    "*", // Can handle any task as fallback
  ];

  /**
   * Execute field-related tasks
   */
  async execute(
    task: string,
    input: unknown,
    context: AgentContext
  ): Promise<unknown> {
    switch (task) {
      case "field_inspection":
      case "extract_fields":
        return await this.extractFields(input, context);

      case "capture_gps":
        return await this.captureGPS(input, context);

      case "capture_photo":
        return await this.capturePhoto(input, context);

      case "capture_audio":
        return await this.captureAudio(input, context);

      default:
        // Fallback: try to extract fields from any input
        return await this.extractFields(input, context);
    }
  }

  /**
   * Extract structured fields from unstructured input
   * Uses Gemini Nano for extraction
   */
  private async extractFields(
    input: unknown,
    context: AgentContext
  ): Promise<Partial<Visit>> {
    const visit = context.visit as Partial<Visit> || {};
    
    // Extract text from input
    let textInput = "";
    if (typeof input === "string") {
      textInput = input;
    } else if (input && typeof input === "object") {
      const obj = input as any;
      textInput = obj.note || obj.text || "";
    }

    // Use Gemini Nano to extract structured data
    if (textInput) {
      try {
        const result = await geminiNano.generate({
          text: textInput,
          location: visit.lat && visit.lon 
            ? { lat: visit.lat, lon: visit.lon }
            : undefined,
        });

        // Merge extracted fields
        if (result.structured) {
          const extracted = result.structured as Partial<Visit>;
          return {
            ...visit,
            ...extracted,
            note: textInput, // Keep original note
          };
        }
      } catch (err) {
        console.warn("Gemini Nano extraction failed:", err);
      }
    }

    // Fallback: merge with input if it's a Visit-like object
    if (input && typeof input === "object") {
      return {
        ...visit,
        ...input,
      } as Partial<Visit>;
    }

    return visit;
  }

  private async captureGPS(input: unknown, context: AgentContext): Promise<unknown> {
    // GPS capture logic (delegates to sensor layer)
    return input;
  }

  private async capturePhoto(input: unknown, context: AgentContext): Promise<unknown> {
    // Photo capture logic (delegates to sensor layer)
    return input;
  }

  private async captureAudio(input: unknown, context: AgentContext): Promise<unknown> {
    // Audio capture logic (delegates to sensor layer)
    return input;
  }
}

