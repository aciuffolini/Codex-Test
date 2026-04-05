/**
 * LLMProvider - Simplified facade for LLM access
 * Delegates to LLMStrategy for decision making
 * 
 * This is the main interface used by components
 */

import { LLMStrategy, LLMRequest, TaskComplexity } from './LLMStrategy';
import { twinCore, type TwinStatus } from '../twin/TwinCore';

export type ModelOption = 'nano' | 'gpt-4o-mini' | 'llama-small' | 'claude-code' | 'auto';

export interface LLMInput {
  text: string;
  location?: { lat: number; lon: number };
  images?: string[];
  model?: ModelOption;
  visitContext?: {
    current?: {
      gps?: { lat: number; lon: number; accuracy?: number } | null;
      note?: string | null;
      photo?: string | null; // Base64 data URL
      audio?: string | null; // Base64 data URL
    };
    kmzData?: {
      placemarks: Array<{
        name: string;
        type: "polygon" | "line" | "point";
        coordinates: Array<{ lat: number; lon: number; alt?: number }>;
      }>;
      bounds: {
        north: number;
        south: number;
        east: number;
        west: number;
      };
    } | null;
    latest?: {
      id?: string;
      field_id?: string;
      crop?: string;
      issue?: string;
      severity?: number;
      photo_data?: string;
      audio_data?: string;
    } | null;
    allVisits?: Array<{
      id?: string;
      field_id?: string;
      crop?: string;
      issue?: string;
      severity?: number;
      note?: string;
      ts?: number;
      lat?: number;
      lon?: number;
      acc?: number;
      photo_data?: string;
      audio_data?: string;
    }>;
  } | null;
}

export interface LLMProviderStats {
  provider: 'local' | 'cloud' | 'none';
  localAvailable: boolean;
  cloudAvailable: boolean;
  model?: ModelOption;
}

export class LLMProvider {
  private strategy = new LLMStrategy();
  private lastTwinStatus: TwinStatus | null = null;

  /**
   * Stream response from appropriate LLM
   */
  async *stream(input: LLMInput): AsyncGenerator<string> {
    // Map model option to strategy preference
    let preferredModel: 'local' | 'cloud' | 'auto' = 'auto';
    let provider: 'openai' | 'anthropic' | undefined = undefined;

    if (input.model === 'nano' || input.model === 'llama-small') {
      preferredModel = 'local';
    } else if (input.model === 'gpt-4o-mini') {
      preferredModel = 'cloud';
      provider = 'openai';
    } else if (input.model === 'claude-code') {
      preferredModel = 'cloud';
      provider = 'anthropic';
    }

    // Build system prompt from visit context (with RAG search if available)
    const systemPrompt = await this.buildSystemPrompt(input.visitContext, input.text);

    // Extract images from visit context (only for cloud multimodal models)
    const images: string[] = [];
    if (preferredModel !== 'local') {
      if (input.images) {
        images.push(...input.images);
      }
      if (input.visitContext?.current?.photo) {
        images.push(input.visitContext.current.photo);
      }
      if (input.visitContext?.latest?.photo_data) {
        images.push(input.visitContext.latest.photo_data);
      }
      if (input.visitContext?.allVisits) {
        for (const visit of input.visitContext.allVisits) {
          if (visit.photo_data && !images.includes(visit.photo_data)) {
            images.push(visit.photo_data);
          }
        }
      }
    }

    // Determine task complexity
    // Complex if has images (vision analysis) or long context
    const taskComplexity: TaskComplexity =
      images.length > 0 || (input.visitContext?.allVisits && input.visitContext.allVisits.length > 5)
        ? 'complex'
        : 'simple';

    const request: LLMRequest = {
      text: input.text,
      location: input.location,
      images: images.length > 0 ? images : undefined,
      systemPrompt,
      preferredModel,
      taskComplexity,
      provider,
    };

    yield* this.strategy.stream(request);
  }

  /**
   * Build system prompt from visit context and RAG search
   */
  private async buildSystemPrompt(
    visitContext?: LLMInput['visitContext'],
    userQuery?: string
  ): Promise<string> {
    let prompt = `You are an expert agricultural field visit assistant. Help farmers and agricultural professionals with:

**Core Responsibilities:**
• Field visit data capture and organization
• Crop identification and management advice
• Pest and disease detection and treatment recommendations
• Agricultural best practices and field management
• GPS location-based agricultural insights
• **MULTIMODAL ANALYSIS**: Photo analysis + Map data + GPS location for comprehensive field insights

**Communication Style:**
• Be concise, practical, and provide actionable advice
• **ALWAYS analyze photos when provided** - they contain critical visual information
• Combine photo analysis with map data and GPS location
• Use visit context (GPS, notes, photos, audio, saved visits, farm map) for specific responses
• Respond in a friendly, professional manner suitable for field work`;

    // Add visit context if available
    if (visitContext) {
      if (visitContext.current?.gps) {
        prompt += `\n\n**Current Location:** ${visitContext.current.gps.lat.toFixed(6)}, ${visitContext.current.gps.lon.toFixed(6)}`;
        if (visitContext.current.gps.accuracy) {
          prompt += ` (accuracy: ${visitContext.current.gps.accuracy.toFixed(0)}m)`;
        }
      }

      if (visitContext.current?.note) {
        prompt += `\n\n**Current Note:** "${visitContext.current.note}"`;
      }

      if (visitContext.current?.photo) {
        prompt += `\n\n**Photo Available:** Yes (will be analyzed)`;
      }

      if (visitContext.kmzData && visitContext.kmzData.placemarks.length > 0) {
        prompt += `\n\n**Farm Map:** ${visitContext.kmzData.placemarks.length} fields/regions mapped`;
        // Add field names if GPS matches
        if (visitContext.current?.gps) {
          const matchingFields = visitContext.kmzData.placemarks
            .filter(p => this.isPointInPlacemark(visitContext.current!.gps!, p))
            .map(p => p.name);
          if (matchingFields.length > 0) {
            prompt += `\n**Current Field:** ${matchingFields[0]}`;
          }
        }
      }

      if (visitContext.latest) {
        prompt += `\n\n**Latest Visit:**`;
        if (visitContext.latest.field_id) prompt += ` Field: ${visitContext.latest.field_id}`;
        if (visitContext.latest.crop) prompt += `, Crop: ${visitContext.latest.crop}`;
        if (visitContext.latest.issue) prompt += `, Issue: ${visitContext.latest.issue}`;
      }
    }

    const twinContext = await twinCore.buildRetrievalContext(visitContext, userQuery);
    this.lastTwinStatus = twinContext.status;
    prompt += twinContext.promptAppendix;

    return prompt;
  }

  getLastTwinStatus(): TwinStatus | null {
    return this.lastTwinStatus;
  }

  /**
   * Simple point-in-polygon check (for field identification)
   */
  private isPointInPlacemark(
    point: { lat: number; lon: number },
    placemark: { coordinates: Array<{ lat: number; lon: number }> }
  ): boolean {
    // Simple bounding box check (can be improved with proper point-in-polygon)
    if (placemark.coordinates.length === 0) return false;

    const lats = placemark.coordinates.map(c => c.lat);
    const lons = placemark.coordinates.map(c => c.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    return point.lat >= minLat && point.lat <= maxLat &&
      point.lon >= minLon && point.lon <= maxLon;
  }

  /**
   * Get current provider statistics
   */
  async getStats(): Promise<LLMProviderStats> {
    const models = await this.strategy.getAvailableModels();

    return {
      provider: models.local ? 'local' : models.cloud ? 'cloud' : 'none',
      localAvailable: models.local,
      cloudAvailable: models.cloud,
    };
  }

  /**
   * Check which providers are available
   */
  async checkAvailability(): Promise<{
    local: boolean;
    cloud: boolean;
    localDetails: { nano: boolean; llama: boolean };
    cloudDetails: { openai: boolean; anthropic: boolean };
  }> {
    return this.strategy.getAvailableModels();
  }
}

// Default instance
export const llmProvider = new LLMProvider();
