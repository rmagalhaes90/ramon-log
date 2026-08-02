import './styles.css';
import type { User } from 'firebase/auth';
import { installGlobalErrorHandlers, onError, reportError } from './core/errors';
import { createI18n, type Locale, type MessageKey } from './core/i18n';
import type { NutritionDay, Workouts } from './domain/schemas';
import {
  authErrorKey,
  createAccount,
  loginWithGoogle,
  loginWithPassword,
  logout,
  observeAuth,
  refreshVerification,
  requestPasswordReset,
  resendVerification,
  type AuthState,
} from './features/auth';
import { listSharedUsers, setUserAdmin, setUserBlocked } from './features/admin';
import { searchExercises, supplementCatalog } from './features/catalog';
import { dosesTakenToday } from './features/supplements/model';
import { flushPhotoUploads, photoQueueCount } from './features/photos/offline';
import { renderPhotosView } from './features/photos/view';
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
import { createTemplate, moveExercise, type TemplateKey } from './features/workouts/templates';
import { clearWorkoutDraft, loadWorkoutDraft, saveWorkoutDraft } from './features/workouts/draft';
import { trainingStreak, unlockedAchievements, weeklyReport } from './features/reports/model';
import { renderSettingsView } from './features/settings/view';
import { emptyNutritionDay, percentage } from './features/nutrition/model';
import { lookupBarcode } from './features/nutrition/barcode';
import { barcodeCameraSupported, startBarcodeCamera } from './features/nutrition/camera';
import { readinessClass, readinessScore, weightDelta } from './features/progress/model';
import { chartPoints } from './features/progress/chart';
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
      .then(() => renderDashboard(user))
      .catch((error: unknown) => reportError(error, 'onboarding/save'));
  });
}

async function renderReady(user: User): Promise<void> {
  if (await needsOnboarding(user)) {
    renderOnboarding(user);
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
    <div class="status"><span id="network">${copy(navigator.onLine ? 'online' : 'offline')}</span><span>·</span><span>${copy('queue')}: <b id="queue-count">0</b></span></div>
    <button id="start-workout" class="primary">${copy('train')}</button>${authState.isAdmin ? `<button id="open-admin" class="secondary">${copy('admin')}</button>` : ''}<button id="logout" class="link-button">${copy('logout')}</button></section>
    <section class="feature-grid" aria-label="KYRO modules"><article><span>01</span><h2>TRAIN</h2><p>Workouts, routines, exercises and sets.</p></article>
    <article><span>02</span><h2>RECOVER</h2><p>Readiness, history and progress.</p><button id="open-progress">${copy('progress')}</button></article><article><span>03</span><h2>FUEL</h2><p>Nutrition and supplements.</p><button id="open-nutrition">${copy('nutrition')}</button></article>
    <article><span>04</span><h2>SYNC</h2><p>Offline-first, private and resilient.</p><button id="open-settings">${copy('settings')}</button></article></section>`);
  document
    .querySelector('#logout')
    ?.addEventListener(
      'click',
      () => void logout().catch((error: unknown) => reportError(error, 'auth/logout')),
    );
  document.querySelector('#start-workout')?.addEventListener('click', () => {
    currentView = 'workout';
    workoutStartedAt = new Date().toISOString();
    void renderWorkout(user);
  });
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
  document.querySelector('#open-admin')?.addEventListener('click', () => {
    currentView = 'admin';
    void renderAdmin(user);
  });
  void Promise.all([flushUserDataQueue(user), flushPhotoUploads(user)]).catch((error: unknown) =>
    reportError(error, 'sync/flush'),
  );
  void Promise.all([queueList(), photoQueueCount(user)])
    .then(([items, photos]) => {
      const count = document.querySelector('#queue-count');
      if (count) count.textContent = String(items.length + photos);
    })
    .catch((error: unknown) => reportError(error, 'queue/render'));
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
  const [weights, measurements, readiness, sessions] = await Promise.all([
    loadUserData(user, 'bodyWeights').then((value) => value ?? []),
    loadUserData(user, 'bodyMeasurements').then((value) => value ?? {}),
    loadUserData(user, 'readinessLog').then((value) => value ?? {}),
    loadUserData(user, 'sessionLog').then((value) => value ?? []),
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
    <div id="weight-chart" class="progress-chart" aria-label="${copy('weightChart')}"></div><form id="weight-form" class="compact-form"><label>${copy('weight')}<input id="weight-input" type="number" min="1" max="1000" step="0.1" required></label><button class="primary">${copy('add')}</button></form>
    <form id="measurements-form" class="measurements-form"><label>${copy('waist')}<input name="waist" type="number" min="20" max="300" step="0.1"></label><label>${copy('chest')}<input name="chest" type="number" min="20" max="300" step="0.1"></label><label>${copy('arm')}<input name="arm" type="number" min="10" max="150" step="0.1"></label><label>${copy('hip')}<input name="hip" type="number" min="20" max="300" step="0.1"></label><label>${copy('thigh')}<input name="thigh" type="number" min="10" max="200" step="0.1"></label><button class="primary">${copy('saveMeasurements')}</button></form>
    <form id="readiness-form" class="readiness-form">${(['sleep', 'energy', 'soreness', 'stress'] as const).map((key) => `<label>${copy(key)}<input name="${key}" type="range" min="1" max="5" value="3"></label>`).join('')}<button class="primary">${copy('save')}</button></form>
    <section class="weekly-report"><h2>${copy('weeklyReport')}</h2><div><article><strong>${report.sessions}</strong><span>${copy('sessions')}</span></article><article><strong>${Math.round(report.volume)}</strong><span>${copy('volume')}</span></article><article><strong>${Math.round(report.minutes)}</strong><span>${copy('minutes')}</span></article><article><strong>${streak}</strong><span>${copy('streak')}</span></article></div></section><section><h2>${copy('achievements')}</h2><div id="achievement-list" class="achievement-list"></div></section><button id="open-photos" class="secondary">${copy('progressPhotos')}</button><div id="session-history" class="history-list"></div></section>`);
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
    const next = {
      ...readiness,
      [dateKey()]: {
        sleep,
        energy,
        soreness,
        stress,
        score,
        classification: readinessClass(score),
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
  const log = (await loadUserData(user, 'nutritionLog')) ?? {};
  const today = dateKey();
  const previous = Object.keys(log)
    .sort()
    .map((key) => log[key])
    .filter((value): value is NutritionDay => Boolean(value))
    .at(-1);
  const day = log[today] ?? emptyNutritionDay(previous);
  shell(`<section class="feature-view"><button id="feature-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">03 · FUEL</p><h1>${copy('nutrition')}</h1>
    <div class="metric-grid nutrition-metrics"><article><span>${copy('calories')}</span><strong>${Math.round(day.kcal)}</strong><small>${Math.round(percentage(day.kcal, day.kcalGoal))}%</small></article><article><span>${copy('protein')}</span><strong>${Math.round(day.protein)}g</strong><small>${Math.round(percentage(day.protein, day.proteinGoal))}%</small></article><article><span>${copy('water')}</span><strong>${day.water.toFixed(2)}L</strong><button id="add-water">+ 250ml</button></article></div><button id="open-supplements" class="secondary">${copy('supplements')}</button><form id="barcode-form" class="barcode-form"><label>${copy('barcode')}<input name="barcode" inputmode="numeric" pattern="[0-9]{8,14}" maxlength="14" required></label><button type="submit">${copy('lookup')}</button><button type="button" id="scan-barcode" ${barcodeCameraSupported() ? '' : 'disabled'}>${copy('scanBarcode')}</button><video id="barcode-video" hidden muted></video><span id="barcode-status" role="status"></span></form>
    <form id="meal-form" class="meal-form"><label>${copy('mealName')}<input name="name" maxlength="120" required></label><label>${copy('calories')}<input name="kcal" type="number" min="0" max="10000" required></label><label>${copy('protein')}<input name="protein" type="number" min="0" max="1000" step="0.1"></label><label>${copy('carbs')}<input name="carb" type="number" min="0" max="1000" step="0.1"></label><label>${copy('fat')}<input name="fat" type="number" min="0" max="1000" step="0.1"></label><button class="primary">${copy('add')} ${copy('meal')}</button></form>
    <div id="meal-list" class="history-list"></div></section>`);
  bindBack(user);
  const list = document.querySelector('#meal-list');
  day.meals
    .slice()
    .reverse()
    .forEach((meal) => {
      const row = document.createElement('article');
      const name = document.createElement('strong');
      name.textContent = meal.name;
      const meta = document.createElement('span');
      meta.textContent = `${Math.round(meal.kcal)} kcal · P ${Math.round(meal.prot)}g · C ${Math.round(meal.carb)}g · F ${Math.round(meal.fat)}g`;
      row.append(name, meta);
      list?.append(row);
    });
  const persist = (next: NutritionDay) =>
    saveUserData(user, 'nutritionLog', { ...log, [today]: next }).then(() => renderNutrition(user));
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
        const values: { name: string; kcal: number; protein: number; carb: number; fat: number } =
          food;
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
      t: new Date().toISOString(),
    };
    const next = {
      ...day,
      kcal: day.kcal + meal.kcal,
      protein: day.protein + meal.prot,
      carb: day.carb + meal.carb,
      fat: day.fat + meal.fat,
      meals: [...day.meals, meal],
    };
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
      card.append(label);
    });
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
  const [workoutsValue, draft] = await Promise.all([
    loadUserData(user, 'workouts'),
    loadWorkoutDraft(user, selectedDay),
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
    <header class="workout-heading"><p class="eyebrow">${dateKey()}</p><h1 id="workout-title"></h1><div class="session-clock"><span>${copy('sessionTime')}</span><strong id="session-clock">00:00:00</strong></div><div class="routine-actions"><button id="rename-routine">${copy('editRoutine')}</button><button id="add-exercise">+ ${copy('addExercise')}</button><button id="routine-template">${copy('templates')}</button></div></header><div id="exercise-list"></div><aside id="rest-timer" class="rest-timer" hidden></aside>
    <button id="finish-workout" class="primary" ${workoutEntries.length ? '' : 'disabled'}>${copy('finishWorkout')}</button><p id="workout-status" class="hint" role="status"></p></section>`);
  const title = document.querySelector('#workout-title');
  if (title) title.textContent = workouts[selectedDay]?.title ?? copy('noWorkout');
  renderDayButtons(user, workouts);
  renderExerciseEntries(user, workouts);
  const updateClock = () => {
    const elapsed = Math.max(
      0,
      Math.floor((Date.now() - new Date(workoutStartedAt).getTime()) / 1000),
    );
    const target = document.querySelector('#session-clock');
    if (target)
      target.textContent = [
        Math.floor(elapsed / 3600),
        Math.floor((elapsed % 3600) / 60),
        elapsed % 60,
      ]
        .map((value) => String(value).padStart(2, '0'))
        .join(':');
  };
  updateClock();
  sessionClock = window.setInterval(updateClock, 1000);
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

function renderExerciseEntries(user: User, workouts: Workouts): void {
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
    const meta = document.createElement('p');
    meta.className = 'exercise-meta';
    meta.textContent = `${entry.exercise.sets} × ${entry.exercise.reps} · ${copy('rest')} ${entry.exercise.rest}s`;
    card.append(meta);
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
      const done = document.createElement('input');
      done.type = 'checkbox';
      done.ariaLabel = `${copy('continue')} ${setIndex + 1}`;
      const guidance = document.createElement('small');
      guidance.className = 'set-guidance';
      kg.value = set.kg ? String(set.kg) : '';
      reps.value = set.reps ? String(set.reps) : '';
      done.checked = set.done;
      row.classList.toggle('done', set.done);
      kg.addEventListener('input', () => {
        set.kg = Number(kg.value) || 0;
        const plates = calculatePlates(set.kg);
        guidance.textContent =
          set.kg > 20
            ? `${copy('warmup')} ${Math.round(set.kg * 0.5)}kg · ${copy('plates')}: ${plates.join(' + ') || '—'}`
            : '';
        persistDraft();
      });
      reps.addEventListener('input', () => {
        set.reps = Number(reps.value) || 0;
        persistDraft();
      });
      done.addEventListener('change', () => {
        set.done = done.checked;
        row.classList.toggle('done', done.checked);
        persistDraft();
      });
      row.append(number, kg, reps, done);
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
  let notified = false;
  const tick = () => {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    target.textContent = `${copy('rest')} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
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
  if (!count) return;
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
    durationSec: Math.max(
      0,
      Math.round((endedAt.getTime() - new Date(workoutStartedAt).getTime()) / 1000),
    ),
    volume: workoutVolume(workoutEntries),
    exerciseCount: count,
  };
  const nextHistory = { ...history };
  const nextRecords = { ...records };
  for (const entry of workoutEntries) {
    const completed = entry.sets
      .filter((set) => set.done && set.kg > 0 && set.reps > 0)
      .map(({ kg, reps }) => ({ kg, reps }));
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
observeAuth((state) => {
  authState = state;
  render();
});
window.addEventListener('online', render);
window.addEventListener('offline', render);
navigator.serviceWorker?.addEventListener('controllerchange', () => location.reload());
render();
void registerPwaUpdates((registration) => {
  updateRegistration = registration;
  document.querySelector<HTMLElement>('#update')?.removeAttribute('hidden');
}).catch((error: unknown) => reportError(error, 'pwa/register'));
