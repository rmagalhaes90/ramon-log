import type { User } from 'firebase/auth';
import type { Locale, MessageKey } from '../../core/i18n';
import { reportError } from '../../core/errors';
import { deleteOwnAccount } from '../account/delete-account';
import { bindDataPortability } from '../backup/ui';
import {
  notificationsSupported,
  requestNotificationAccess,
  showLocalNotification,
} from '../notifications';
import { clearLocalData } from '../../services/database';
import { loadUserData, saveUserData } from '../../services/user-data';

interface SettingsViewOptions {
  copy: (key: MessageKey) => string;
  locale: Locale;
  shell: (content: string) => void;
  onBack: () => void;
  onRestNotificationsChange: (enabled: boolean) => void;
}
const formText = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
};

export async function renderSettingsView(user: User, options: SettingsViewOptions): Promise<void> {
  const { copy, shell, onBack } = options;
  const passwordProvider = user.providerData.some(({ providerId }) => providerId === 'password');
  const settings = await loadUserData(user, 'notificationSettings').then(
    (value) => value ?? { restEnabled: false },
  );
  options.onRestNotificationsChange(settings.restEnabled);
  shell(
    `<section class="feature-view"><button id="feature-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">04 · ACCOUNT</p><h1>${copy('settings')}</h1><article class="notification-card"><h2>${copy('notifications')}</h2><p id="notification-body"></p><div><button id="notification-toggle"></button><button id="notification-test">${copy('testNotification')}</button></div><p id="notification-status" role="status"></p></article><article class="backup-card"><h2>${copy('yourData')}</h2><p>${copy('backupBody')}</p><div><button id="export-data">${copy('exportData')}</button><label class="import-button">${copy('importData')}<input id="import-data" type="file" accept="application/json,.json"></label></div><p id="backup-status" role="status"></p></article><article class="danger-zone"><h2>${copy('deleteAccount')}</h2><p>${copy('deleteWarning')}</p><form id="delete-form"><label>${copy('confirmation')}<input name="phrase" autocomplete="off" required></label>${passwordProvider ? `<label>${copy('password')}<input name="password" type="password" autocomplete="current-password" required></label>` : ''}<button class="danger-button">${copy('deleteAccount')}</button></form><p id="delete-status" role="status"></p></article></section>`,
  );
  document.querySelector('#feature-back')?.addEventListener('click', onBack);
  const body = document.querySelector('#notification-body');
  if (body)
    body.textContent = copy(
      notificationsSupported() ? 'notificationBody' : 'notificationUnsupported',
    );
  const toggle = document.querySelector<HTMLButtonElement>('#notification-toggle');
  const test = document.querySelector<HTMLButtonElement>('#notification-test');
  const notificationStatus = document.querySelector('#notification-status');
  if (toggle) {
    toggle.disabled = !notificationsSupported();
    toggle.textContent = copy(
      settings.restEnabled ? 'disableNotifications' : 'enableNotifications',
    );
    toggle.addEventListener(
      'click',
      () =>
        void (async () => {
          const enabled = !settings.restEnabled;
          if (enabled && (await requestNotificationAccess()) !== 'granted') {
            if (notificationStatus) notificationStatus.textContent = copy('notificationDenied');
            return;
          }
          await saveUserData(user, 'notificationSettings', { restEnabled: enabled });
          options.onRestNotificationsChange(enabled);
          await renderSettingsView(user, options);
        })().catch((error: unknown) => reportError(error, 'notifications/settings')),
    );
  }
  if (test) {
    test.disabled = !settings.restEnabled;
    test.addEventListener(
      'click',
      () =>
        void showLocalNotification('KYRO', copy('restComplete'))
          .then((shown) => {
            if (notificationStatus)
              notificationStatus.textContent = copy(
                shown ? 'notificationSent' : 'notificationDenied',
              );
          })
          .catch((error: unknown) => reportError(error, 'notifications/test')),
    );
  }
  bindDataPortability(user, copy);
  document.querySelector('#delete-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const expected = options.locale === 'pt' ? 'EXCLUIR' : 'DELETE';
    if (formText(data, 'phrase').trim().toUpperCase() !== expected) return;
    form.querySelectorAll('button,input').forEach((element) => {
      (element as HTMLButtonElement | HTMLInputElement).disabled = true;
    });
    const status = document.querySelector('#delete-status');
    if (status) status.textContent = copy('deleting');
    void deleteOwnAccount(user, {
      password: formText(data, 'password'),
      onStage: (stage) => {
        if (status) status.textContent = `${copy('deleting')} ${stage}`;
      },
    })
      .then(clearLocalData)
      .catch((error: unknown) => {
        reportError(error, 'account/delete');
        if (status) status.textContent = copy('deleteFailed');
        form.querySelectorAll('button,input').forEach((element) => {
          (element as HTMLButtonElement | HTMLInputElement).disabled = false;
        });
      });
  });
}
