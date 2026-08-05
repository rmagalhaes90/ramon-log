import './styles.css';
import type { User } from 'firebase/auth';
import { installGlobalErrorHandlers, onError, reportError } from './core/errors';
import { createI18n, type Locale, type MessageKey } from './core/i18n';
import type {
  Exercise,
  FavoriteMeal,
  NutritionDay,
  ProgressionDecision,
  Workouts,
} from './domain/schemas';
import {
  authErrorKey,
  completeEmailAction,
  completePasswordReset,
  createAccount,
  loginWithGoogle,
  loginWithPassword,
  logout,
  observeAuth,
  parseEmailAction,
  refreshVerification,
  requestPasswordReset,
  resendVerification,
  verifyEmailActionCode,
  verifyResetActionCode,
  type AuthState,
} from './features/auth';
import { listSharedUsers, setUserAdmin, setUserBlocked } from './features/admin';
import { exerciseCatalog, searchExercises, supplementCatalog } from './features/catalog';
import { dosesTakenToday, normalizeTimes } from './features/supplements/model';
import { flushPhotoUploads, photoQueueCount } from './features/photos/offline';
import { renderPhotosView } from './features/photos/view';
import { shareOrFallback } from './features/share';
import {
  progressionRecommendation,
  type PerformanceEntry,
} from './features/intelligence/progression';
import {
  bestCompletedSet,
  calculatePlates,
  completedExerciseCount,
  createEntries,
  dateKey,
  dayKeys,
  todayDayKey,
  workoutVolume,
  type DayKey,
  type ExerciseEntry,
} from './features/workouts/model';
import {
  createTemplate,
  moveExercise,
  reorderExercise,
  type TemplateKey,
} from './features/workouts/templates';
import { rankExerciseAlternatives } from './features/workouts/substitutions';
import { clearWorkoutDraft, loadWorkoutDraft, saveWorkoutDraft } from './features/workouts/draft';
import { trainingStreak, unlockedAchievements, weeklyReport } from './features/reports/model';
import { renderSettingsView } from './features/settings/view';
import {
  addMealToDay,
  copyMeal,
  emptyNutritionDay,
  mergeNutritionDays,
  percentage,
} from './features/nutrition/model';
import { lookupBarcode } from './features/nutrition/barcode';
import { barcodeCameraSupported, startBarcodeCamera } from './features/nutrition/camera';
import { readinessClass, readinessScore, weightDelta } from './features/progress/model';
import { chartPoints } from './features/progress/chart';
import {
  measurementSeries,
  muscleVolume,
  readinessPerformanceCorrelation,
  seriesDelta,
  type MeasurementKey,
} from './features/progress/analytics';
import { showLocalNotification } from './features/notifications';
import { cacheGet, cacheSet, queueList } from './services/database';
import { activateUpdate, registerPwaUpdates } from './services/pwa-update';
import { flushUserDataQueue, loadUserData, saveUserData } from './services/user-data';

installGlobalErrorHandlers();
const i18n = createI18n();
i18n.setLocale(i18n.locale);
const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing #app root');
const appRoot = root;
const emailAction = parseEmailAction(location.search);

let authState: AuthState = { status: 'loading', user: null, isAdmin: false };
let authMode: 'login' | 'signup' = 'login';
let updateRegistration: ServiceWorkerRegistration | null = null;
let currentView:
  | 'dashboard'
  | 'workout'
  | 'progress'
  | 'photos'
  | 'nutrition'
  | 'supplements'
  | 'settings'
  | 'admin' = 'dashboard';
let selectedDay: DayKey = todayDayKey();
let workoutEntries: ExerciseEntry[] = [];
let workoutStartedAt = new Date().toISOString();
let sessionClock: number | undefined;
let restClock: number | undefined;
let notificationUid = '';
let restNotificationsEnabled = false;
let activeCameraStop: (() => void) | undefined;
let workoutPausedAt: number | null = null;
let workoutPausedMs = 0;

function resetWorkoutClock(): void {
  workoutPausedAt = null;
  workoutPausedMs = 0;
}

function sessionElapsedMs(now = Date.now()): number {
  const pausedNow = workoutPausedAt !== null ? now - workoutPausedAt : 0;
  return now - new Date(workoutStartedAt).getTime() - workoutPausedMs - pausedNow;
}

function clearWorkoutTimers(): void {
  if (sessionClock) window.clearInterval(sessionClock);
  if (restClock) window.clearInterval(restClock);
  sessionClock = undefined;
  restClock = undefined;
}

function copy(key: MessageKey): string {
  return i18n.t(key);
}
function formText(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
}

function shell(content: string): void {
  activeCameraStop?.();
  activeCameraStop = undefined;
  appRoot.innerHTML = `<header class="topbar"><a class="brand" href="./" aria-label="KYRO">KYRO<span>.</span></a>
    <div class="locale" role="group" aria-label="Language"><button data-locale="pt">PT</button><button data-locale="en">EN</button></div></header>
    <main>${content}</main><aside id="error" class="toast error" role="alert" hidden></aside>
    <aside id="update" class="toast" role="status" hidden><span>${copy('update')}</span><button id="update-now">${copy('updateNow')}</button></aside>`;
  bindChrome();
}

function bindChrome(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach((button) => {
    button.ariaPressed = String(button.dataset.locale === i18n.locale);
    button.addEventListener('click', () => {
      i18n.setLocale(button.dataset.locale as Locale);
      render();
    });
  });
  document.querySelector('#update-now')?.addEventListener('click', () => {
    if (updateRegistration) activateUpdate(updateRegistration);
  });
  if (updateRegistration) document.querySelector<HTMLElement>('#update')?.removeAttribute('hidden');
}

function setFormError(message: string): void {
  const error = document.querySelector<HTMLElement>('#auth-error');
  if (error) {
    error.textContent = message;
    error.hidden = !message;
  }
}

function setBusy(busy: boolean): void {
  document.querySelectorAll<HTMLButtonElement>('.auth-card button').forEach((button) => {
    button.disabled = busy;
  });
  const card = document.querySelector<HTMLElement>('.auth-card');
  if (card) card.ariaBusy = String(busy);
}

function renderEmailActionMessage(title: string, body: string, successful = false): void {
  shell(`<section class="auth-card verify" aria-labelledby="email-action-title">
    <p class="eyebrow">KYRO · SECURITY</p><h1 id="email-action-title"></h1>
    <p id="email-action-body"></p><a class="primary action-link" href="./">${copy('emailActionBack')}</a>
  </section>`);
  const heading = document.querySelector('#email-action-title');
  const message = document.querySelector('#email-action-body');
  if (heading) heading.textContent = title;
  if (message) message.textContent = body;
  document.querySelector('.auth-card')?.classList.toggle('action-success', successful);
}

async function renderEmailAction(): Promise<void> {
  if (!emailAction) return;
  if (emailAction.mode === 'resetPassword') {
    try {
      const email = await verifyResetActionCode(emailAction.code);
      shell(`<section class="auth-card verify" aria-labelledby="email-action-title">
        <p class="eyebrow">KYRO · SECURITY</p><h1 id="email-action-title">${copy('resetActionTitle')}</h1>
        <p>${copy('resetActionBody')}</p><strong class="email-address"></strong>
        <p id="auth-error" class="form-error" role="alert" hidden></p>
        <form id="reset-action-form"><label>${copy('newPassword')}<input id="new-password" type="password" maxlength="128" autocomplete="new-password" required></label>
        <p class="hint">${copy('passwordHint')}</p><button class="primary" type="submit">${copy('savePassword')}</button></form>
      </section>`);
      const address = document.querySelector('.email-address');
      if (address) address.textContent = email;
      document.querySelector('#reset-action-form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const password = document.querySelector<HTMLInputElement>('#new-password')?.value ?? '';
        setBusy(true);
        void completePasswordReset(emailAction.code, password)
          .then(() =>
            renderEmailActionMessage(
              copy('resetActionCompleteTitle'),
              copy('resetActionCompleteBody'),
              true,
            ),
          )
          .catch((error: unknown) => setFormError(copy(authErrorKey(error))))
          .finally(() => setBusy(false));
      });
    } catch {
      renderEmailActionMessage(copy('emailActionInvalidTitle'), copy('emailActionInvalidBody'));
    }
    return;
  }
  try {
    await verifyEmailActionCode(emailAction.code);
    await completeEmailAction(emailAction.code);
    renderEmailActionMessage(
      emailAction.mode === 'verifyEmail'
        ? copy('verifyActionCompleteTitle')
        : copy('recoverActionCompleteTitle'),
      emailAction.mode === 'verifyEmail'
        ? copy('verifyActionCompleteBody')
        : copy('recoverActionCompleteBody'),
      true,
    );
  } catch {
    renderEmailActionMessage(copy('emailActionInvalidTitle'), copy('emailActionInvalidBody'));
  }
}

function renderAuth(): void {
  shell(`<section class="auth-card" aria-labelledby="auth-title"><p class="eyebrow">${copy('foundation')}</p>
    <h1 id="auth-title">${authMode === 'login' ? copy('login') : copy('signup')}</h1>
    <div class="auth-tabs"><button data-mode="login" aria-pressed="${authMode === 'login'}">${copy('login')}</button><button data-mode="signup" aria-pressed="${authMode === 'signup'}">${copy('signup')}</button></div>
    <p id="auth-error" class="form-error" role="alert" hidden></p>
    <form id="auth-form"><label>${copy('email')}<input id="auth-email" type="email" maxlength="254" autocomplete="email" required></label>
      <label>${copy('password')}<input id="auth-password" type="password" maxlength="128" autocomplete="${authMode === 'login' ? 'current-password' : 'new-password'}" required></label>
      ${authMode === 'signup' ? `<p class="hint">${copy('passwordHint')}</p>` : ''}
      <button class="primary" type="submit">${authMode === 'login' ? copy('login') : copy('signup')}</button></form>
    ${authMode === 'login' ? `<button class="link-button" id="forgot">${copy('forgot')}</button>` : ''}
    <div class="divider"><span>or</span></div><button id="google" class="secondary">${copy('google')}</button>
    <a class="baseline-link" href="../index.html">${copy('baseline')}</a></section>`);
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) =>
    button.addEventListener('click', () => {
      authMode = button.dataset.mode as 'login' | 'signup';
      renderAuth();
    }),
  );
  document
    .querySelector('#auth-form')
    ?.addEventListener('submit', (event) => void submitAuth(event));
  document.querySelector('#google')?.addEventListener('click', () => void runAuth(loginWithGoogle));
  document.querySelector('#forgot')?.addEventListener('click', () => void resetPassword());
}

async function runAuth(action: () => Promise<void>): Promise<void> {
  setFormError('');
  setBusy(true);
  try {
    await action();
  } catch (error: unknown) {
    setFormError(copy(authErrorKey(error)));
  } finally {
    setBusy(false);
  }
}

async function submitAuth(event: Event): Promise<void> {
  event.preventDefault();
  const email = document.querySelector<HTMLInputElement>('#auth-email')?.value ?? '';
  const password = document.querySelector<HTMLInputElement>('#auth-password')?.value ?? '';
  await runAuth(() =>
    authMode === 'login' ? loginWithPassword(email, password) : createAccount(email, password),
  );
}

async function resetPassword(): Promise<void> {
  const email = document.querySelector<HTMLInputElement>('#auth-email')?.value ?? '';
  if (!email) {
    document.querySelector<HTMLInputElement>('#auth-email')?.focus();
    return;
  }
  await runAuth(() => requestPasswordReset(email));
  setFormError(copy('resetSent'));
}

function renderVerification(user: User): void {
  shell(`<section class="auth-card verify" aria-labelledby="verify-title"><p class="eyebrow">EMAIL</p><h1 id="verify-title">${copy('verifyTitle')}</h1>
    <p>${copy('verifyBody')}</p><strong class="email-address"></strong><p id="auth-error" class="form-error" role="status" hidden></p>
    <button class="primary" id="verify-check">${copy('verifyCheck')}</button><button class="secondary" id="verify-again">${copy('verifyAgain')}</button>
    <button class="link-button" id="verify-logout">${copy('useAnother')}</button></section>`);
  const address = document.querySelector('.email-address');
  if (address) address.textContent = user.email ?? '';
  document.querySelector('#verify-check')?.addEventListener(
    'click',
    () =>
      void runVerification(async () => {
        if (await refreshVerification(user)) location.reload();
        else setFormError(copy('verifyPending'));
      }),
  );
  document.querySelector('#verify-again')?.addEventListener(
    'click',
    () =>
      void runVerification(async () => {
        await resendVerification(user);
        setFormError(copy('verifySent'));
      }),
  );
  document
    .querySelector('#verify-logout')
    ?.addEventListener(
      'click',
      () => void logout().catch((error: unknown) => reportError(error, 'auth/logout')),
    );
}

async function runVerification(action: () => Promise<void>): Promise<void> {
  setBusy(true);
  try {
    await action();
  } catch (error: unknown) {
    setFormError(copy(authErrorKey(error)));
  } finally {
    setBusy(false);
  }
}

async function needsOnboarding(user: User): Promise<boolean> {
  return (await cacheGet<boolean>(`onboarding:${user.uid}`)) !== true;
}

function renderOnboarding(user: User): void {
  shell(`<section class="auth-card onboarding" aria-labelledby="onboarding-title"><p class="eyebrow">01 · SETUP</p><h1 id="onboarding-title">${copy('welcome')}</h1>
    <p>${copy('onboardingBody')}</p><form id="onboarding-form"><label class="choice"><input type="radio" name="units" value="metric" checked> ${copy('metric')}</label>
    <label class="choice"><input type="radio" name="units" value="imperial"> ${copy('imperial')}</label><button class="primary" type="submit">${copy('continue')}</button></form></section>`);
  document.querySelector('#onboarding-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const units = new FormData(event.currentTarget as HTMLFormElement).get('units');
    void Promise.all([
      cacheSet(`units:${user.uid}`, units),
      cacheSet(`onboarding:${user.uid}`, true),
    ])
      .then(() => renderTour(user))
      .catch((error: unknown) => reportError(error, 'onboarding/save'));
  });
}

async function needsTour(user: User): Promise<boolean> {
  return (await cacheGet<boolean>(`tour:${user.uid}`)) !== true;
}

function renderTour(user: User): void {
  const steps: { eyebrow: string; title: string; body: string }[] = [
    { eyebrow: 'KYRO', title: copy('welcome'), body: copy('tourIntro') },
    { eyebrow: '01 · TRAIN', title: copy('train'), body: copy('trainModule') },
    { eyebrow: '02 · RECOVER', title: copy('progress'), body: copy('recoverModule') },
    { eyebrow: '03 · FUEL', title: copy('nutrition'), body: copy('fuelModule') },
    { eyebrow: '04 · SYNC', title: copy('settings'), body: copy('syncModule') },
  ];
  let stepIndex = 0;
  const finishTour = () =>
    void cacheSet(`tour:${user.uid}`, true)
      .then(() => renderDashboard(user))
      .catch((error: unknown) => reportError(error, 'tour/save'));
  const renderStep = () => {
    const step = steps[stepIndex];
    if (!step) return;
    const isLast = stepIndex === steps.length - 1;
    shell(`<section class="auth-card tour" aria-labelledby="tour-title"><p class="eyebrow">${step.eyebrow}</p><h1 id="tour-title">${step.title}</h1>
      <p>${step.body}</p><p class="tour-progress">${stepIndex + 1} / ${steps.length}</p>
      <div class="tour-actions">${stepIndex > 0 ? `<button id="tour-back" class="secondary">${copy('tourBack')}</button>` : ''}<button id="tour-next" class="primary">${isLast ? copy('tourFinish') : copy('tourNext')}</button></div>
      <button id="tour-skip" class="link-button">${copy('tourSkip')}</button></section>`);
    document.querySelector('#tour-back')?.addEventListener('click', () => {
      stepIndex = Math.max(0, stepIndex - 1);
      renderStep();
    });
    document.querySelector('#tour-next')?.addEventListener('click', () => {
      if (isLast) finishTour();
      else {
        stepIndex += 1;
        renderStep();
      }
    });
    document.querySelector('#tour-skip')?.addEventListener('click', finishTour);
  };
  renderStep();
}

async function renderReady(user: User): Promise<void> {
  if (await needsOnboarding(user)) {
    renderOnboarding(user);
    return;
  }
  if (await needsTour(user)) {
    renderTour(user);
    return;
  }
  if (notificationUid !== user.uid) {
    const settings = await loadUserData(user, 'notificationSettings');
    restNotificationsEnabled = settings?.restEnabled ?? false;
    notificationUid = user.uid;
  }
  if (currentView === 'workout') await renderWorkout(user);
  else if (currentView === 'progress') await renderProgress(user);
  else if (currentView === 'photos') await renderPhotos(user);
  else if (currentView === 'nutrition') await renderNutrition(user);
  else if (currentView === 'supplements') await renderSupplements(user);
  else if (currentView === 'settings') await renderSettings(user);
  else if (currentView === 'admin') await renderAdmin(user);
  else renderDashboard(user);
}

function renderDashboard(user: User): void {
  shell(`<section class="hero"><p class="eyebrow">${copy('foundation')}</p><h1>${copy('tagline')}</h1>
    <div class="status"><span id="network">${copy(navigator.onLine ? 'online' : 'offline')}</span><span>·</span><button id="open-sync" class="status-link">${copy('queue')}: <b id="queue-count">0</b></button></div>
    <button id="start-workout" class="primary">${copy('train')}</button>${authState.isAdmin ? `<button id="open-admin" class="secondary">${copy('admin')}</button>` : ''}<button id="logout" class="link-button">${copy('logout')}</button></section>
    <section class="feature-grid" aria-label="KYRO modules"><article><span>01</span><h2>TRAIN</h2><p>${copy('trainModule')}</p><button id="open-workout-card">${copy('train')}</button></article>
    <article><span>02</span><h2>RECOVER</h2><p>${copy('recoverModule')}</p><button id="open-progress">${copy('progress')}</button></article><article><span>03</span><h2>FUEL</h2><p>${copy('fuelModule')}</p><button id="open-nutrition">${copy('nutrition')}</button></article>
    <article><span>04</span><h2>SYNC</h2><p>${copy('syncModule')}</p><button id="open-settings">${copy('settings')}</button></article></section>`);
  document
    .querySelector('#logout')
    ?.addEventListener(
      'click',
      () => void logout().catch((error: unknown) => reportError(error, 'auth/logout')),
    );
  const openWorkout = () => {
    currentView = 'workout';
    workoutStartedAt = new Date().toISOString();
    resetWorkoutClock();
    void renderWorkout(user);
  };
  document.querySelector('#start-workout')?.addEventListener('click', openWorkout);
  document.querySelector('#open-workout-card')?.addEventListener('click', openWorkout);
  document.querySelector('#open-progress')?.addEventListener('click', () => {
    currentView = 'progress';
    void renderProgress(user);
  });
  document.querySelector('#open-nutrition')?.addEventListener('click', () => {
    currentView = 'nutrition';
    void renderNutrition(user);
  });
  document.querySelector('#open-settings')?.addEventListener('click', () => {
    currentView = 'settings';
    void renderSettings(user);
  });
  document.querySelector('#open-sync')?.addEventListener('click', () => {
    currentView = 'settings';
    void renderSettings(user);
  });
  document.querySelector('#open-admin')?.addEventListener('click', () => {
    currentView = 'admin';
    void renderAdmin(user);
  });
  const refreshQueueCount = () =>
    Promise.all([queueList(), photoQueueCount(user)])
      .then(([items, photos]) => {
        const count = document.querySelector('#queue-count');
        const ownItems = items.filter((item) => item.id.startsWith(`${user.uid}-`));
        if (count) count.textContent = String(ownItems.length + photos);
      })
      .catch((error: unknown) => reportError(error, 'queue/render'));
  void Promise.all([flushUserDataQueue(user), flushPhotoUploads(user)])
    .then(refreshQueueCount)
    .catch(() => refreshQueueCount());
  void refreshQueueCount();
}

async function renderAdmin(user: User): Promise<void> {
  const users = await listSharedUsers();
  const superAdmin = user.email?.toLowerCase() === 'rmagalhaes90@gmail.com';
  shell(
    `<section class="feature-view"><button id="feature-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">ADMIN</p><h1>${copy('users')}</h1><div id="admin-users" class="history-list"></div></section>`,
  );
  bindBack(user);
  const list = document.querySelector('#admin-users');
  users.forEach((entry) => {
    const row = document.createElement('article');
    const identity = document.createElement('div');
    const email = document.createElement('strong');
    email.textContent = entry.email || entry.uid;
    const role = document.createElement('span');
    role.textContent = entry.isAdmin ? 'admin' : '';
    identity.append(email, role);
    const actions = document.createElement('div');
    const block = document.createElement('button');
    block.textContent = copy(entry.blocked ? 'unblock' : 'block');
    block.addEventListener(
      'click',
      () =>
        void setUserBlocked(entry.uid, !entry.blocked)
          .then(() => renderAdmin(user))
          .catch((error: unknown) => reportError(error, 'admin/block')),
    );
    actions.append(block);
    if (superAdmin && entry.uid !== user.uid) {
      const admin = document.createElement('button');
      admin.textContent = copy(entry.isAdmin ? 'revokeAdmin' : 'grantAdmin');
      admin.addEventListener(
        'click',
        () =>
          void setUserAdmin(entry.uid, !entry.isAdmin)
            .then(() => renderAdmin(user))
            .catch((error: unknown) => reportError(error, 'admin/role')),
      );
      actions.append(admin);
    }
    row.append(identity, actions);
    list?.append(row);
  });
}

async function renderSettings(user: User): Promise<void> {
  await renderSettingsView(user, {
    copy,
    locale: i18n.locale,
    shell,
    onBack: () => {
      currentView = 'dashboard';
      renderDashboard(user);
    },
    onRestNotificationsChange: (enabled) => {
      restNotificationsEnabled = enabled;
    },
  });
}

function bindBack(user: User): void {
  document.querySelector('#feature-back')?.addEventListener('click', () => {
    currentView = 'dashboard';
    renderDashboard(user);
  });
}

async function renderProgress(user: User): Promise<void> {
  const [weights, measurements, readiness, sessions, exerciseHistory] = await Promise.all([
    loadUserData(user, 'bodyWeights').then((value) => value ?? []),
    loadUserData(user, 'bodyMeasurements').then((value) => value ?? {}),
    loadUserData(user, 'readinessLog').then((value) => value ?? {}),
    loadUserData(user, 'sessionLog').then((value) => value ?? []),
    loadUserData(user, 'exerciseHistory').then((value) => value ?? {}),
  ]);
  const latest = [...weights].sort((a, b) => b.d.localeCompare(a.d))[0];
  const delta = weightDelta(weights);
  const todayReadiness = readiness[dateKey()];
  const report = weeklyReport(sessions);
  const streak = trainingStreak(sessions);
  const achievements = unlockedAchievements(
    sessions.length,
    sessions.reduce((sum, item) => sum + item.volume, 0),
    streak,
  );
  shell(`<section class="feature-view"><button id="feature-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">02 · RECOVER</p><h1>${copy('progress')}</h1>
    <div class="metric-grid"><article><span>${copy('weight')}</span><strong id="latest-weight">—</strong><small id="weight-delta"></small></article><article><span>${copy('readiness')}</span><strong id="readiness-score">—</strong><small id="readiness-class"></small></article><article><span>${copy('history')}</span><strong>${sessions.length}</strong></article></div>
    <div id="weight-chart" class="progress-chart" aria-label="${copy('weightChart')}"></div><form id="weight-form" class="compact-form"><label>${copy('weight')}<input id="weight-input" type="number" min="1" max="1000" step="0.1" required></label><button class="primary">${copy('add')}</button></form><section><h2>${copy('measurementTrends')}</h2><div id="measurement-charts" class="measurement-charts"></div></section>
    <form id="measurements-form" class="measurements-form"><label>${copy('waist')}<input name="waist" type="number" min="20" max="300" step="0.1"></label><label>${copy('chest')}<input name="chest" type="number" min="20" max="300" step="0.1"></label><label>${copy('arm')}<input name="arm" type="number" min="10" max="150" step="0.1"></label><label>${copy('hip')}<input name="hip" type="number" min="20" max="300" step="0.1"></label><label>${copy('thigh')}<input name="thigh" type="number" min="10" max="200" step="0.1"></label><button class="primary">${copy('saveMeasurements')}</button></form>
    <form id="readiness-form" class="readiness-form">${(['sleep', 'energy', 'soreness', 'stress'] as const).map((key) => `<label>${copy(key)}<input name="${key}" type="range" min="1" max="5" value="3"></label>`).join('')}<label>${copy('readinessOverride')}<select name="override"><option value="">${copy('automatic')}</option>${(['high', 'normal', 'reduce', 'light', 'rest'] as const).map((value) => `<option value="${value}">${copy(`readiness_${value}` as MessageKey)}</option>`).join('')}</select></label><label>${copy('overrideReason')}<input name="overrideReason" maxlength="300"></label><button class="primary">${copy('save')}</button></form>
    <section class="training-analytics"><h2>${copy('trainingAnalytics')}</h2><article><strong id="readiness-correlation">—</strong><span>${copy('readinessCorrelation')}</span><small id="correlation-samples"></small></article><div id="muscle-volume" class="muscle-volume"></div></section><section class="weekly-report"><h2>${copy('weeklyReport')}</h2><div><article><strong>${report.sessions}</strong><span>${copy('sessions')}</span></article><article><strong>${Math.round(report.volume)}</strong><span>${copy('volume')}</span></article><article><strong>${Math.round(report.minutes)}</strong><span>${copy('minutes')}</span></article><article><strong>${streak}</strong><span>${copy('streak')}</span></article></div><button id="share-report">${copy('shareReport')}</button></section><section><h2>${copy('achievements')}</h2><div id="achievement-list" class="achievement-list"></div></section><button id="open-photos" class="secondary">${copy('progressPhotos')}</button><div id="session-history" class="history-list"></div></section>`);
  const weightTarget = document.querySelector('#latest-weight');
  if (weightTarget) weightTarget.textContent = latest ? `${latest.kg.toFixed(1)} kg` : '—';
  const deltaTarget = document.querySelector('#weight-delta');
  if (deltaTarget)
    deltaTarget.textContent =
      delta === null ? '' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} kg`;
  const scoreTarget = document.querySelector('#readiness-score');
  if (scoreTarget) scoreTarget.textContent = todayReadiness ? String(todayReadiness.score) : '—';
  const classTarget = document.querySelector('#readiness-class');
  if (classTarget) classTarget.textContent = todayReadiness ? todayReadiness.classification : '';
  const history = document.querySelector('#session-history');
  sessions
    .slice(-20)
    .reverse()
    .forEach((session) => {
      const row = document.createElement('article');
      const title = document.createElement('strong');
      title.textContent = session.title;
      const meta = document.createElement('span');
      meta.textContent = `${session.date} · ${Math.round(session.volume)} kg·vol`;
      row.append(title, meta);
      history?.append(row);
    });
  const achievementList = document.querySelector('#achievement-list');
  document.querySelector('#share-report')?.addEventListener(
    'click',
    () =>
      void shareOrFallback({
        title: 'KYRO Weekly',
        text: `${copy('weeklyReport')}: ${report.sessions} ${copy('sessions')} · ${Math.round(report.volume)} kg · ${Math.round(report.minutes)} ${copy('minutes')} · ${streak} ${copy('streak')}`,
      }).catch((error: unknown) => {
        if ((error as Error).name !== 'AbortError') reportError(error, 'reports/share');
      }),
  );
  if (!achievements.length) {
    const empty = document.createElement('span');
    empty.textContent = copy('noAchievements');
    achievementList?.append(empty);
  }
  achievements.forEach((key) => {
    const badge = document.createElement('span');
    badge.textContent = copy(`achievement_${key}` as MessageKey);
    achievementList?.append(badge);
  });
  drawProgressChart(
    document.querySelector('#weight-chart'),
    weights.map((item) => ({ d: item.d, value: item.kg })),
  );
  const measurementCharts = document.querySelector('#measurement-charts');
  (['waist', 'chest', 'arm', 'hip', 'thigh'] as MeasurementKey[]).forEach((key) => {
    const series = measurementSeries(measurements, key);
    const card = document.createElement('article');
    const heading = document.createElement('h3');
    heading.textContent = copy(key);
    const delta = document.createElement('small');
    const change = seriesDelta(series);
    delta.textContent =
      change === null
        ? copy('insufficientTrend')
        : `${change >= 0 ? '+' : ''}${change.toFixed(1)} cm`;
    const chart = document.createElement('div');
    chart.className = 'progress-chart compact';
    chart.ariaLabel = `${copy(key)} · ${copy('measurementTrends')}`;
    card.append(heading, delta, chart);
    measurementCharts?.append(card);
    drawProgressChart(chart, series);
  });
  const correlation = readinessPerformanceCorrelation(readiness, sessions);
  const correlationTarget = document.querySelector('#readiness-correlation');
  if (correlationTarget)
    correlationTarget.textContent =
      correlation.correlation === null ? '—' : correlation.correlation.toFixed(2);
  const sampleTarget = document.querySelector('#correlation-samples');
  if (sampleTarget)
    sampleTarget.textContent = `${correlation.samples} ${copy('correlationSamples')}`;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 27);
  const muscles = muscleVolume(exerciseHistory, exerciseCatalog, dateKey(cutoff)).slice(0, 8);
  const muscleTarget = document.querySelector('#muscle-volume');
  const maximumMuscleVolume = muscles[0]?.volume ?? 0;
  muscles.forEach(({ muscle, volume }) => {
    const row = document.createElement('article');
    const label = document.createElement('span');
    label.textContent = muscle;
    const amount = document.createElement('strong');
    amount.textContent = Math.round(volume).toLocaleString(i18n.locale);
    const meter = document.createElement('progress');
    meter.max = maximumMuscleVolume || 1;
    meter.value = volume;
    meter.ariaLabel = `${muscle}: ${Math.round(volume)}`;
    row.append(label, amount, meter);
    muscleTarget?.append(row);
  });
  if (!muscles.length && muscleTarget) muscleTarget.textContent = copy('noMuscleData');
  bindBack(user);
  document.querySelector('#open-photos')?.addEventListener('click', () => {
    currentView = 'photos';
    void renderPhotos(user);
  });
  document.querySelector('#weight-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.querySelector<HTMLInputElement>('#weight-input');
    const kg = Number(input?.value);
    if (!Number.isFinite(kg) || kg <= 0 || kg > 1000) return;
    const next = [...weights.filter((item) => item.d !== dateKey()), { d: dateKey(), kg }].sort(
      (a, b) => a.d.localeCompare(b.d),
    );
    void saveUserData(user, 'bodyWeights', next)
      .then(() => renderProgress(user))
      .catch((error: unknown) => reportError(error, 'progress/weight'));
  });
  document.querySelector('#measurements-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const entry = Object.fromEntries(
      ['waist', 'chest', 'arm', 'hip', 'thigh'].flatMap((key) => {
        const value = Number(data.get(key));
        return Number.isFinite(value) && value > 0 ? [[key, value]] : [];
      }),
    );
    if (!Object.keys(entry).length) return;
    void saveUserData(user, 'bodyMeasurements', { ...measurements, [dateKey()]: entry })
      .then(() => renderProgress(user))
      .catch((error: unknown) => reportError(error, 'progress/measurements'));
  });
  document.querySelector('#readiness-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const values = ['sleep', 'energy', 'soreness', 'stress'].map((key) => Number(data.get(key)));
    const [sleep = 3, energy = 3, soreness = 3, stress = 3] = values;
    const score = readinessScore(sleep, energy, soreness, stress);
    const plannedClassification = readinessClass(score);
    const overrideValue = data.get('override');
    const override = typeof overrideValue === 'string' ? overrideValue : '';
    const classification = ['high', 'normal', 'reduce', 'light', 'rest'].includes(override)
      ? override
      : plannedClassification;
    const reasonValue = data.get('overrideReason');
    const overrideReason = (typeof reasonValue === 'string' ? reasonValue : '')
      .trim()
      .slice(0, 300);
    const next = {
      ...readiness,
      [dateKey()]: {
        sleep,
        energy,
        soreness,
        stress,
        score,
        classification,
        plannedClassification,
        overrideReason: classification === plannedClassification ? '' : overrideReason,
        recordedAt: new Date().toISOString(),
      },
    };
    void saveUserData(user, 'readinessLog', next)
      .then(() => renderProgress(user))
      .catch((error: unknown) => reportError(error, 'progress/readiness'));
  });
}

function drawProgressChart(
  container: Element | null,
  values: { d: string; value: number }[],
): void {
  if (!container) return;
  const points = chartPoints(values);
  if (!points.length) {
    container.textContent = copy('noChartData');
    return;
  }
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 600 180');
  svg.setAttribute('role', 'img');
  const line = document.createElementNS(ns, 'polyline');
  line.setAttribute('points', points.map(({ x, y }) => `${x},${y}`).join(' '));
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'currentColor');
  line.setAttribute('stroke-width', '5');
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(line);
  for (const point of points) {
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', String(point.x));
    circle.setAttribute('cy', String(point.y));
    circle.setAttribute('r', '6');
    const title = document.createElementNS(ns, 'title');
    title.textContent = `${point.d}: ${point.value}`;
    circle.append(title);
    svg.append(circle);
  }
  container.replaceChildren(svg);
}

async function renderPhotos(user: User): Promise<void> {
  await renderPhotosView(user, {
    copy,
    shell,
    onBack: () => {
      currentView = 'progress';
      void renderProgress(user);
    },
  });
}

async function renderNutrition(user: User): Promise<void> {
  const [log, favorites] = await Promise.all([
    loadUserData(user, 'nutritionLog').then((value) => value ?? {}),
    loadUserData(user, 'favoriteMeals').then((value) => value ?? []),
  ]);
  const today = dateKey();
  const previous = Object.keys(log)
    .sort()
    .map((key) => log[key])
    .filter((value): value is NutritionDay => Boolean(value))
    .at(-1);
  const day = log[today] ?? emptyNutritionDay(previous);
  shell(`<section class="feature-view"><button id="feature-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">03 · FUEL</p><h1>${copy('nutrition')}</h1>
    <div class="metric-grid nutrition-metrics"><article><span>${copy('calories')}</span><strong>${Math.round(day.kcal)}</strong><small>${Math.round(percentage(day.kcal, day.kcalGoal))}%</small></article><article><span>${copy('protein')}</span><strong>${Math.round(day.protein)}g</strong><small>${Math.round(percentage(day.protein, day.proteinGoal))}%</small></article><article><span>${copy('fiber')}</span><strong>${Math.round(day.fiber)}g</strong><small>${Math.round(percentage(day.fiber, day.fiberGoal))}%</small></article><article><span>${copy('water')}</span><strong>${day.water.toFixed(2)}L</strong><button id="add-water">+ 250ml</button></article></div><button id="open-supplements" class="secondary">${copy('supplements')}</button><form id="barcode-form" class="barcode-form"><label>${copy('barcode')}<input name="barcode" inputmode="numeric" pattern="[0-9]{8,14}" maxlength="14" required></label><button type="submit">${copy('lookup')}</button><button type="button" id="scan-barcode" ${barcodeCameraSupported() ? '' : 'disabled'}>${copy('scanBarcode')}</button><video id="barcode-video" hidden muted></video><span id="barcode-status" role="status"></span></form>
    <form id="meal-form" class="meal-form"><label>${copy('mealName')}<input name="name" maxlength="120" required></label><label>${copy('calories')}<input name="kcal" type="number" min="0" max="10000" required></label><label>${copy('protein')}<input name="protein" type="number" min="0" max="1000" step="0.1"></label><label>${copy('carbs')}<input name="carb" type="number" min="0" max="1000" step="0.1"></label><label>${copy('fat')}<input name="fat" type="number" min="0" max="1000" step="0.1"></label><label>${copy('fiber')}<input name="fiber" type="number" min="0" max="1000" step="0.1"></label><button class="primary">${copy('add')} ${copy('meal')}</button></form>
    <section class="nutrition-copy"><h2>${copy('copyMeals')}</h2><label>${copy('targetDate')}<input id="nutrition-target-date" type="date" value="${today}"></label><button id="duplicate-day">${copy('duplicateDay')}</button><p id="nutrition-copy-status" role="status"></p></section><section><h2>${copy('favoriteMeals')}</h2><div id="favorite-meals" class="history-list"></div></section><div id="meal-list" class="history-list"></div></section>`);
  bindBack(user);
  const list = document.querySelector('#meal-list');
  const favoriteList = document.querySelector('#favorite-meals');
  let currentLog = log;
  let logWrite = Promise.resolve();
  const targetDate = () =>
    document.querySelector<HTMLInputElement>('#nutrition-target-date')?.value || today;
  const saveLog = async (nextLog: typeof log) => {
    await saveUserData(user, 'nutritionLog', nextLog);
    currentLog = nextLog;
  };
  const updateLog = (update: (value: typeof log) => typeof log) => {
    logWrite = logWrite.then(async () => {
      const nextLog = update(currentLog);
      await saveLog(nextLog);
    });
    return logWrite;
  };
  const persistLog = (nextLog: typeof log) => saveLog(nextLog).then(() => renderNutrition(user));
  const persist = (next: NutritionDay) => persistLog({ ...currentLog, [today]: next });
  const saveFavorite = (meal: NutritionDay['meals'][number]) => {
    const duplicate = favorites.some(
      (favorite) =>
        favorite.name.toLocaleLowerCase() === meal.name.toLocaleLowerCase() &&
        favorite.kcal === meal.kcal &&
        favorite.prot === meal.prot &&
        favorite.carb === meal.carb &&
        favorite.fat === meal.fat &&
        favorite.fiber === meal.fiber,
    );
    if (duplicate) return Promise.resolve();
    const favorite: FavoriteMeal = {
      id: crypto.randomUUID().slice(0, 60),
      name: meal.name,
      kcal: meal.kcal,
      prot: meal.prot,
      carb: meal.carb,
      fat: meal.fat,
      fiber: meal.fiber,
      createdAt: new Date().toISOString(),
    };
    return saveUserData(user, 'favoriteMeals', [...favorites, favorite].slice(-100)).then(() =>
      renderNutrition(user),
    );
  };
  day.meals
    .slice()
    .reverse()
    .forEach((meal) => {
      const row = document.createElement('article');
      const name = document.createElement('strong');
      name.textContent = meal.name;
      const meta = document.createElement('span');
      meta.textContent = `${Math.round(meal.kcal)} kcal · P ${Math.round(meal.prot)}g · C ${Math.round(meal.carb)}g · F ${Math.round(meal.fat)}g · ${copy('fiber')} ${Math.round(meal.fiber)}g`;
      const actions = document.createElement('div');
      const favorite = document.createElement('button');
      favorite.type = 'button';
      favorite.textContent = copy('saveFavorite');
      favorite.addEventListener('click', () => {
        void saveFavorite(meal).catch((error: unknown) => reportError(error, 'nutrition/favorite'));
      });
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.textContent = copy('copyMeal');
      copyButton.addEventListener('click', () => {
        const target = targetDate();
        const copied = copyMeal(meal, crypto.randomUUID().slice(0, 60));
        void updateLog((latest) => ({
          ...latest,
          [target]: addMealToDay(latest[target] ?? emptyNutritionDay(day), copied),
        }))
          .then(() => {
            const status = document.querySelector('#nutrition-copy-status');
            if (status) status.textContent = `${copy('copyComplete')} ${target}`;
          })
          .catch((error: unknown) => reportError(error, 'nutrition/copy-meal'));
      });
      actions.append(favorite, copyButton);
      row.append(name, meta, actions);
      list?.append(row);
    });
  favorites.forEach((favorite) => {
    const row = document.createElement('article');
    const name = document.createElement('strong');
    name.textContent = favorite.name;
    const addFavorite = document.createElement('button');
    addFavorite.type = 'button';
    addFavorite.textContent = `${copy('add')} ${copy('meal')}`;
    addFavorite.addEventListener('click', () => {
      const meal = {
        id: crypto.randomUUID().slice(0, 60),
        name: favorite.name,
        kcal: favorite.kcal,
        prot: favorite.prot,
        carb: favorite.carb,
        fat: favorite.fat,
        fiber: favorite.fiber,
        t: new Date().toISOString(),
      };
      void persist(addMealToDay(day, meal)).catch((error: unknown) =>
        reportError(error, 'nutrition/use-favorite'),
      );
    });
    const removeFavorite = document.createElement('button');
    removeFavorite.type = 'button';
    removeFavorite.textContent = copy('remove');
    removeFavorite.addEventListener('click', () => {
      void saveUserData(
        user,
        'favoriteMeals',
        favorites.filter((item) => item.id !== favorite.id),
      )
        .then(() => renderNutrition(user))
        .catch((error: unknown) => reportError(error, 'nutrition/remove-favorite'));
    });
    row.append(name, addFavorite, removeFavorite);
    favoriteList?.append(row);
  });
  if (!favorites.length && favoriteList) favoriteList.textContent = copy('noFavoriteMeals');
  document
    .querySelector('#add-water')
    ?.addEventListener(
      'click',
      () =>
        void persist({ ...day, water: Math.min(50, day.water + 0.25) }).catch((error: unknown) =>
          reportError(error, 'nutrition/water'),
        ),
    );
  document.querySelector('#open-supplements')?.addEventListener('click', () => {
    currentView = 'supplements';
    void renderSupplements(user);
  });
  document.querySelector('#duplicate-day')?.addEventListener('click', () => {
    const target = targetDate();
    const status = document.querySelector('#nutrition-copy-status');
    if (target === today) {
      if (status) status.textContent = copy('chooseAnotherDate');
      return;
    }
    try {
      void updateLog((latest) => ({
        ...latest,
        [target]: mergeNutritionDays(latest[target] ?? emptyNutritionDay(day), day, () =>
          crypto.randomUUID().slice(0, 60),
        ),
      }))
        .then(() => {
          if (status) status.textContent = `${copy('copyComplete')} ${target}`;
        })
        .catch((error: unknown) => reportError(error, 'nutrition/duplicate-day'));
    } catch (error) {
      reportError(error, 'nutrition/duplicate-day');
    }
  });
  document.querySelector('#barcode-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const code = formText(new FormData(form), 'barcode');
    const status = document.querySelector('#barcode-status');
    if (!navigator.onLine) {
      if (status) status.textContent = copy('barcodeOffline');
      return;
    }
    if (status) status.textContent = copy('searching');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    void lookupBarcode(code, controller.signal)
      .then((food) => {
        if (!food) {
          if (status) status.textContent = copy('barcodeNotFound');
          return;
        }
        const mealForm = document.querySelector<HTMLFormElement>('#meal-form');
        const values: {
          name: string;
          kcal: number;
          protein: number;
          carb: number;
          fat: number;
          fiber: number;
        } = food;
        Object.entries(values).forEach(([key, value]) => {
          const input = mealForm?.elements.namedItem(key);
          if (input instanceof HTMLInputElement) input.value = String(value);
        });
        if (status) status.textContent = copy('barcodeReady');
        document.querySelector<HTMLInputElement>('#meal-form input[name="name"]')?.focus();
      })
      .catch((error: unknown) => {
        if ((error as Error).name === 'AbortError') {
          if (status) status.textContent = copy('barcodeTimeout');
          return;
        }
        reportError(error, 'nutrition/barcode');
        if (status)
          status.textContent = copy(
            (error as Error).message === 'barcodeInvalid' ? 'barcodeInvalid' : 'barcodeUnavailable',
          );
      })
      .finally(() => window.clearTimeout(timeout));
  });
  document.querySelector('#scan-barcode')?.addEventListener('click', () => {
    const video = document.querySelector<HTMLVideoElement>('#barcode-video');
    const form = document.querySelector<HTMLFormElement>('#barcode-form');
    const input = form?.elements.namedItem('barcode');
    const status = document.querySelector('#barcode-status');
    if (!video || !(input instanceof HTMLInputElement)) return;
    video.hidden = false;
    if (status) status.textContent = copy('cameraStarting');
    void startBarcodeCamera(video, (code) => {
      activeCameraStop = undefined;
      video.hidden = true;
      input.value = code;
      form?.requestSubmit();
    })
      .then((stop) => {
        activeCameraStop = stop;
      })
      .catch((error: unknown) => {
        video.hidden = true;
        reportError(error, 'nutrition/camera');
        if (status) status.textContent = copy('cameraDenied');
      });
  });
  document.querySelector('#meal-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const meal = {
      id: crypto.randomUUID().slice(0, 60),
      name: formText(data, 'name').slice(0, 120),
      kcal: Number(data.get('kcal')) || 0,
      prot: Number(data.get('protein')) || 0,
      carb: Number(data.get('carb')) || 0,
      fat: Number(data.get('fat')) || 0,
      fiber: Number(data.get('fiber')) || 0,
      t: new Date().toISOString(),
    };
    const next = addMealToDay(day, meal);
    void persist(next).catch((error: unknown) => reportError(error, 'nutrition/meal'));
  });
}

async function renderSupplements(user: User): Promise<void> {
  const [supplements, fullLog] = await Promise.all([
    loadUserData(user, 'mySupplements').then((value) => value ?? []),
    loadUserData(user, 'supplementLog').then((value) => value ?? {}),
  ]);
  const today = dateKey();
  const dayLog = fullLog[today] ?? {};
  const progress = dosesTakenToday(supplements, dayLog);
  shell(
    `<section class="feature-view"><button id="supp-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">${progress.taken}/${progress.total} ${copy('taken')}</p><h1>${copy('supplements')}</h1><div id="my-supplements" class="supplement-list"></div><h2>${copy('addSupplement')}</h2><input id="supp-search" class="catalog-search" placeholder="${copy('search')}"><div id="supp-catalog" class="catalog-list"></div></section>`,
  );
  document.querySelector('#supp-back')?.addEventListener('click', () => {
    currentView = 'nutrition';
    void renderNutrition(user);
  });
  const own = document.querySelector('#my-supplements');
  if (!supplements.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = copy('noSupplements');
    own?.append(empty);
  }
  supplements.forEach((supplement) => {
    const card = document.createElement('article');
    const top = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent =
      i18n.locale === 'en' ? supplement.nameEn || supplement.name : supplement.name;
    const remove = document.createElement('button');
    remove.textContent = copy('remove');
    remove.addEventListener(
      'click',
      () =>
        void saveUserData(
          user,
          'mySupplements',
          supplements.filter((item) => item.id !== supplement.id),
        )
          .then(() => renderSupplements(user))
          .catch((error: unknown) => reportError(error, 'supplements/remove')),
    );
    top.append(name, remove);
    card.append(top);
    supplement.times.forEach((time, index) => {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = dayLog[supplement.id]?.[index] === true;
      checkbox.addEventListener('change', () => {
        const doses = [...(dayLog[supplement.id] ?? [])];
        doses[index] = checkbox.checked;
        void saveUserData(user, 'supplementLog', {
          ...fullLog,
          [today]: { ...dayLog, [supplement.id]: doses },
        })
          .then(() => renderSupplements(user))
          .catch((error: unknown) => reportError(error, 'supplements/log'));
      });
      label.append(checkbox, document.createTextNode(` ${time}`));
      const removeTime = document.createElement('button');
      removeTime.type = 'button';
      removeTime.textContent = '×';
      removeTime.ariaLabel = `${copy('remove')} ${time}`;
      removeTime.addEventListener('click', () => {
        const updated = supplements.map((item) =>
          item.id === supplement.id
            ? { ...item, times: item.times.filter((_, timeIndex) => timeIndex !== index) }
            : item,
        );
        void saveUserData(user, 'mySupplements', updated)
          .then(() => renderSupplements(user))
          .catch((error: unknown) => reportError(error, 'supplements/time-remove'));
      });
      label.append(removeTime);
      card.append(label);
    });
    const schedule = document.createElement('div');
    schedule.className = 'supplement-schedule';
    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    timeInput.value = '08:00';
    const addTime = document.createElement('button');
    addTime.type = 'button';
    addTime.textContent = `+ ${copy('schedule')}`;
    addTime.addEventListener('click', () => {
      const updated = supplements.map((item) =>
        item.id === supplement.id
          ? { ...item, times: normalizeTimes([...item.times, timeInput.value]) }
          : item,
      );
      void saveUserData(user, 'mySupplements', updated)
        .then(() => renderSupplements(user))
        .catch((error: unknown) => reportError(error, 'supplements/time-add'));
    });
    schedule.append(timeInput, addTime);
    card.append(schedule);
    own?.append(card);
  });
  const draw = (query = '') => {
    const list = document.querySelector('#supp-catalog');
    if (!list) return;
    list.replaceChildren();
    const normalized = query.trim().toLowerCase();
    supplementCatalog
      .filter(
        (item) =>
          !normalized ||
          item.name.toLowerCase().includes(normalized) ||
          (item.nameEn ?? '').toLowerCase().includes(normalized),
      )
      .slice(0, 50)
      .forEach((item) => {
        const row = document.createElement('article');
        const body = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = i18n.locale === 'en' ? item.nameEn || item.name : item.name;
        const category = document.createElement('span');
        category.textContent = item.category;
        body.append(name, category);
        const add = document.createElement('button');
        add.textContent = copy('add');
        add.addEventListener('click', () => {
          const base = (
            item.id ||
            item.name
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]+/g, '-')
          ).slice(0, 45);
          const created = {
            ...item,
            id: `${base}-${Date.now().toString(36)}`,
            times: ['08:00'],
            custom: false,
          };
          void saveUserData(user, 'mySupplements', [...supplements, created].slice(0, 100))
            .then(() => renderSupplements(user))
            .catch((error: unknown) => reportError(error, 'supplements/add'));
        });
        row.append(body, add);
        list.append(row);
      });
  };
  draw();
  document
    .querySelector<HTMLInputElement>('#supp-search')
    ?.addEventListener('input', (event) => draw((event.currentTarget as HTMLInputElement).value));
}

async function renderWorkout(user: User): Promise<void> {
  clearWorkoutTimers();
  const [workoutsValue, draft, exerciseHistory, progressionDecisions] = await Promise.all([
    loadUserData(user, 'workouts'),
    loadWorkoutDraft(user, selectedDay),
    loadUserData(user, 'exerciseHistory').catch(() => null),
    loadUserData(user, 'progressionDecisions').catch(() => null),
  ]);
  const workouts = workoutsValue ?? {};
  const freshEntries = createEntries(workouts, selectedDay);
  const draftMatches =
    draft &&
    draft.entries.map((item) => item.exercise.name).join('\n') ===
      freshEntries.map((item) => item.exercise.name).join('\n');
  workoutEntries = draftMatches ? draft.entries : freshEntries;
  if (draftMatches) workoutStartedAt = draft.startedAt;
  shell(`<section class="workout-view"><button id="workout-back" class="link-button">← ${copy('back')}</button><div class="days" id="days"></div>
    <header class="workout-heading"><p class="eyebrow">${dateKey()}</p><h1 id="workout-title"></h1><div class="session-clock"><span>${copy('sessionTime')}</span><strong id="session-clock">00:00:00</strong><button id="session-pause" type="button"></button></div><div class="routine-actions"><button id="rename-routine">${copy('editRoutine')}</button><button id="add-exercise">+ ${copy('addExercise')}</button><button id="routine-template">${copy('templates')}</button></div></header><div id="exercise-list"></div><aside id="rest-timer" class="rest-timer" hidden></aside>
    <button id="finish-workout" class="primary" ${workoutEntries.length ? '' : 'disabled'}>${copy('finishWorkout')}</button><p id="workout-status" class="hint" role="status"></p></section>`);
  const title = document.querySelector('#workout-title');
  if (title) title.textContent = workouts[selectedDay]?.title ?? copy('noWorkout');
  if (draftMatches) {
    const status = document.querySelector('#workout-status');
    if (status) status.textContent = copy('sessionResumed');
  }
  renderDayButtons(user, workouts);
  renderExerciseEntries(user, workouts, exerciseHistory ?? {}, progressionDecisions ?? []);
  const pauseButton = document.querySelector<HTMLButtonElement>('#session-pause');
  const updateClock = () => {
    const elapsed = Math.max(0, Math.floor(sessionElapsedMs() / 1000));
    const target = document.querySelector('#session-clock');
    if (target)
      target.textContent = [
        Math.floor(elapsed / 3600),
        Math.floor((elapsed % 3600) / 60),
        elapsed % 60,
      ]
        .map((value) => String(value).padStart(2, '0'))
        .join(':');
    if (pauseButton) pauseButton.textContent = copy(workoutPausedAt !== null ? 'resume' : 'pause');
  };
  updateClock();
  sessionClock = window.setInterval(updateClock, 1000);
  pauseButton?.addEventListener('click', () => {
    if (workoutPausedAt !== null) {
      workoutPausedMs += Date.now() - workoutPausedAt;
      workoutPausedAt = null;
    } else {
      workoutPausedAt = Date.now();
    }
    updateClock();
  });
  document.querySelector('#workout-back')?.addEventListener('click', () => {
    clearWorkoutTimers();
    currentView = 'dashboard';
    renderDashboard(user);
  });
  document
    .querySelector('#finish-workout')
    ?.addEventListener('click', () => void finishWorkout(user, workouts));
  document
    .querySelector('#add-exercise')
    ?.addEventListener('click', () => renderExerciseCatalog(user, workouts));
  document
    .querySelector('#routine-template')
    ?.addEventListener('click', () => renderTemplatePicker(user, workouts));
  document.querySelector('#rename-routine')?.addEventListener('click', () => {
    const title = prompt(copy('routineName'), workouts[selectedDay]?.title ?? '');
    if (title?.trim()) {
      const current = workouts[selectedDay] ?? {
        title: selectedDay,
        titleEn: '',
        cardioNote: '',
        exercises: [],
        abs: [],
      };
      void saveUserData(user, 'workouts', {
        ...workouts,
        [selectedDay]: { ...current, title: title.trim().slice(0, 80) },
      })
        .then(() => renderWorkout(user))
        .catch((error: unknown) => reportError(error, 'workout/rename'));
    }
  });
}

function renderTemplatePicker(user: User, workouts: Workouts): void {
  shell(
    `<section class="feature-view"><button id="template-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">KYRO BUILDER</p><h1>${copy('chooseTemplate')}</h1><div id="template-list" class="template-list"></div></section>`,
  );
  document
    .querySelector('#template-back')
    ?.addEventListener('click', () => void renderWorkout(user));
  const list = document.querySelector('#template-list');
  (['fullbody', 'upperLower', 'ppl'] as TemplateKey[]).forEach((key) => {
    const card = document.createElement('article');
    const title = document.createElement('h2');
    title.textContent = copy(key);
    const description = document.createElement('p');
    description.textContent = copy(`${key}Description` as MessageKey);
    const apply = document.createElement('button');
    apply.textContent = copy('applyTemplate');
    apply.addEventListener('click', () => {
      if (!confirm(copy('templateConfirm'))) return;
      const generated = createTemplate(key);
      void saveUserData(user, 'workouts', { ...workouts, ...generated })
        .then(() =>
          Promise.all(Object.keys(generated).map((day) => clearWorkoutDraft(user, day as DayKey))),
        )
        .then(() => {
          selectedDay = (Object.keys(generated)[0] as DayKey | undefined) ?? 'segunda';
          workoutStartedAt = new Date().toISOString();
          resetWorkoutClock();
          return renderWorkout(user);
        })
        .catch((error: unknown) => reportError(error, 'workout/template'));
    });
    card.append(title, description, apply);
    list?.append(card);
  });
}

function renderExerciseCatalog(user: User, workouts: Workouts): void {
  shell(
    `<section class="feature-view"><button id="catalog-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">CATALOG · 170</p><h1>${copy('addExercise')}</h1><input id="catalog-search" class="catalog-search" placeholder="${copy('search')}" autocomplete="off"><div id="catalog-list" class="catalog-list"></div></section>`,
  );
  const draw = (query = '') => {
    const list = document.querySelector('#catalog-list');
    if (!list) return;
    list.replaceChildren();
    searchExercises(query, i18n.locale)
      .slice(0, 100)
      .forEach((exercise) => {
        const row = document.createElement('article');
        const body = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = exercise.name;
        const meta = document.createElement('span');
        meta.textContent = `${exercise.sets} × ${exercise.reps} · ${exercise.equipment}`;
        body.append(name, meta);
        const add = document.createElement('button');
        add.textContent = copy('add');
        add.addEventListener('click', () => {
          const current = workouts[selectedDay] ?? {
            title: selectedDay,
            titleEn: '',
            cardioNote: '',
            exercises: [],
            abs: [],
          };
          const next = {
            ...workouts,
            [selectedDay]: { ...current, exercises: [...current.exercises, exercise].slice(0, 60) },
          };
          void saveUserData(user, 'workouts', next)
            .then(() => clearWorkoutDraft(user, selectedDay))
            .then(() => renderWorkout(user))
            .catch((error: unknown) => reportError(error, 'workout/add'));
        });
        row.append(body, add);
        list.append(row);
      });
  };
  draw();
  document
    .querySelector('#catalog-back')
    ?.addEventListener('click', () => void renderWorkout(user));
  document
    .querySelector<HTMLInputElement>('#catalog-search')
    ?.addEventListener('input', (event) => draw((event.currentTarget as HTMLInputElement).value));
}

function renderDayButtons(user: User, workouts: Workouts): void {
  const container = document.querySelector('#days');
  if (!container) return;
  dayKeys.forEach((day) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = day.slice(0, 3).toUpperCase();
    button.ariaPressed = String(day === selectedDay);
    button.addEventListener('click', () => {
      selectedDay = day;
      void renderWorkout(user);
    });
    if (!workouts[day]) button.classList.add('empty');
    container.append(button);
  });
}

function renderExerciseEntries(
  user: User,
  workouts: Workouts,
  exerciseHistory: Record<string, PerformanceEntry[]>,
  progressionDecisions: ProgressionDecision[],
): void {
  const list = document.querySelector('#exercise-list');
  if (!list) return;
  const persistDraft = () =>
    void saveWorkoutDraft(user, selectedDay, workoutStartedAt, workoutEntries).catch(
      (error: unknown) => reportError(error, 'workout/draft'),
    );
  if (!workoutEntries.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = copy('noWorkout');
    list.append(empty);
    return;
  }
  workoutEntries.forEach((entry, exerciseIndex) => {
    const card = document.createElement('article');
    card.className = 'exercise-card';
    card.draggable = true;
    card.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('text/plain', String(exerciseIndex));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      card.classList.remove('drag-over');
      const fromIndex = Number(event.dataTransfer?.getData('text/plain'));
      if (!Number.isInteger(fromIndex) || fromIndex === exerciseIndex) return;
      void saveUserData(
        user,
        'workouts',
        reorderExercise(workouts, selectedDay, fromIndex, exerciseIndex),
      )
        .then(() => clearWorkoutDraft(user, selectedDay))
        .then(() => renderWorkout(user))
        .catch((error: unknown) => reportError(error, 'workout/reorder'));
    });
    const top = document.createElement('div');
    top.className = 'exercise-top';
    const heading = document.createElement('h2');
    heading.textContent = entry.exercise.name;
    const actions = document.createElement('div');
    const reorder = (direction: -1 | 1) =>
      void saveUserData(
        user,
        'workouts',
        moveExercise(workouts, selectedDay, exerciseIndex, direction),
      )
        .then(() => clearWorkoutDraft(user, selectedDay))
        .then(() => renderWorkout(user))
        .catch((error: unknown) => reportError(error, 'workout/reorder'));
    const up = document.createElement('button');
    up.textContent = '↑';
    up.ariaLabel = copy('moveUp');
    up.disabled = exerciseIndex === 0;
    up.addEventListener('click', () => reorder(-1));
    const down = document.createElement('button');
    down.textContent = '↓';
    down.ariaLabel = copy('moveDown');
    down.disabled = exerciseIndex === workoutEntries.length - 1;
    down.addEventListener('click', () => reorder(1));
    const remove = document.createElement('button');
    remove.textContent = copy('remove');
    remove.addEventListener('click', () => {
      const current = workouts[selectedDay];
      if (!current) return;
      const nextExercises = current.exercises.filter((_, index) => index !== exerciseIndex);
      void saveUserData(user, 'workouts', {
        ...workouts,
        [selectedDay]: { ...current, exercises: nextExercises },
      })
        .then(() => clearWorkoutDraft(user, selectedDay))
        .then(() => renderWorkout(user))
        .catch((error: unknown) => reportError(error, 'workout/remove'));
    });
    actions.append(up, down, remove);
    top.append(heading, actions);
    card.append(top);
    const meta = document.createElement('div');
    meta.className = 'exercise-meta';
    const updateTarget = (patch: Partial<Pick<Exercise, 'sets' | 'reps' | 'rest'>>) => {
      const current = workouts[selectedDay];
      if (!current) return;
      const exercises = current.exercises.map((exercise, index) =>
        index === exerciseIndex ? { ...exercise, ...patch } : exercise,
      );
      void saveUserData(user, 'workouts', { ...workouts, [selectedDay]: { ...current, exercises } })
        .then(() => clearWorkoutDraft(user, selectedDay))
        .then(() => renderWorkout(user))
        .catch((error: unknown) => reportError(error, 'workout/edit-target'));
    };
    const setsInput = document.createElement('input');
    setsInput.type = 'number';
    setsInput.min = '1';
    setsInput.max = '20';
    setsInput.step = '1';
    setsInput.value = String(entry.exercise.sets);
    setsInput.ariaLabel = copy('sets');
    setsInput.addEventListener('change', () =>
      updateTarget({ sets: Math.min(20, Math.max(1, Math.round(Number(setsInput.value)) || 1)) }),
    );
    const repsInput = document.createElement('input');
    repsInput.type = 'text';
    repsInput.maxLength = 20;
    repsInput.value = entry.exercise.reps;
    repsInput.ariaLabel = copy('reps');
    repsInput.addEventListener('change', () =>
      updateTarget({ reps: repsInput.value.trim().slice(0, 20) || '10' }),
    );
    const restInput = document.createElement('input');
    restInput.type = 'number';
    restInput.min = '0';
    restInput.max = '1800';
    restInput.step = '5';
    restInput.value = String(entry.exercise.rest);
    restInput.ariaLabel = copy('rest');
    restInput.addEventListener('change', () =>
      updateTarget({ rest: Math.min(1800, Math.max(0, Math.round(Number(restInput.value)) || 0)) }),
    );
    meta.append(
      setsInput,
      document.createTextNode(' × '),
      repsInput,
      document.createTextNode(` · ${copy('rest')} `),
      restInput,
      document.createTextNode('s'),
    );
    card.append(meta);
    const recommendation = progressionRecommendation(
      exerciseHistory[entry.exercise.name] ?? [],
      entry.exercise.reps,
    );
    const evidenceDate = [...(exerciseHistory[entry.exercise.name] ?? [])].sort((a, b) =>
      b.date.localeCompare(a.date),
    )[0]?.date;
    if (recommendation.action !== 'insufficient') {
      const action = recommendation.action;
      const insight = document.createElement('p');
      insight.className = `progression-insight ${recommendation.action}`;
      const recommendationText = copy(`progression_${recommendation.action}` as MessageKey);
      insight.textContent = recommendation.suggestedLoad
        ? `${recommendationText} ${recommendation.suggestedLoad} kg.`
        : recommendationText;
      card.append(insight);
      const existingDecision = [...progressionDecisions]
        .reverse()
        .find(
          (decision) =>
            decision.exercise === entry.exercise.name &&
            decision.action === action &&
            decision.suggestedLoad === recommendation.suggestedLoad &&
            decision.evidenceDate === evidenceDate,
        );
      if (existingDecision) {
        const decisionStatus = document.createElement('small');
        decisionStatus.className = 'progression-decision';
        decisionStatus.textContent = copy(
          existingDecision.accepted ? 'suggestionAccepted' : 'suggestionRejected',
        );
        card.append(decisionStatus);
      } else {
        const decisionActions = document.createElement('div');
        decisionActions.className = 'progression-actions';
        const decide = (accepted: boolean) => {
          const reason = accepted
            ? ''
            : (prompt(copy('rejectionReason')) ?? '').trim().slice(0, 300);
          const decision: ProgressionDecision = {
            id: crypto.randomUUID().slice(0, 60),
            exercise: entry.exercise.name,
            action,
            accepted,
            suggestedLoad: recommendation.suggestedLoad,
            ...(evidenceDate ? { evidenceDate } : {}),
            reason,
            decidedAt: new Date().toISOString(),
          };
          if (accepted && recommendation.suggestedLoad)
            entry.sets
              .filter((set) => !set.done)
              .forEach((set) => (set.kg = recommendation.suggestedLoad ?? set.kg));
          void Promise.all([
            saveUserData(
              user,
              'progressionDecisions',
              [...progressionDecisions, decision].slice(-500),
            ),
            accepted ? persistDraft() : Promise.resolve(),
          ])
            .then(() => renderWorkout(user))
            .catch((error: unknown) => reportError(error, 'progression/decision'));
        };
        const accept = document.createElement('button');
        accept.type = 'button';
        accept.textContent = copy('acceptSuggestion');
        accept.addEventListener('click', () => decide(true));
        const reject = document.createElement('button');
        reject.type = 'button';
        reject.textContent = copy('rejectSuggestion');
        reject.addEventListener('click', () => decide(false));
        decisionActions.append(accept, reject);
        card.append(decisionActions);
      }
    }
    if (entry.exercise.videoUrl) {
      const video = document.createElement('a');
      video.className = 'exercise-video';
      video.href = entry.exercise.videoUrl;
      video.target = '_blank';
      video.rel = 'noopener noreferrer';
      video.textContent = copy('watchVideo');
      card.append(video);
    }
    const tools = document.createElement('div');
    tools.className = 'exercise-tools';
    const rest = document.createElement('button');
    rest.textContent = copy('startRest');
    rest.addEventListener('click', () => startRestTimer(entry.exercise.rest));
    const notes = document.createElement('textarea');
    notes.maxLength = 1000;
    notes.placeholder = copy('notes');
    notes.value = entry.exercise.notes;
    notes.addEventListener('change', () => {
      const current = workouts[selectedDay];
      if (!current) return;
      const exercises = current.exercises.map((exercise, index) =>
        index === exerciseIndex ? { ...exercise, notes: notes.value.slice(0, 1000) } : exercise,
      );
      void saveUserData(user, 'workouts', {
        ...workouts,
        [selectedDay]: { ...current, exercises },
      }).catch((error: unknown) => reportError(error, 'workout/notes'));
    });
    tools.append(rest, notes);
    card.append(tools);
    const alternatives = rankExerciseAlternatives(entry.exercise, exerciseCatalog);
    if (alternatives.length) {
      const alternativesButton = document.createElement('button');
      alternativesButton.className = 'link-button';
      alternativesButton.textContent = copy('findAlternative');
      const alternativesList = document.createElement('div');
      alternativesList.className = 'exercise-alternatives';
      alternativesList.hidden = true;
      alternatives.forEach(({ exercise, sharedMuscles }) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.textContent = `${exercise.name} · ${exercise.equipment} · ${sharedMuscles.join(', ')}`;
        option.addEventListener('click', () => {
          const current = workouts[selectedDay];
          if (!current) return;
          const replacement = (item: (typeof current.exercises)[number]) => ({
            ...exercise,
            sets: item.sets,
            reps: item.reps,
            rest: item.rest,
            notes: item.notes,
          });
          const exercises = current.exercises.map((item, index) =>
            index === exerciseIndex ? replacement(item) : item,
          );
          const abdominalIndex = exerciseIndex - current.exercises.length;
          const abs = current.abs.map((item, index) =>
            index === abdominalIndex
              ? {
                  ...replacement(item),
                }
              : item,
          );
          void saveUserData(user, 'workouts', {
            ...workouts,
            [selectedDay]: { ...current, exercises, abs },
          })
            .then(() => clearWorkoutDraft(user, selectedDay))
            .then(() => renderWorkout(user))
            .catch((error: unknown) => reportError(error, 'workout/substitution'));
        });
        alternativesList.append(option);
      });
      alternativesButton.addEventListener('click', () => {
        alternativesList.hidden = !alternativesList.hidden;
      });
      card.append(alternativesButton, alternativesList);
    }
    const setHeader = document.createElement('div');
    setHeader.className = 'set-row set-header';
    ['', copy('load'), copy('reps'), copy('rir'), copy('rpe'), '✓'].forEach((label) => {
      const cell = document.createElement('span');
      cell.textContent = label;
      setHeader.append(cell);
    });
    card.append(setHeader);
    entry.sets.forEach((set, setIndex) => {
      const row = document.createElement('div');
      row.className = 'set-row';
      const number = document.createElement('span');
      number.textContent = String(setIndex + 1);
      const kg = document.createElement('input');
      kg.type = 'number';
      kg.min = '0';
      kg.max = '1000';
      kg.step = '0.5';
      kg.inputMode = 'decimal';
      kg.placeholder = copy('load');
      kg.ariaLabel = `${copy('load')} ${setIndex + 1}`;
      const reps = document.createElement('input');
      reps.type = 'number';
      reps.min = '0';
      reps.max = '1000';
      reps.step = '1';
      reps.inputMode = 'numeric';
      reps.placeholder = copy('reps');
      reps.ariaLabel = `${copy('reps')} ${setIndex + 1}`;
      const rir = document.createElement('input');
      rir.type = 'number';
      rir.min = '0';
      rir.max = '10';
      rir.step = '1';
      rir.inputMode = 'numeric';
      rir.placeholder = copy('rir');
      rir.ariaLabel = `${copy('rir')} ${setIndex + 1}`;
      const rpe = document.createElement('input');
      rpe.type = 'number';
      rpe.min = '1';
      rpe.max = '10';
      rpe.step = '0.5';
      rpe.inputMode = 'decimal';
      rpe.placeholder = copy('rpe');
      rpe.ariaLabel = `${copy('rpe')} ${setIndex + 1}`;
      const done = document.createElement('input');
      done.type = 'checkbox';
      done.ariaLabel = `${copy('continue')} ${setIndex + 1}`;
      const guidance = document.createElement('small');
      guidance.className = 'set-guidance';
      kg.value = set.kg ? String(set.kg) : '';
      reps.value = set.reps ? String(set.reps) : '';
      rir.value = set.rir === undefined ? '' : String(set.rir);
      rpe.value = set.rpe === undefined ? '' : String(set.rpe);
      done.checked = set.done;
      row.classList.toggle('done', set.done);
      kg.addEventListener('input', () => {
        if (!kg.checkValidity()) return;
        set.kg = Number(kg.value) || 0;
        const plates = calculatePlates(set.kg);
        guidance.textContent =
          set.kg > 20
            ? `${copy('warmup')} ${Math.round(set.kg * 0.5)}kg · ${copy('plates')}: ${plates.join(' + ') || '—'}`
            : '';
        persistDraft();
      });
      reps.addEventListener('input', () => {
        if (!reps.checkValidity()) return;
        set.reps = Number(reps.value) || 0;
        persistDraft();
      });
      rir.addEventListener('input', () => {
        if (!rir.checkValidity()) return;
        set.rir = rir.value === '' ? undefined : Number(rir.value);
        persistDraft();
      });
      rpe.addEventListener('input', () => {
        if (!rpe.checkValidity()) return;
        set.rpe = rpe.value === '' ? undefined : Number(rpe.value);
        persistDraft();
      });
      done.addEventListener('change', () => {
        const invalid = [kg, reps, rir, rpe].find((input) => !input.checkValidity());
        if (invalid) {
          done.checked = false;
          set.done = false;
          row.classList.remove('done');
          invalid.reportValidity();
          invalid.focus();
          return;
        }
        set.done = done.checked;
        row.classList.toggle('done', done.checked);
        persistDraft();
      });
      row.append(number, kg, reps, rir, rpe, done);
      card.append(row);
      card.append(guidance);
    });
    list.append(card);
  });
}

function startRestTimer(seconds: number): void {
  if (restClock) window.clearInterval(restClock);
  const target = document.querySelector<HTMLElement>('#rest-timer');
  if (!target) return;
  const end = Date.now() + Math.max(0, seconds) * 1000;
  target.hidden = false;
  target.textContent = '';
  const label = document.createElement('span');
  const stop = document.createElement('button');
  stop.type = 'button';
  stop.textContent = copy('stopRest');
  stop.addEventListener('click', () => {
    if (restClock) window.clearInterval(restClock);
    target.hidden = true;
  });
  target.append(label, stop);
  let notified = false;
  const tick = () => {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    label.textContent = `${copy('rest')} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (left <= 0) {
      if (restClock) window.clearInterval(restClock);
      target.hidden = true;
      if (!notified && restNotificationsEnabled) {
        notified = true;
        void showLocalNotification('KYRO', copy('restComplete')).catch((error: unknown) =>
          reportError(error, 'notifications/rest'),
        );
      }
    }
  };
  tick();
  restClock = window.setInterval(tick, 250);
}

async function finishWorkout(user: User, workouts: Workouts): Promise<void> {
  const count = completedExerciseCount(workoutEntries);
  if (!count) {
    const status = document.querySelector('#workout-status');
    if (status) status.textContent = copy('finishNeedsSet');
    return;
  }
  const endedAt = new Date();
  const [existing, history, records] = await Promise.all([
    loadUserData(user, 'sessionLog').then((value) => value ?? []),
    loadUserData(user, 'exerciseHistory').then((value) => value ?? {}),
    loadUserData(user, 'exerciseRecords').then((value) => value ?? {}),
  ]);
  const session = {
    id: crypto.randomUUID().slice(0, 60),
    date: dateKey(endedAt),
    day: selectedDay,
    title: workouts[selectedDay]?.title ?? selectedDay,
    startedAt: workoutStartedAt,
    endedAt: endedAt.toISOString(),
    durationSec: Math.max(0, Math.round(sessionElapsedMs(endedAt.getTime()) / 1000)),
    volume: workoutVolume(workoutEntries),
    exerciseCount: count,
  };
  const nextHistory = { ...history };
  const nextRecords = { ...records };
  for (const entry of workoutEntries) {
    const completed = entry.sets
      .filter((set) => set.done && set.kg > 0 && set.reps > 0)
      .map(({ kg, reps, rir, rpe }) => ({ kg, reps, rir, rpe }));
    const best = bestCompletedSet(entry);
    if (!completed.length || !best) continue;
    nextHistory[entry.exercise.name] = [
      ...(nextHistory[entry.exercise.name] ?? []),
      { date: dateKey(endedAt), sets: completed, e1rm: best.maxE1rm },
    ].slice(-60);
    const previous = nextRecords[entry.exercise.name];
    nextRecords[entry.exercise.name] = {
      maxWeight: Math.max(previous?.maxWeight ?? 0, best.maxWeight),
      maxWeightReps:
        best.maxWeight >= (previous?.maxWeight ?? 0)
          ? best.maxWeightReps
          : (previous?.maxWeightReps ?? 0),
      maxE1rm: Math.max(previous?.maxE1rm ?? 0, best.maxE1rm),
      maxWeightDate:
        best.maxWeight >= (previous?.maxWeight ?? 0)
          ? dateKey(endedAt)
          : (previous?.maxWeightDate ?? null),
      maxE1rmDate:
        best.maxE1rm >= (previous?.maxE1rm ?? 0)
          ? dateKey(endedAt)
          : (previous?.maxE1rmDate ?? null),
    };
  }
  await Promise.all([
    saveUserData(user, 'sessionLog', [...existing, session].slice(-450)),
    saveUserData(user, 'exerciseHistory', nextHistory),
    saveUserData(user, 'exerciseRecords', nextRecords),
  ]);
  await clearWorkoutDraft(user, selectedDay);
  const status = document.querySelector('#workout-status');
  if (status) status.textContent = navigator.onLine ? copy('workoutSaved') : copy('syncPending');
  clearWorkoutTimers();
  workoutStartedAt = endedAt.toISOString();
  resetWorkoutClock();
}

function render(): void {
  if (authState.status === 'loading') {
    shell('<section class="loading" aria-label="Loading"><div></div></section>');
    return;
  }
  if (authState.status === 'signed-out' || authState.status === 'blocked') {
    renderAuth();
    return;
  }
  if (authState.status === 'unverified' && authState.user) {
    renderVerification(authState.user);
    return;
  }
  if (authState.user)
    void renderReady(authState.user).catch((error: unknown) => reportError(error, 'app/render'));
}

onError(() => {
  const toast = document.querySelector<HTMLElement>('#error');
  if (toast) {
    toast.textContent = copy('error');
    toast.hidden = false;
  }
});
if (emailAction) {
  void renderEmailAction();
} else {
  observeAuth((state) => {
    authState = state;
    render();
  });
  window.addEventListener('online', render);
  window.addEventListener('offline', render);
  render();
}
navigator.serviceWorker?.addEventListener('controllerchange', () => location.reload());
void registerPwaUpdates((registration) => {
  updateRegistration = registration;
  document.querySelector<HTMLElement>('#update')?.removeAttribute('hidden');
}).catch((error: unknown) => reportError(error, 'pwa/register'));
