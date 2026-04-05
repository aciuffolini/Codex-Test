/**
 * RAG Client Service
 * 
 * Handles communication with local RAG service:
 * - Semantic search
 * - Record retrieval
 * - Sync operations
 */

export interface RAGSearchResult {
  id: string;
  score: number;
  snippet: string;
  metadata: {
    field_id?: string;
    crop?: string;
    issue?: string;
    created_at: number;
    [key: string]: any;
  };
}

export interface RAGConfig {
  serverUrl: string;
  apiKey?: string;
}

export class RAGClient {
  private config: RAGConfig;

  constructor(config: RAGConfig) {
    this.config = config;
  }

  /**
   * Search visits using semantic search
   * @param query - Search query text
   * @param k - Number of results to return (default: 10)
   * @param filters - Optional filters (field_id, created_at_min, etc.)
   * @param timeoutMs - Request timeout in milliseconds (default: 5000)
   */
  async search(query: string, k: number = 10, filters?: Record<string, any>, timeoutMs: number = 5000): Promise<RAGSearchResult[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${this.config.serverUrl}/rag/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify({
          query,
          k,
          filters,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Search failed: ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.detail || errorMessage;
        } catch {
          errorMessage = `${errorMessage} - ${errorText.substring(0, 200)}`;
        }
        throw new Error(errorMessage);
      }

      const results = await response.json();
      console.log(`[RAGClient] Search returned ${results.length} results for query: "${query}"`);
      return results;
    } catch (err: any) {
      // Provide actionable error messages
      let userMessage = err.message;

      if (err.name === 'AbortError') {
        userMessage = `RAG search timed out after ${timeoutMs}ms. The RAG service may be slow or unavailable.`;
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        userMessage = `Cannot connect to RAG service at ${this.config.serverUrl}. Start it with: python main.py (in server/rag_service)`;
      } else if (err.message?.includes('ECONNREFUSED')) {
        userMessage = `RAG service not running at ${this.config.serverUrl}. Start with: cd server/rag_service && python main.py`;
      }

      console.warn('[RAGClient] Search error:', {
        query,
        filters,
        error: userMessage,
        serverUrl: this.config.serverUrl,
      });

      throw new Error(userMessage);
    }
  }

  /**
   * Hybrid query: SQL for structured filters, vector for semantic, or both.
   * Prefer this over `search` when you have deterministic filters (field, crop, date).
   */
  async queryHybrid(
    params: {
      query?: string;
      field_id?: string;
      crop?: string;
      issue?: string;
      severity_min?: number;
      severity_max?: number;
      created_at_min?: number;
      created_at_max?: number;
      k?: number;
    },
    timeoutMs: number = 5000,
  ): Promise<{ results: RAGSearchResult[]; strategy: string; total: number }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.config.serverUrl}/rag/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Hybrid query failed: ${response.statusText} - ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      console.log(`[RAGClient] Hybrid query (${data.strategy}) returned ${data.results.length}/${data.total} results`);
      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Hybrid query timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }

  /**
   * Get full visit record by ID
   */
  async getVisit(id: string): Promise<any> {
    const response = await fetch(`${this.config.serverUrl}/visits/${id}`, {
      headers: {
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`Get visit failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Upsert visit record (for embedding generation)
   */
  async upsertVisit(record: any): Promise<void> {
    const response = await fetch(`${this.config.serverUrl}/rag/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
      },
      body: JSON.stringify(record),
    });

    if (!response.ok) {
      throw new Error(`Upsert failed: ${response.statusText}`);
    }
  }

  /**
   * Sync pending visits
   */
  async syncPendingVisits(): Promise<void> {
    const { getSyncQueue } = await import('../queues/SyncQueue');
    const syncQueue = getSyncQueue();

    // Set config if not already set
    syncQueue.setConfig({
      serverUrl: this.config.serverUrl,
      apiKey: this.config.apiKey,
    });

    // Sync all pending
    await syncQueue.syncAllPending();
  }

  /**
   * Check if server is available
   */
  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.serverUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Get or create global RAG client
 */
let globalRAGClient: RAGClient | null = null;

export function getRAGClient(config?: RAGConfig): RAGClient {
  if (!globalRAGClient && config) {
    globalRAGClient = new RAGClient(config);
  } else if (config && globalRAGClient) {
    // Update config
    globalRAGClient = new RAGClient(config);
  }

  if (!globalRAGClient) {
    // Default config from environment or localStorage
    const serverUrl = import.meta.env.VITE_RAG_SERVER_URL || localStorage.getItem('rag_server_url') || 'http://localhost:8000';
    globalRAGClient = new RAGClient({ serverUrl });
  }

  return globalRAGClient;
}

