export interface StorageHealth {
  usage: number;
  quota: number;
  percent: number;
  persistent: boolean;
}
export async function storageHealth(): Promise<StorageHealth | null> {
  if (!navigator.storage?.estimate) return null;
  const estimate = await navigator.storage.estimate();
  const usage = estimate.usage ?? 0;
  const quota = estimate.quota ?? 0;
  const persistent = (await navigator.storage.persisted?.()) ?? false;
  return {
    usage,
    quota,
    percent: quota > 0 ? Math.min(100, (usage / quota) * 100) : 0,
    persistent,
  };
}
export async function requestPersistentStorage(): Promise<boolean> {
  return navigator.storage?.persist ? navigator.storage.persist() : false;
}
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
