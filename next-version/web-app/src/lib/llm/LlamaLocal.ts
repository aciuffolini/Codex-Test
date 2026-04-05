/**
 * Llama Local Integration - On-Device Offline Fallback using WebLLM
 * Runs Llama 3.2 directly in the browser/WebView via WebGPU
 * Fully offline after initial model download
 *
 * Matches the proven 7_farm_visit implementation: straightforward
 * CreateMLCEngine call with no timeout wrappers.  Only improvement
 * over the original is idempotent initialization (concurrent callers
 * join the same promise instead of crashing).
 */

import { CreateMLCEngine, MLCEngine, InitProgressReport, prebuiltAppConfig } from '@mlc-ai/web-llm';

export interface LlamaLocalInput {
  text: string;
  systemPrompt?: string;
  location?: { lat: number; lon: number };
}

export type LlamaInitCallback = (progress: InitProgressReport) => void;

// 3B is the proven-working model from 7_farm_visit.
const MODEL_ID = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';

export class LlamaLocal {
  private engine: MLCEngine | null = null;
  private initPromise: Promise<void> | null = null;
  private downloadProgress: string = '';

  async checkAvailability(): Promise<boolean> {
    if (!(navigator as any).gpu) {
      console.warn('[LlamaLocal] WebGPU not supported on this device/browser.');
      return false;
    }
    return true;
  }

  getProgress(): string {
    return this.downloadProgress;
  }

  getActiveModel(): string {
    return this.engine ? MODEL_ID : '';
  }

  /**
   * Initialize the WebLLM engine. Safe to call concurrently — subsequent
   * callers join the existing initialization promise instead of starting a
   * duplicate download.
   */
  async initialize(onProgress?: LlamaInitCallback): Promise<void> {
    if (this.engine) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInit(onProgress);
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async _doInit(onProgress?: LlamaInitCallback): Promise<void> {
    const isAvailable = await this.checkAvailability();
    if (!isAvailable) {
      throw new Error('WebGPU is not supported on this device. Cannot run Llama Local.');
    }

    const initProgressCallback = (report: InitProgressReport) => {
      this.downloadProgress = report.text;
      if (onProgress) onProgress(report);
    };

    try {
      console.log(`[LlamaLocal] Initializing ${MODEL_ID} (IndexedDB cache)...`);
      this.engine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback,
        appConfig: {
          model_list: prebuiltAppConfig.model_list,
          useIndexedDBCache: true,
        },
      });
      console.log('[LlamaLocal] Engine initialized successfully!');
      this.downloadProgress = 'Ready';
    } catch (err: any) {
      console.error('[LlamaLocal] Initialization failed:', err);
      this.engine = null;
      this.downloadProgress = 'Error loading model';
      throw new Error(`Failed to load Llama model: ${err.message}`);
    }
  }

  /**
   * Stream completion for chat.
   * Throws immediately if the engine isn't loaded — callers should catch
   * and fall back to cloud.  The ChatDrawer effect handles background
   * initialization separately.
   */
  async *stream(input: LlamaLocalInput): AsyncGenerator<string> {
    if (!this.engine) {
      throw new Error('Llama Local engine is not initialized. Please load the model first.');
    }

    if (!input.text) {
      throw new Error('Text input required');
    }

    let promptText = input.text;
    if (input.location) {
      promptText += `\n\nLocation Context: ${input.location.lat.toFixed(6)}, ${input.location.lon.toFixed(6)}`;
    }

    const systemContent = this.trimForLocal(
      input.systemPrompt ||
        'You are an offline agricultural assistant for field visits. Keep answers concise, practical, and helpful.',
    );

    try {
      console.log(`[LlamaLocal] System prompt length: ${systemContent.length} chars, user: ${promptText.length} chars`);

      const generator = await this.engine.chat.completions.create({
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: promptText },
        ],
        stream: true,
      });

      let tokenCount = 0;
      for await (const chunk of generator) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          tokenCount++;
          yield content;
        }
      }
      console.log(`[LlamaLocal] Stream finished — ${tokenCount} token chunks yielded`);
    } catch (err: any) {
      console.error('[LlamaLocal] Streaming failed:', err);
      throw new Error(`Llama Local generation failed: ${err.message}`);
    }
  }

  /**
   * Cap the system prompt so the 3B model's 8K context window has room for
   * the user message and a reasonable-length response (~2K tokens).
   * Rough heuristic: 1 token ≈ 4 chars → keep system prompt ≤ 6000 chars.
   */
  private trimForLocal(prompt: string): string {
    const MAX_CHARS = 6000;
    if (prompt.length <= MAX_CHARS) return prompt;
    console.warn(`[LlamaLocal] System prompt too long (${prompt.length} chars), trimming to ${MAX_CHARS}`);
    return prompt.slice(0, MAX_CHARS) + '\n\n[…context trimmed for local model]';
  }

  isReady(): boolean {
    return this.engine !== null;
  }

  isInitializing(): boolean {
    return this.initPromise !== null;
  }
}

// Default instance
export const llamaLocal = new LlamaLocal();
