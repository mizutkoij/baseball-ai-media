/**
 * ES-module compatibility shim
 * Enables seamless CommonJS interop in ES module context
 */
import { createRequire } from 'module';

export const requireCompat = createRequire(import.meta.url);

// For backward compatibility with existing code
export const require = requireCompat;

// Type-safe require wrapper
export function requireSafe<T = any>(moduleId: string): T {
  try {
    return requireCompat(moduleId);
  } catch (error: any) {
    throw new Error(`Failed to require module '${moduleId}': ${error?.message || 'Unknown error'}`);
  }
}

// Async import wrapper for dynamic imports
export async function importSafe<T = any>(moduleId: string): Promise<T> {
  try {
    return await import(moduleId);
  } catch (error: any) {
    throw new Error(`Failed to import module '${moduleId}': ${error?.message || 'Unknown error'}`);
  }
}