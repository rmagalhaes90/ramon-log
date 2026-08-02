export type ErrorContext = Readonly<Record<string, string | number | boolean>>;

export class KyroError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly context: ErrorContext = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'KyroError';
  }
}

type ErrorListener = (error: KyroError) => void;
const listeners = new Set<ErrorListener>();

export function normalizeError(value: unknown, code = 'unknown'): KyroError {
  if (value instanceof KyroError) return value;
  if (value instanceof Error) return new KyroError(value.message, code, {}, { cause: value });
  return new KyroError(String(value), code);
}

export function reportError(value: unknown, code?: string): KyroError {
  const error = normalizeError(value, code);
  console.error(`[${error.code}]`, error);
  listeners.forEach((listener) => listener(error));
  return error;
}

export function onError(listener: ErrorListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function installGlobalErrorHandlers(): void {
  window.addEventListener('error', (event) => reportError(event.error ?? event.message, 'window'));
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason, 'promise'));
}
