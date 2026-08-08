// Temporary diagnostic log for the sign-in flow, specifically to debug the
// "can't log in on iPad" report: no error is surfacing, so we need visible
// evidence of what actually happens across the signInWithRedirect round
// trip. Persisted to localStorage (not sessionStorage) because an iOS PWA
// opened via "Add to Home Screen" can run in a separate storage context
// from the Safari tab the redirect bounces through — if entries logged
// before the redirect are gone after it, that mismatch is itself the
// diagnosis. Rendered on the login screen in main.ts.
const STORAGE_KEY = 'kyro-v4-auth-debug-log';
const MAX_ENTRIES = 40;

export interface AuthDebugEntry {
  t: string;
  event: string;
  detail?: Record<string, unknown>;
}

function readLog(): AuthDebugEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuthDebugEntry[]) : [];
  } catch {
    return [];
  }
}

export function logAuthEvent(event: string, detail?: Record<string, unknown>): void {
  try {
    const entries = readLog();
    const entry: AuthDebugEntry = { t: new Date().toISOString(), event };
    if (detail !== undefined) entry.detail = detail;
    entries.push(entry);
    while (entries.length > MAX_ENTRIES) entries.shift();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable (private browsing, quota) — nothing useful to do;
    // the point of this log is best-effort visibility, not correctness.
  }
}

export function getAuthDebugLog(): AuthDebugEntry[] {
  return readLog();
}

export function clearAuthDebugLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function environmentSnapshot(): Record<string, unknown> {
  if (typeof window === 'undefined') return { context: 'non-browser' };
  let standalone = false;
  try {
    standalone =
      ('standalone' in navigator && navigator.standalone === true) ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches);
  } catch {
    standalone = false;
  }
  let localStorageOk = false;
  let sessionStorageOk = false;
  try {
    localStorage.setItem('kyro-v4-storage-probe', '1');
    localStorageOk = localStorage.getItem('kyro-v4-storage-probe') === '1';
    localStorage.removeItem('kyro-v4-storage-probe');
  } catch {
    localStorageOk = false;
  }
  try {
    sessionStorage.setItem('kyro-v4-storage-probe', '1');
    sessionStorageOk = sessionStorage.getItem('kyro-v4-storage-probe') === '1';
    sessionStorage.removeItem('kyro-v4-storage-probe');
  } catch {
    sessionStorageOk = false;
  }
  return {
    userAgent: navigator.userAgent,
    standalone,
    online: navigator.onLine,
    localStorageOk,
    sessionStorageOk,
    url: location.href,
  };
}
