/**
 * User API Key Management
 * Stores API key locally (device storage)
 * Sent as X-API-Key header to backend
 */

export function getUserApiKey(): string {
  if (typeof window === 'undefined') return '';
  // Check environment variable first (from .env file), then localStorage
  return import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('user_api_key') || '';
}

export function setUserApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (key) {
    // Remove any quotes that user might have added
    const cleanedKey = key.trim().replace(/^["']|["']$/g, '');
    localStorage.setItem('user_api_key', cleanedKey);
  } else {
    localStorage.removeItem('user_api_key');
  }
}

// Global helper for quick setup on device
if (typeof window !== 'undefined') {
  (window as any).setAPIKey = setUserApiKey;
}

