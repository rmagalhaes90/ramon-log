import AsyncStorage from '@react-native-async-storage/async-storage';

const key = '@kyro:diagnostics';
export interface DiagnosticEvent {
  at: string;
  context: string;
  message: string;
  stack?: string;
}

export async function reportDiagnostic(error: unknown, context: string): Promise<void> {
  const item: DiagnosticEvent = {
    at: new Date().toISOString(),
    context: context.slice(0, 100),
    message: (error instanceof Error ? error.message : String(error)).slice(0, 500),
    ...(error instanceof Error && error.stack ? { stack: error.stack.slice(0, 4000) } : {}),
  };
  try {
    const existing = await readDiagnostics();
    await AsyncStorage.setItem(key, JSON.stringify([...existing, item].slice(-50)));
  } catch {
    /* Diagnostics must never crash the app. */
  }
}

export async function readDiagnostics(): Promise<DiagnosticEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const value = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(value) ? (value as DiagnosticEvent[]) : [];
  } catch {
    return [];
  }
}
