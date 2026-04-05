/**
 * LLMStrategy - Decides which LLM to use based on availability and task
 *
 * Key rule for 'auto' mode: never block a chat request waiting for a model
 * download.  Use local Llama only if its engine is already loaded; otherwise
 * prefer cloud and let the background download finish on its own.
 */

import { LocalLLM } from './LocalLLM';
import { CloudLLM } from './CloudLLM';
import { llamaLocal } from './LlamaLocal';

export type TaskComplexity = 'simple' | 'complex';

export interface LLMRequest {
  text: string;
  location?: { lat: number; lon: number };
  images?: string[];
  systemPrompt?: string;
  preferredModel?: 'local' | 'cloud' | 'auto';
  taskComplexity?: TaskComplexity;
  provider?: 'openai' | 'anthropic';
}

export interface LLMStrategyStats {
  localAvailable: boolean;
  cloudAvailable: boolean;
  selectedProvider: 'local' | 'cloud' | 'none';
  reason?: string;
}

export class LLMStrategy {
  private localLLM = new LocalLLM();
  private cloudLLM = new CloudLLM();

  async *stream(request: LLMRequest): AsyncGenerator<string> {
    // User explicitly wants local — honour the choice but with a timeout
    // so a stalled download surfaces an error instead of hanging forever.
    if (request.preferredModel === 'local') {
      try {
        yield* this.localLLM.stream(request);
        return;
      } catch (err: any) {
        const cloudAvailable = this.cloudLLM.isAvailable();
        if (cloudAvailable) {
          console.warn('[LLMStrategy] Local failed, falling back to cloud:', err.message);
          yield* this.cloudLLM.stream({ ...request, provider: request.provider });
          return;
        }
        throw err;
      }
    }

    // User explicitly wants cloud
    if (request.preferredModel === 'cloud') {
      yield* this.cloudLLM.stream({
        ...request,
        provider: request.provider,
      });
      return;
    }

    // ----- Auto mode --------------------------------------------------
    // Priority: local-if-ready > cloud > local-with-wait > error
    const localReady = llamaLocal.isReady();
    const cloudAvailable = this.cloudLLM.isAvailable();

    // If local engine is already loaded, use it immediately (zero wait).
    if (localReady) {
      try {
        yield* this.localLLM.stream(request);
        return;
      } catch (err: any) {
        console.warn('[LLMStrategy] Local ready but failed, trying cloud:', err.message);
      }
    }

    // Cloud is the fast path when local is still downloading.
    if (cloudAvailable) {
      try {
        yield* this.cloudLLM.stream({
          ...request,
          provider: request.provider,
        });
        return;
      } catch (err: any) {
        console.warn('[LLMStrategy] Cloud failed:', err.message);
      }
    }

    // Both unavailable — only now wait for local (offline-only scenario).
    const localHasWebGPU = await llamaLocal.checkAvailability();
    if (localHasWebGPU) {
      yield* this.localLLM.stream(request);
      return;
    }

    throw new Error('No LLM available. Install local model (Nano/Llama) or set API key for cloud models.');
  }

  async getAvailableModels(): Promise<{
    local: boolean;
    cloud: boolean;
    localDetails: { nano: boolean; llama: boolean };
    cloudDetails: { openai: boolean; anthropic: boolean };
  }> {
    const [localAvailable, localDetails] = await Promise.all([
      this.localLLM.isAvailable(),
      this.localLLM.getAvailableModels(),
    ]);

    const cloudAvailable = this.cloudLLM.isAvailable();
    const cloudDetails = this.cloudLLM.getAvailableProviders();

    return {
      local: localAvailable,
      cloud: cloudAvailable,
      localDetails,
      cloudDetails,
    };
  }
}

