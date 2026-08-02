export function notificationsSupported(): boolean {
  return typeof Notification !== 'undefined';
}

export async function requestNotificationAccess(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export async function showLocalNotification(title: string, body: string): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  const options: NotificationOptions = { body, icon: './icon-192.png', badge: './icon-192.png', tag: 'kyro-rest', silent: false };
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, options);
  } else {
    new Notification(title, options);
  }
  return true;
}
