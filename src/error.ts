/**
 * Custom error class for module-tsx specific errors
 */
export class ModuleTSXError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ModuleTSXError";

    if ("captureStackTrace" in Error) {
      //@ts-ignore
      Error.captureStackTrace(this, ModuleTSXError);
    }
  }
}

/**
 * Utility function to log warnings with consistent formatting
 */
export function warn(message: string, ...args: unknown[]): void {
  console.warn(`[module-tsx] ${message}`, ...args);
}
