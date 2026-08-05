import type { User } from 'firebase/auth';
import type { Locale, MessageKey } from '../../core/i18n';
import type { UnitSystem } from '../../core/units';
import { reportError } from '../../core/errors';
import { deleteOwnAccount } from '../account/delete-account';
import { bindDataPortability } from '../backup/ui';
import {
  notificationsSupported,
  requestNotificationAccess,
  showLocalNotification,
} from '../notifications';
import { clearLocalData, queueList } from '../../services/database';
import {
  listSyncConflicts,
  loadUserData,
  resolveSyncConflict,
  saveUserData,
  flushUserDataQueue,
} from '../../services/user-data';
import { formatBytes, requestPersistentStorage, storageHealth } from '../offline/storage';
import { resetFeatureGroup, type ResetGroup } from './reset';
import { loadEntitlements } from '../subscriptions';
import { flushPhotoUploads, photoQueueCount } from '../photos/offline';

interface SettingsViewOptions {
  copy: (key: MessageKey) => string;
  locale: Locale;
  shell: (content: string) => void;
  onBack: () => void;
  onRestNotificationsChange: (enabled: boolean) => void;
  unitSystem: UnitSystem;
  onUnitSystemChange: (units: UnitSystem) => void;
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
    `<section class="feature-view"><button id="feature-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">04 · ACCOUNT</p><h1>${copy('settings')}</h1><article class="notification-card"><h2>${copy('notifications')}</h2><p id="notification-body"></p><div><button id="notification-toggle"></button><button id="notification-test">${copy('testNotification')}</button></div><p id="notification-status" role="status"></p></article><article class="backup-card"><h2>${copy('yourData')}</h2><p>${copy('backupBody')}</p><div><button id="export-data">${copy('exportData')}</button><label class="import-button">${copy('importData')}<input id="import-data" type="file" accept="application/json,.json"></label><button id="export-data-zip">${copy('exportZip')}</button><label class="import-button">${copy('importZip')}<input id="import-data-zip" type="file" accept="application/zip,.zip"></label></div><p id="backup-status" role="status"></p></article><article class="danger-zone"><h2>${copy('deleteAccount')}</h2><p>${copy('deleteWarning')}</p><form id="delete-form"><label>${copy('confirmation')}<input name="phrase" autocomplete="off" required></label>${passwordProvider ? `<label>${copy('password')}<input name="password" type="password" autocomplete="current-password" required></label>` : ''}<button class="danger-button">${copy('deleteAccount')}</button></form><p id="delete-status" role="status"></p></article></section>`,
  );
  document.querySelector('#feature-back')?.addEventListener('click', onBack);
  const storageCard = document.createElement('article');
  storageCard.className = 'storage-card';
  const storageTitle = document.createElement('h2');
  storageTitle.textContent = copy('offlineStorage');
  const storageStatus = document.createElement('p');
  storageStatus.textContent = copy('checkingStorage');
  const persistButton = document.createElement('button');
  persistButton.textContent = copy('protectStorage');
  storageCard.append(storageTitle, storageStatus, persistButton);
  document.querySelector('.backup-card')?.before(storageCard);
  const syncCard = document.createElement('article');
  syncCard.className = 'sync-card';
  const syncTitle = document.createElement('h2');
  syncTitle.textContent = copy('syncDetails');
  const syncStatus = document.createElement('p');
  syncStatus.textContent = copy('checkingSync');
  const syncList = document.createElement('div');
  syncList.className = 'sync-list';
  const retrySync = document.createElement('button');
  retrySync.textContent = copy('retrySync');
  retrySync.disabled = !navigator.onLine;
  retrySync.addEventListener('click', () => {
    retrySync.disabled = true;
    retrySync.textContent = copy('syncing');
    void Promise.all([flushUserDataQueue(user), flushPhotoUploads(user)])
      .then(() => renderSettingsView(user, options))
      .catch((error: unknown) => {
        retrySync.disabled = !navigator.onLine;
        retrySync.textContent = copy('retrySync');
        syncStatus.textContent = copy('syncUnavailable');
        console.warn('[sync/retry]', error);
      });
  });
  syncCard.append(syncTitle, syncStatus, retrySync, syncList);
  storageCard.after(syncCard);
  void Promise.all([queueList(), photoQueueCount(user), listSyncConflicts(user)])
    .then(([queued, photos, conflicts]) => {
      const userQueue = queued.filter((item) => item.id.startsWith(`${user.uid}-`));
      syncStatus.textContent = `${userQueue.length + photos} ${copy('pendingItems')} · ${conflicts.length} ${copy('conflicts')}`;
      userQueue.forEach((item) => {
        const row = document.createElement('article');
        const label = document.createElement('strong');
        label.textContent = item.path;
        const detail = document.createElement('small');
        detail.textContent = `${copy('attempts')}: ${item.attempts} · ${copy('nextAttempt')}: ${new Date(item.nextAttemptAt).toLocaleString(options.locale)}`;
        row.append(label, detail);
        syncList.append(row);
      });
      if (photos) {
        const row = document.createElement('article');
        row.textContent = `${photos} ${copy('photosPending')}`;
        syncList.append(row);
      }
      conflicts.forEach((conflict) => {
        const row = document.createElement('article');
        row.className = 'sync-conflict';
        const label = document.createElement('strong');
        label.textContent = `${copy('conflictDetected')}: ${conflict.key}`;
        const detail = document.createElement('small');
        detail.textContent = `${copy('localVersion')}: ${new Date(conflict.localUpdatedAt).toLocaleString(options.locale)} · ${copy('cloudVersion')}: ${new Date(conflict.remoteUpdatedAt).toLocaleString(options.locale)}`;
        const actions = document.createElement('div');
        const keepLocal = document.createElement('button');
        keepLocal.textContent = copy('keepLocal');
        keepLocal.disabled = !navigator.onLine;
        const useCloud = document.createElement('button');
        useCloud.textContent = copy('useCloud');
        const resolve = (choice: 'local' | 'remote') => {
          keepLocal.disabled = true;
          useCloud.disabled = true;
          void resolveSyncConflict(user, conflict, choice)
            .then(() => renderSettingsView(user, options))
            .catch((error: unknown) => {
              keepLocal.disabled = !navigator.onLine;
              useCloud.disabled = false;
              reportError(error, 'sync/resolve');
            });
        };
        keepLocal.addEventListener('click', () => resolve('local'));
        useCloud.addEventListener('click', () => resolve('remote'));
        actions.append(keepLocal, useCloud);
        row.append(label, detail, actions);
        syncList.append(row);
      });
      if (!userQueue.length && !photos && !conflicts.length)
        syncList.textContent = copy('syncClear');
    })
    .catch((error: unknown) => {
      syncStatus.textContent = copy('syncUnavailable');
      reportError(error, 'sync/status');
    });
  const unitsCard = document.createElement('article');
  unitsCard.className = 'units-card';
  const unitsTitle = document.createElement('h2');
  unitsTitle.textContent = copy('unitsLabel');
  const unitsChoice = document.createElement('div');
  (['metric', 'imperial'] as UnitSystem[]).forEach((value) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = copy(value);
    button.ariaPressed = String(value === options.unitSystem);
    button.addEventListener('click', () => {
      if (value === options.unitSystem) return;
      options.onUnitSystemChange(value);
      void renderSettingsView(user, options);
    });
    unitsChoice.append(button);
  });
  unitsCard.append(unitsTitle, unitsChoice);
  document.querySelector('.notification-card')?.after(unitsCard);
  const planCard = document.createElement('article');
  planCard.className = 'subscription-card';
  const planTitle = document.createElement('h2');
  planTitle.textContent = copy('yourPlan');
  const planStatus = document.createElement('p');
  planStatus.textContent = copy('checkingPlan');
  planCard.append(planTitle, planStatus);
  storageCard.before(planCard);
  void loadEntitlements()
    .then((entitlements) => {
      planStatus.textContent = `${entitlements.plan.toUpperCase()} · ${entitlements.status}`;
    })
    .catch(() => {
      planStatus.textContent = copy('planUnavailable');
    });
  void storageHealth()
    .then((health) => {
      storageStatus.textContent = health
        ? `${formatBytes(health.usage)} / ${formatBytes(health.quota)} · ${health.percent.toFixed(1)}% · ${copy(health.persistent ? 'storageProtected' : 'storageTemporary')}`
        : copy('storageUnavailable');
      persistButton.disabled = !health || health.persistent;
    })
    .catch((error: unknown) => reportError(error, 'storage/estimate'));
  persistButton.addEventListener(
    'click',
    () =>
      void requestPersistentStorage()
        .then(async () => {
          await renderSettingsView(user, options);
        })
        .catch((error: unknown) => reportError(error, 'storage/persist')),
  );
  const resetCard = document.createElement('article');
  resetCard.className = 'reset-card';
  const resetTitle = document.createElement('h2');
  resetTitle.textContent = copy('selectiveReset');
  const resetBody = document.createElement('p');
  resetBody.textContent = copy('selectiveResetBody');
  const resetActions = document.createElement('div');
  (['training', 'progress', 'nutrition'] as ResetGroup[]).forEach((group) => {
    const button = document.createElement('button');
    button.textContent = copy(`reset_${group}` as MessageKey);
    button.addEventListener('click', () => {
      if (!confirm(copy('resetConfirm'))) return;
      button.disabled = true;
      void resetFeatureGroup(user, group)
        .then(() => {
          button.textContent = copy('resetComplete');
        })
        .catch((error: unknown) => {
          button.disabled = false;
          reportError(error, 'settings/reset');
        });
    });
    resetActions.append(button);
  });
  resetCard.append(resetTitle, resetBody, resetActions);
  document.querySelector('.danger-zone')?.before(resetCard);
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
