import type { LLMInput } from '../llm/LLMProvider';

export type RetrievalStatus =
  | 'idle'
  | 'searching'
  | 'ready'
  | 'empty'
  | 'skipped-offline'
  | 'error';

export interface TwinStatus {
  online: boolean;
  sync: {
    queued: number;
    pending: number;
  };
  retrieval: {
    enforced: boolean;
    status: RetrievalStatus;
    source: 'rag' | 'current-context';
    resultCount: number;
    message?: string;
  };
}

export interface TwinContextResult {
  promptAppendix: string;
  status: TwinStatus;
}

function createBaseStatus(): TwinStatus {
  return {
    online: typeof navigator !== 'undefined' ? navigator.onLine : false,
    sync: {
      queued: 0,
      pending: 0,
    },
    retrieval: {
      enforced: true,
      status: 'idle',
      source: 'current-context',
      resultCount: 0,
    },
  };
}

export class TwinCore {
  async getStatus(): Promise<TwinStatus> {
    const status = createBaseStatus();

    try {
      const { getSyncQueue } = await import('../queues/SyncQueue');
      status.sync = await getSyncQueue().getStatus();
    } catch (err: any) {
      status.retrieval.message = `Sync status unavailable: ${err?.message || 'Unknown error'}`;
    }

    return status;
  }

  async buildRetrievalContext(
    visitContext?: LLMInput['visitContext'],
    userQuery?: string
  ): Promise<TwinContextResult> {
    const status = await this.getStatus();
    let promptAppendix = '';
    const appendCurrentContext = () => {
      if (visitContext?.current) {
        promptAppendix += `\n\n**IMPORTANT: Current Real-Time Data Available:**`;
        if (visitContext.current.gps) {
          promptAppendix += `\n- GPS: ${visitContext.current.gps.lat.toFixed(6)}, ${visitContext.current.gps.lon.toFixed(6)}`;
          if (visitContext.current.gps.accuracy)
            promptAppendix += ` (±${visitContext.current.gps.accuracy.toFixed(0)}m)`;
        }
        if (visitContext.current.photo) {
          promptAppendix += `\n- Current photo is available for analysis`;
        }
        if (visitContext.current.audio) {
          promptAppendix += `\n- Audio recording is available`;
        }
        if (visitContext.current.note) {
          promptAppendix += `\n- Field note: "${visitContext.current.note}"`;
        }
        promptAppendix += `\nUse this real-time data when answering questions about the current visit.`;
      }
    };

    if (!userQuery?.trim()) {
      appendCurrentContext();
      return { promptAppendix, status };
    }

    if (!status.online) {
      status.retrieval.status = 'skipped-offline';
      status.retrieval.source = 'current-context';
      status.retrieval.message = 'Offline: using current Twin context only.';
      promptAppendix += '\n\n**Note:** Offline mode detected. Retrieval skipped; use only current visit context.';
      appendCurrentContext();
      return { promptAppendix, status };
    }

    status.retrieval.status = 'searching';

    const ragServerUrl =
      import.meta.env.VITE_RAG_SERVER_URL ||
      localStorage.getItem('rag_server_url') ||
      'http://localhost:8000';

    try {
      const { getRAGClient } = await import('../services/ragClient');
      const { parseQueryFilters, isHistoricalQuery } = await import('../rag/queryParser');
      const ragClient = getRAGClient({ serverUrl: ragServerUrl });
      const filters = parseQueryFilters(userQuery);
      const historical = isHistoricalQuery(userQuery);

      const hasStructuredFilters = !!(filters.field_id || filters.crop || filters.issue || filters.created_at_min);

      let results: Array<{ id: string; score: number; snippet: string; source?: string; metadata: Record<string, any> }>;
      let strategy = 'semantic';

      if (hasStructuredFilters) {
        const hybrid = await ragClient.queryHybrid({
          query: userQuery,
          field_id: filters.field_id,
          crop: filters.crop,
          issue: filters.issue,
          created_at_min: filters.created_at_min,
          k: historical ? 10 : 5,
        }, 3000);
        results = hybrid.results;
        strategy = hybrid.strategy;
      } else {
        results = await ragClient.search(userQuery, historical ? 10 : 5, filters, 3000);
      }

      status.retrieval.source = 'rag';
      status.retrieval.resultCount = results.length;

      if (!results.length) {
        status.retrieval.status = 'empty';
        status.retrieval.message = 'No matching historical records found.';
        promptAppendix += '\n\n**Historical Retrieval:** No matching past visits found. Use current visit context only.';
        return { promptAppendix, status };
      }

      status.retrieval.status = 'ready';
      status.retrieval.message = `Retrieved ${results.length} record(s) via ${strategy} before reasoning.`;

      if (historical || strategy === 'sql') {
        promptAppendix += `\n\n**Historical Visits (retrieved via ${strategy}):**`;
        if (filters.field_id) {
          promptAppendix += `\nFiltered by: Field ${filters.field_id}`;
        }
        if (filters.crop) {
          promptAppendix += `\nFiltered by: Crop ${filters.crop}`;
        }
        if (filters.issue) {
          promptAppendix += `\nFiltered by: Issue ${filters.issue}`;
        }
        if (filters.created_at_min) {
          const daysAgo = Math.floor((Date.now() - filters.created_at_min) / (24 * 60 * 60 * 1000));
          promptAppendix += `\nTime range: Last ${daysAgo} days`;
        }
      } else {
        promptAppendix += `\n\n**Relevant Past Visits (retrieved before reasoning):**`;
      }

      for (const result of results.slice(0, historical ? 10 : 3)) {
        const date = result.metadata.created_at
          ? new Date(result.metadata.created_at).toLocaleDateString()
          : 'Unknown date';
        const sourceTag = result.source === 'sql' ? ' [exact]' : '';
        promptAppendix += `\n- [${date}]${sourceTag} ${result.snippet.substring(0, 200)}`;
        if (result.metadata.field_id) promptAppendix += ` | Field: ${result.metadata.field_id}`;
        if (result.metadata.crop) promptAppendix += ` | Crop: ${result.metadata.crop}`;
        if (result.metadata.issue) promptAppendix += ` | Issue: ${result.metadata.issue}`;
        if (result.metadata.severity != null && result.metadata.severity >= 0)
          promptAppendix += ` | Severity: ${result.metadata.severity}/5`;
        if (result.metadata.lat && result.metadata.lon && result.metadata.lat !== 0)
          promptAppendix += ` | GPS: ${Number(result.metadata.lat).toFixed(4)},${Number(result.metadata.lon).toFixed(4)}`;
        if (result.metadata.note) promptAppendix += `\n  Note: "${result.metadata.note}"`;
        if (result.metadata.audio_transcript)
          promptAppendix += `\n  Audio: "${result.metadata.audio_transcript}"`;
        if (result.metadata.photo_caption)
          promptAppendix += `\n  Photo caption: "${result.metadata.photo_caption}"`;
      }
    } catch (err: any) {
      status.retrieval.status = 'error';
      status.retrieval.source = 'current-context';
      status.retrieval.message = err.message || 'Retrieval failed';
      promptAppendix += `\n\n**Note:** RAG search unavailable (${err.message}). Using only current visit context.`;
    }

    appendCurrentContext();

    return { promptAppendix, status };
  }
}

export const twinCore = new TwinCore();
