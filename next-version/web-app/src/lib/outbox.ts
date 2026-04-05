/**
 * Offline Outbox Pattern
 * Queues failed requests and retries when online
 */

export interface OutboxItem {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH';
  payload: unknown;
  retries: number;
  lastAttempt: number;
}

const OUTBOX_KEY = 'farm_visit_outbox_v1';
const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // 1 second base delay

export const outbox = {
  /**
   * Get all queued items
   */
  list(): OutboxItem[] {
    try {
      const stored = localStorage.getItem(OUTBOX_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  /**
   * Add item to outbox
   */
  push(item: Omit<OutboxItem, 'id' | 'retries' | 'lastAttempt'>): void {
    const items = this.list();
    items.push({
      ...item,
      id: crypto.randomUUID(),
      retries: 0,
      lastAttempt: Date.now(),
    });
    this.save(items);
  },

  /**
   * Remove item from outbox
   */
  remove(id: string): void {
    const items = this.list().filter((item) => item.id !== id);
    this.save(items);
  },

  /**
   * Save outbox to localStorage
   */
  save(items: OutboxItem[]): void {
    try {
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('Failed to save outbox:', err);
    }
  },

  /**
   * Flush outbox (retry all items)
   * Uses exponential backoff
   */
  async flush(): Promise<void> {
    if (!navigator.onLine) return;

    const items = this.list();
    const now = Date.now();

    for (const item of items) {
      // Calculate exponential backoff delay
      const delay = Math.min(
        BASE_DELAY * Math.pow(2, item.retries),
        30000 // Max 30 seconds
      );

      // Skip if not enough time has passed
      if (now - item.lastAttempt < delay) continue;

      // Skip if max retries exceeded
      if (item.retries >= MAX_RETRIES) {
        console.warn(`Outbox item ${item.id} exceeded max retries, removing`);
        this.remove(item.id);
        continue;
      }

      try {
        const response = await fetch(`/api${item.endpoint}`, {
          method: item.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        });

        if (response.ok) {
          // Success: remove from outbox
          this.remove(item.id);
        } else {
          // Failure: increment retries
          item.retries++;
          item.lastAttempt = Date.now();
          this.save(items);
        }
      } catch (err) {
        // Network error: increment retries
        console.error(`Outbox retry failed for ${item.id}:`, err);
        item.retries++;
        item.lastAttempt = Date.now();
        this.save(items);
      }
    }
  },
};

// Auto-flush on online event
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    outbox.flush();
  });

  // Also flush on focus (user might have reconnected)
  window.addEventListener('focus', () => {
    if (navigator.onLine) {
      outbox.flush();
    }
  });
}


