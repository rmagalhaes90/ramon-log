import { afterEach, describe, expect, it, vi } from 'vitest';
import { notificationsSupported, requestNotificationAccess, showLocalNotification } from '../src/features/notifications';

afterEach(()=>vi.unstubAllGlobals());

describe('notifications',()=>{
  it('fails closed on unsupported platforms',async()=>{
    vi.stubGlobal('Notification',undefined);
    expect(notificationsSupported()).toBe(false);
    await expect(requestNotificationAccess()).resolves.toBe('denied');
  });

  it('requests permission only when undecided and uses the service worker',async()=>{
    const requestPermission=vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('Notification',{permission:'default',requestPermission});
    await expect(requestNotificationAccess()).resolves.toBe('granted');
    expect(requestPermission).toHaveBeenCalledOnce();
    const showNotification=vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('Notification',{permission:'granted'});
    vi.stubGlobal('navigator',{serviceWorker:{ready:Promise.resolve({showNotification})}});
    await expect(showLocalNotification('KYRO','Done')).resolves.toBe(true);
    expect(showNotification).toHaveBeenCalledWith('KYRO',expect.objectContaining({tag:'kyro-rest'}));
  });
});
