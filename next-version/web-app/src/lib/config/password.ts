/**
 * Password Hashing & Validation
 * Uses SHA-256 for secure password storage
 */

// Default password: 'Fotheringham933@'
// In production, set VITE_APP_PASSWORD_HASH with the SHA-256 hash of your password
// To generate: hashPassword('Fotheringham933@') and use the result
// This is a placeholder - will be replaced with actual hash on first run or via env

/**
 * Hash a password using SHA-256
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Get the stored password hash
 * First checks environment variable, then localStorage, then calculates from default password
 */
async function getStoredHash(): Promise<string> {
  // Check environment variable first (most secure)
  const envHash = import.meta.env.VITE_APP_PASSWORD_HASH;
  if (envHash) {
    return envHash;
  }
  
  // Check localStorage for stored hash (for migration or user-set password)
  if (typeof window !== 'undefined') {
    const storedHash = localStorage.getItem('app_password_hash');
    if (storedHash) {
      return storedHash;
    }
  }
  
  // Fallback: Calculate hash from default password
  // This allows the app to work without configuration, but password is visible in code
  // In production, set VITE_APP_PASSWORD_HASH in .env file
  // Android version requires: Fotheringham933@
  const defaultPassword = 'Fotheringham933@';
  return await hashPassword(defaultPassword);
}

/**
 * Validate password against stored hash
 */
export async function validatePassword(password: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  const storedHash = await getStoredHash();
  return passwordHash === storedHash;
}

/**
 * Store password hash (for first-time setup or migration)
 */
export async function storePasswordHash(password: string): Promise<void> {
  const hash = await hashPassword(password);
  if (typeof window !== 'undefined') {
    localStorage.setItem('app_password_hash', hash);
  }
}

/**
 * Initialize password hash on first run
 * This should be called once when app is first installed
 */
export async function initializePassword(password: string): Promise<void> {
  const hash = await hashPassword(password);
  if (typeof window !== 'undefined') {
    localStorage.setItem('app_password_hash', hash);
    console.log('[Password] Initial password hash stored');
  }
}

