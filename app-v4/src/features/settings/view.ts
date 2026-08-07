import type { User } from 'firebase/auth';
import type { Locale, MessageKey } from '../../core/i18n';
import {
  displayLength,
  lengthUnitLabel,
  parseLengthInput,
  type UnitSystem,
} from '../../core/units';
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
import { leaveCoachRelationship, myCoach, redeemInvite } from '../coach';
import { loadTheme, saveTheme, type Theme } from '../../core/theme';

interface SettingsViewOptions {
  copy: (key: MessageKey) => string;
  locale: Locale;
  shell: (content: string) => void;
  onBack: () => void;
  onRestNotificationsChange: (enabled: boolean) => void;
  unitSystem: UnitSystem;
  onUnitSystemChange: (units: UnitSystem) => void;
  onOpenLegal: () => void;
  showRirRpe: boolean;
  onShowRirRpeChange: (show: boolean) => void;
}
const formText = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
};

export async function renderSettingsView(user: User, options: SettingsViewOptions): Promise<void> {
  const { copy, shell, onBack } = options;
  const passwordProvider = user.providerData.some(({ providerId }) => providerId === 'password');
  const settings = await loadUserData(user, 'notificationSettings').then(
    (value) => value ?? { restEnabled: false, mealTime: '', supplementTime: '', workoutTime: '' },
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
      options.unitSystem = value;
      void renderSettingsView(user, options);
    });
    unitsChoice.append(button);
  });
  unitsCard.append(unitsTitle, unitsChoice);
  document.querySelector('.notification-card')?.after(unitsCard);
  const themeCard = document.createElement('article');
  themeCard.className = 'units-card';
  const themeTitle = document.createElement('h2');
  themeTitle.textContent = copy('themeLabel');
  const themeChoice = document.createElement('div');
  (['dark', 'light'] as Theme[]).forEach((value) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = copy(value === 'dark' ? 'themeDark' : 'themeLight');
    button.ariaPressed = String(value === loadTheme());
    button.addEventListener('click', () => {
      if (value === loadTheme()) return;
      saveTheme(value);
      void renderSettingsView(user, options);
    });
    themeChoice.append(button);
  });
  themeCard.append(themeTitle, themeChoice);
  unitsCard.after(themeCard);
  const profileCard = document.createElement('article');
  profileCard.className = 'profile-card';
  const profileTitle = document.createElement('h2');
  profileTitle.textContent = copy('profileTitle');
  const profileForm = document.createElement('form');
  const ageLabel = document.createElement('label');
  const ageSpan = document.createElement('span');
  ageSpan.textContent = copy('age');
  const ageInput = document.createElement('input');
  ageInput.type = 'number';
  ageInput.min = '10';
  ageInput.max = '120';
  ageLabel.append(ageSpan, ageInput);
  const sexLabel = document.createElement('label');
  const sexSpan = document.createElement('span');
  sexSpan.textContent = copy('sex');
  const sexSelect = document.createElement('select');
  (['M', 'F'] as const).forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = copy(value === 'M' ? 'male' : 'female');
    sexSelect.append(option);
  });
  sexLabel.append(sexSpan, sexSelect);
  const heightLabel = document.createElement('label');
  const heightSpan = document.createElement('span');
  heightSpan.textContent = `${copy('height')} (${lengthUnitLabel(options.unitSystem)})`;
  const heightInput = document.createElement('input');
  heightInput.type = 'number';
  heightInput.step = '0.1';
  heightLabel.append(heightSpan, heightInput);
  const goalLabel = document.createElement('label');
  const goalSpan = document.createElement('span');
  goalSpan.textContent = copy('goal');
  const goalSelect = document.createElement('select');
  (['general', 'hypertrophy', 'fatLoss', 'strength', 'endurance'] as const).forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = copy(`goal${value[0]?.toUpperCase()}${value.slice(1)}` as MessageKey);
    goalSelect.append(option);
  });
  goalLabel.append(goalSpan, goalSelect);
  const profileSave = document.createElement('button');
  profileSave.type = 'submit';
  profileSave.textContent = copy('save');
  const profileStatus = document.createElement('p');
  profileStatus.setAttribute('role', 'status');
  profileForm.append(ageLabel, sexLabel, heightLabel, goalLabel, profileSave);
  profileCard.append(profileTitle, profileForm, profileStatus);
  themeCard.after(profileCard);
  const advancedFieldsCard = document.createElement('article');
  advancedFieldsCard.className = 'units-card';
  const advancedFieldsTitle = document.createElement('h2');
  advancedFieldsTitle.textContent = copy('showRirRpeLabel');
  const advancedFieldsChoice = document.createElement('div');
  ([false, true] as const).forEach((value) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = copy(value ? 'showRirRpeOn' : 'showRirRpeOff');
    button.ariaPressed = String(value === options.showRirRpe);
    button.addEventListener('click', () => {
      if (value === options.showRirRpe) return;
      options.onShowRirRpeChange(value);
      options.showRirRpe = value;
      void renderSettingsView(user, options);
    });
    advancedFieldsChoice.append(button);
  });
  advancedFieldsCard.append(advancedFieldsTitle, advancedFieldsChoice);
  profileCard.after(advancedFieldsCard);
  const legalCard = document.createElement('article');
  legalCard.className = 'units-card';
  const legalTitle = document.createElement('h2');
  legalTitle.textContent = copy('legalTitle');
  const legalButton = document.createElement('button');
  legalButton.type = 'button';
  legalButton.textContent = copy('legalTitle');
  legalButton.addEventListener('click', () => options.onOpenLegal());
  legalCard.append(legalTitle, legalButton);
  profileCard.after(legalCard);
  void loadUserData(user, 'profile').then((profile) => {
    ageInput.value = profile?.age ? String(profile.age) : '';
    sexSelect.value = profile?.sex ?? 'M';
    heightInput.value = profile?.height
      ? String(displayLength(profile.height, options.unitSystem))
      : '';
    goalSelect.value = profile?.goal ?? 'general';
  });
  profileForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const heightValue = heightInput.value ? Number(heightInput.value) : null;
    void saveUserData(user, 'profile', {
      age: ageInput.value ? Number(ageInput.value) : null,
      sex: sexSelect.value as 'M' | 'F',
      height: heightValue === null ? null : parseLengthInput(heightValue, options.unitSystem),
      goal: goalSelect.value as 'general' | 'hypertrophy' | 'fatLoss' | 'strength' | 'endurance',
    })
      .then(() => {
        profileStatus.textContent = copy('profileSaved');
      })
      .catch((error: unknown) => reportError(error, 'settings/profile'));
  });
  const coachCard = document.createElement('article');
  coachCard.className = 'coach-link-card';
  const coachTitle = document.createElement('h2');
  coachTitle.textContent = copy('redeemCoachCode');
  const coachStatus = document.createElement('p');
  coachStatus.setAttribute('role', 'status');
  coachCard.append(coachTitle, coachStatus);
  void myCoach(user.uid)
    .then((link) => {
      if (link) {
        coachStatus.textContent = `${copy('linkedToCoach')}: ${link.coachEmail || link.coachUid}`;
        const unlink = document.createElement('button');
        unlink.type = 'button';
        unlink.className = 'secondary';
        unlink.textContent = copy('unlinkCoach');
        unlink.addEventListener('click', () => {
          unlink.disabled = true;
          void leaveCoachRelationship()
            .then(() => renderSettingsView(user, options))
            .catch((error: unknown) => {
              unlink.disabled = false;
              reportError(error, 'coach/leave');
            });
        });
        coachCard.append(unlink);
        return;
      }
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 6;
      input.placeholder = copy('coachCodePlaceholder');
      input.autocomplete = 'off';
      const submit = document.createElement('button');
      submit.type = 'submit';
      submit.className = 'primary';
      submit.textContent = copy('linkToCoach');
      form.append(input, submit);
      coachCard.append(form);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!input.value.trim()) return;
        submit.disabled = true;
        void redeemInvite(input.value.trim())
          .then(() => renderSettingsView(user, options))
          .catch((error: unknown) => {
            submit.disabled = false;
            coachStatus.textContent = copy('coachLinkError');
            reportError(error, 'coach/redeem');
          });
      });
    })
    .catch((error: unknown) => reportError(error, 'coach/status'));
  unitsCard.after(coachCard);
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
          await saveUserData(user, 'notificationSettings', { ...settings, restEnabled: enabled });
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
  const remindersCard = document.createElement('article');
  remindersCard.className = 'units-card';
  const remindersTitle = document.createElement('h2');
  remindersTitle.textContent = copy('remindersLabel');
  const remindersHint = document.createElement('p');
  remindersHint.className = 'hint';
  remindersHint.textContent = copy('remindersHint');
  const reminderField = (labelKey: MessageKey, value: string) => {
    const label = document.createElement('label');
    const span = document.createElement('span');
    span.textContent = copy(labelKey);
    const input = document.createElement('input');
    input.type = 'time';
    input.value = value;
    label.append(span, input);
    return { label, input };
  };
  const meal = reminderField('reminderMealLabel', settings.mealTime);
  const supplement = reminderField('reminderSupplementLabel', settings.supplementTime);
  const workout = reminderField('reminderWorkoutLabel', settings.workoutTime);
  const saveRemindersButton = document.createElement('button');
  saveRemindersButton.type = 'button';
  saveRemindersButton.textContent = copy('saveReminders');
  const remindersStatus = document.createElement('p');
  remindersStatus.setAttribute('role', 'status');
  saveRemindersButton.addEventListener('click', () => {
    void (async () => {
      const hasAnyTime = meal.input.value || supplement.input.value || workout.input.value;
      if (hasAnyTime && (await requestNotificationAccess()) !== 'granted') {
        remindersStatus.textContent = copy('notificationDenied');
        return;
      }
      await saveUserData(user, 'notificationSettings', {
        ...settings,
        mealTime: meal.input.value,
        supplementTime: supplement.input.value,
        workoutTime: workout.input.value,
      });
      remindersStatus.textContent = copy('remindersSaved');
    })().catch((error: unknown) => reportError(error, 'notifications/reminders'));
  });
  remindersCard.append(
    remindersTitle,
    remindersHint,
    meal.label,
    supplement.label,
    workout.label,
    saveRemindersButton,
    remindersStatus,
  );
  document.querySelector('.notification-card')?.after(remindersCard);
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
