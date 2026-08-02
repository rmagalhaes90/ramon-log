export type UpdateListener = (registration: ServiceWorkerRegistration) => void;

export async function registerPwaUpdates(onUpdate: UpdateListener): Promise<(() => void) | null> {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return null;
  const registration = await navigator.serviceWorker.register('./sw.js', {
    updateViaCache: 'none',
  });
  const inspect = (): void => {
    if (registration.waiting && navigator.serviceWorker.controller) onUpdate(registration);
  };
  registration.addEventListener('updatefound', () => {
    registration.installing?.addEventListener('statechange', inspect);
  });
  inspect();
  const check = (): void => void registration.update();
  window.addEventListener('online', check);
  document.addEventListener('visibilitychange', check);
  const timer = window.setInterval(check, 60 * 60 * 1000);
  return () => {
    window.removeEventListener('online', check);
    document.removeEventListener('visibilitychange', check);
    window.clearInterval(timer);
  };
}

export function activateUpdate(registration: ServiceWorkerRegistration): void {
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
}
