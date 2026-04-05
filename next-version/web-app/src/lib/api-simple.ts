/**
 * SIMPLE API - No complex parsing, just make it work
 * Auto-detects local server or uses production API
 */

import { ChatMessage } from '@farm-visit/shared';
import { getUserApiKey } from './config/userKey';
import { Capacitor } from '@capacitor/core';

/**
 * Get API base URL - auto-detects local server or uses production
 */
async function getApiBase(): Promise<string> {
  // Android/iOS - use production API (no local server needed)
  if (Capacitor.isNativePlatform()) {
    const prodUrl = import.meta.env.VITE_API_URL;
    if (!prodUrl) {
      // For Android, we need a production API URL
      // If not set, throw clear error
      throw new Error(
        'VITE_API_URL not configured. Android requires a production API server. ' +
        'Set VITE_API_URL in your .env file or build configuration.'
      );
    }
    return prodUrl;
  }
  
  // Web - try local server first, fallback to production
  try {
    const response = await fetch('/api/health', { 
      method: 'GET',
      signal: AbortSignal.timeout(1000) // 1 second timeout
    });
    if (response.ok) {
      return '/api'; // Use local proxy (Vite will proxy to localhost:3000)
    }
  } catch {
    // Local server not running, try production API
    const prodUrl = import.meta.env.VITE_API_URL;
    if (prodUrl) {
      return prodUrl;
    }
    // No local server and no production URL - show helpful error
    throw new Error(
      'No API server available. ' +
      'Start local server: node test-server.js (in apps/web directory) ' +
      'OR set VITE_API_URL environment variable for production API.'
    );
  }
  
  return '/api'; // Default to local proxy
}

/**
 * Ultra-simple chat streaming - uses fetch with manual SSE parsing
 */
export async function* simpleStreamChat(
  messages: ChatMessage[],
  provider?: string
): AsyncGenerator<string> {
  const apiKey = getUserApiKey();
  if (!apiKey) {
    throw new Error('API key required');
  }

  // Auto-detect API base URL
  const apiBase = await getApiBase();
  const url = `${apiBase}/chat`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
  };
  
  if (provider) {
    headers['X-Provider'] = provider;
    headers['X-Model'] = provider;
  }

  console.log('[API-Simple] Using API base:', apiBase);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Server error: ${response.status} - ${text.substring(0, 100)}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  // ULTRA-SIMPLE: Read entire response as text first, then parse
  // This avoids incomplete JSON issues
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  try {
    // Read all chunks first
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });
    }
    
    // Flush decoder
    try {
      fullText += decoder.decode();
    } catch {
      // Ignore
    }

    console.log('[API-Simple] Received full text length:', fullText.length);
    console.log('[API-Simple] First 200 chars:', fullText.substring(0, 200));

    // Now parse line by line
    const lines = fullText.split(/\r?\n/);
    let hasData = false;

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim();
        
        if (jsonStr === '[DONE]') {
          console.log('[API-Simple] Stream complete');
          return;
        }
        
        if (!jsonStr) continue;

        try {
          const obj = JSON.parse(jsonStr);
          
          if (obj.error) {
            console.error('[API-Simple] Error in stream:', obj.error);
            throw new Error(obj.error);
          }
          
          const text = obj.choices?.[0]?.delta?.content || obj.token || '';
          if (text) {
            hasData = true;
            yield text;
          }
        } catch (e: any) {
          if (e instanceof SyntaxError) {
            console.warn('[API-Simple] JSON parse error on line:', jsonStr.substring(0, 100));
            // Skip this line, continue with next
            continue;
          }
          throw e;
        }
      }
    }

    if (!hasData) {
      throw new Error('No data received from stream');
    }
  } finally {
    reader.releaseLock();
  }
}

