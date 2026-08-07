import './styles.css';
import type { User } from 'firebase/auth';
import {
  installGlobalErrorHandlers,
  onError,
  reportBackgroundError,
  reportError,
} from './core/errors';
import { createI18n, messageFor, type Locale, type MessageKey } from './core/i18n';
import type {
  Exercise,
  ExerciseRecords,
  FavoriteMeal,
  NutritionDay,
  Profile,
  ProgressionDecision,
  Workouts,
} from './domain/schemas';
import { exerciseSchema } from './domain/schemas';
import {
  authErrorKey,
  completeEmailAction,
  completePasswordReset,
  createAccount,
  loginWithApple,
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
import { listSharedUsers, setUserAdmin, setUserBlocked, setUserCoach } from './features/admin';
import {
  createInvite,
  listCoachStudents,
  loadCoachVideos,
  myCoach,
  saveCoachVideo,
  type CoachStudent,
} from './features/coach';
import { exerciseCatalog, searchExercises, supplementCatalog } from './features/catalog';
import { getExerciseMedia, searchExerciseMedia } from './features/catalog/media';
import { translateExerciseNameToEnglish } from './features/catalog/translateExerciseName';
import {
  loadSharedExerciseCatalog,
  saveSharedExerciseCatalog,
} from './features/catalog/sharedCatalog';
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
  estimatedOneRepMax,
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
import {
  generateWorkout,
  MUSCLE_GROUPS,
  type IntensityKey,
  type MuscleGroupKey,
} from './features/workouts/generator';
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
import {
  displayLength,
  displayWeight,
  lengthUnitLabel,
  parseLengthInput,
  parseWeightInput,
  weightUnitLabel,
  type UnitSystem,
} from './core/units';
import { applyTheme, loadTheme } from './core/theme';
import { shouldShowRoutineSpotlight, showSpotlight } from './core/spotlight';
import { cacheGet, cacheSet, queueList } from './services/database';
import { activateUpdate, registerPwaUpdates } from './services/pwa-update';
import { flushUserDataQueue, loadUserData, saveUserData } from './services/user-data';

installGlobalErrorHandlers();
applyTheme(loadTheme());
const i18n = createI18n();
i18n.setLocale(i18n.locale);
const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing #app root');
const appRoot = root;
const emailAction = parseEmailAction(location.search);

let authState: AuthState = { status: 'loading', user: null, isAdmin: false, isCoach: false };
let authMode: 'login' | 'signup' = 'login';
let updateRegistration: ServiceWorkerRegistration | null = null;
let currentView:
  | 'dashboard'
  | 'workout'
  | 'routine'
  | 'progress'
  | 'photos'
  | 'nutrition'
  | 'supplements'
  | 'settings'
  | 'admin'
  | 'coach' = 'dashboard';
let selectedDay: DayKey = todayDayKey();
let workoutEntries: ExerciseEntry[] = [];
let workoutStartedAt: string | null = null;
let sessionClock: number | undefined;
let restClock: number | undefined;
let notificationUid = '';
let restNotificationsEnabled = false;
let activeCameraStop: (() => void) | undefined;
let unitsUid = '';
let unitSystem: UnitSystem = 'metric';
let advancedFieldsUid = '';
let showRirRpe = false;
let workoutPausedAt: number | null = null;
let workoutPausedMs = 0;
let sharedCatalogLoaded = false;
let coachVideosUid = '';
let coachVideoOverrides: Record<string, string> = {};
let routineBackOverride: (() => void) | null = null;

function asExternalUser(uid: string): User {
  return { uid } as User;
}

function resetWorkoutClock(): void {
  workoutPausedAt = null;
  workoutPausedMs = 0;
}

function sessionElapsedMs(now = Date.now()): number {
  if (!workoutStartedAt) return 0;
  const pausedNow = workoutPausedAt !== null ? now - workoutPausedAt : 0;
  return now - new Date(workoutStartedAt).getTime() - workoutPausedMs - pausedNow;
}

function startWorkoutSession(): void {
  if (workoutStartedAt) return;
  workoutStartedAt = new Date().toISOString();
  resetWorkoutClock();
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
    <button id="apple" class="secondary">${copy('apple')}</button>
    <button class="link-button" id="open-legal">${copy('legalTitle')}</button>
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
  document.querySelector('#apple')?.addEventListener('click', () => void runAuth(loginWithApple));
  document.querySelector('#forgot')?.addEventListener('click', () => void resetPassword());
  document.querySelector('#open-legal')?.addEventListener('click', () => renderLegal(renderAuth));
}

function renderLegal(onBack: () => void): void {
  const docs: { titleKey: MessageKey; bodyKey: MessageKey }[] = [
    { titleKey: 'legalTerms', bodyKey: 'legalTermsBody' },
    { titleKey: 'legalEula', bodyKey: 'legalEulaBody' },
    { titleKey: 'legalPrivacy', bodyKey: 'legalPrivacyBody' },
    { titleKey: 'legalCopyright', bodyKey: 'legalCopyrightBody' },
  ];
  shell(
    `<section class="feature-view"><button id="legal-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">KYRO</p><h1>${copy('legalTitle')}</h1><p class="hint">${copy('legalDraftNotice')}</p><div id="legal-docs"></div></section>`,
  );
  document.querySelector('#legal-back')?.addEventListener('click', onBack);
  const container = document.querySelector('#legal-docs');
  docs.forEach(({ titleKey, bodyKey }) => {
    const details = document.createElement('details');
    details.className = 'exercise-alternatives-accordion legal-doc';
    const summary = document.createElement('summary');
    summary.textContent = copy(titleKey);
    const body = document.createElement('div');
    body.className = 'legal-body';
    copy(bodyKey)
      .split('\n\n')
      .forEach((paragraph) => {
        const p = document.createElement('p');
        p.textContent = paragraph;
        body.append(p);
      });
    details.append(summary, body);
    container?.append(details);
  });
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
    const units: UnitSystem =
      new FormData(event.currentTarget as HTMLFormElement).get('units') === 'imperial'
        ? 'imperial'
        : 'metric';
    unitSystem = units;
    unitsUid = user.uid;
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
    {
      eyebrow: `01 · ${copy('moduleTrainLabel')}`,
      title: copy('train'),
      body: copy('trainModule'),
    },
    {
      eyebrow: `02 · ${copy('moduleRecoverLabel')}`,
      title: copy('progress'),
      body: copy('recoverModule'),
    },
    {
      eyebrow: `03 · ${copy('moduleFuelLabel')}`,
      title: copy('nutrition'),
      body: copy('fuelModule'),
    },
    {
      eyebrow: `04 · ${copy('moduleSyncLabel')}`,
      title: copy('settings'),
      body: copy('syncModule'),
    },
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
  if (unitsUid !== user.uid) {
    const savedUnits = await cacheGet<UnitSystem>(`units:${user.uid}`);
    unitSystem = savedUnits === 'imperial' ? 'imperial' : 'metric';
    unitsUid = user.uid;
  }
  if (advancedFieldsUid !== user.uid) {
    showRirRpe = (await cacheGet<boolean>(`showRirRpe:${user.uid}`)) === true;
    advancedFieldsUid = user.uid;
  }
  if (!sharedCatalogLoaded) {
    sharedCatalogLoaded = true;
    void loadSharedExerciseCatalog().catch((error: unknown) =>
      reportBackgroundError(error, 'catalog/shared-load'),
    );
  }
  if (coachVideosUid !== user.uid) {
    coachVideosUid = user.uid;
    void myCoach(user.uid)
      .then((link) => (link ? loadCoachVideos(link.coachUid) : {}))
      .then((videos) => {
        coachVideoOverrides = videos;
      })
      .catch((error: unknown) => reportBackgroundError(error, 'coach/videos-load'));
  }
  if (currentView === 'workout') await renderWorkout(user);
  else if (currentView === 'routine') await renderRoutine(user);
  else if (currentView === 'progress') await renderProgress(user);
  else if (currentView === 'photos') await renderPhotos(user);
  else if (currentView === 'nutrition') await renderNutrition(user);
  else if (currentView === 'supplements') await renderSupplements(user);
  else if (currentView === 'settings') await renderSettings(user);
  else if (currentView === 'admin') await renderAdmin(user);
  else if (currentView === 'coach') renderCoachHub(user);
  else renderDashboard(user);
}

function renderDashboard(user: User): void {
  shell(`<section class="hero"><p class="eyebrow">${copy('foundation')}</p><h1>${copy('tagline')}</h1>
    <p class="account-email">${copy('loggedInAs')}: <strong>${user.email ?? user.uid}</strong></p>
    <div class="status"><span id="network">${copy(navigator.onLine ? 'online' : 'offline')}</span><span>·</span><button id="open-sync" class="status-link">${copy('queue')}: <b id="queue-count">0</b></button></div>
    <button id="start-workout" class="primary">${copy('train')}</button>${authState.isAdmin ? `<button id="open-admin" class="secondary">${copy('admin')}</button>` : ''}${authState.isCoach ? `<button id="open-coach" class="secondary">${copy('coach')}</button>` : ''}<button id="logout" class="link-button">${copy('logout')}</button></section>
    <section class="feature-grid" aria-label="KYRO modules"><article><span>01</span><h2>${copy('moduleTrainLabel')}</h2><p>${copy('trainModule')}</p><button id="open-workout-card">${copy('train')}</button></article>
    <article><span>02</span><h2>${copy('moduleRecoverLabel')}</h2><p>${copy('recoverModule')}</p><button id="open-progress">${copy('progress')}</button></article><article><span>03</span><h2>${copy('moduleFuelLabel')}</h2><p>${copy('fuelModule')}</p><button id="open-nutrition">${copy('nutrition')}</button></article>
    <article><span>04</span><h2>${copy('moduleSyncLabel')}</h2><p>${copy('syncModule')}</p><button id="open-settings">${copy('settings')}</button></article></section>`);
  document
    .querySelector('#logout')
    ?.addEventListener(
      'click',
      () => void logout().catch((error: unknown) => reportError(error, 'auth/logout')),
    );
  const openWorkout = () => {
    currentView = 'workout';
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
  document.querySelector('#open-coach')?.addEventListener('click', () => {
    currentView = 'coach';
    renderCoachHub(user);
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
  void Promise.all([
    cacheGet<boolean>(`tour:${user.uid}`),
    cacheGet<boolean>(`spotlight-routine:${user.uid}`),
    loadUserData(user, 'workouts'),
  ])
    .then(([tourDone, spotlightDone, workouts]) => {
      const hasRoutine = Object.keys(workouts ?? {}).length > 0;
      if (
        !shouldShowRoutineSpotlight({
          tourDone: tourDone === true,
          spotlightDone: spotlightDone === true,
          hasRoutine,
        })
      )
        return;
      const target = document.querySelector<HTMLElement>('#open-workout-card');
      if (!target) return;
      showSpotlight(
        target,
        {
          title: copy('spotlightRoutineTitle'),
          body: copy('spotlightRoutineBody'),
          actionLabel: copy('spotlightGotIt'),
        },
        () => void cacheSet(`spotlight-routine:${user.uid}`, true),
      );
    })
    .catch((error: unknown) => reportError(error, 'dashboard/spotlight'));
}

async function renderAdmin(user: User): Promise<void> {
  const users = await listSharedUsers();
  const superAdmin = user.email?.toLowerCase() === 'rmagalhaes90@gmail.com';
  shell(
    `<section class="feature-view"><button id="feature-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">ADMIN</p><h1>${copy('users')}</h1><button id="admin-manage-exercises" class="secondary">${copy('manageExercises')}</button><div id="admin-users" class="history-list"></div></section>`,
  );
  bindBack(user);
  document
    .querySelector('#admin-manage-exercises')
    ?.addEventListener('click', () => renderExerciseManager(user));
  const list = document.querySelector('#admin-users');
  const runAdminAction = (promise: Promise<unknown>, code: string) =>
    void promise
      .then(() => renderAdmin(user))
      .catch((error: unknown) => {
        const isStaleUser =
          error !== null &&
          typeof error === 'object' &&
          'code' in error &&
          (error as { code?: unknown }).code === 'functions/not-found';
        if (isStaleUser) {
          // Target account no longer exists in Auth; the function already
          // deleted its stale sharedUsers doc, so just refresh the list.
          void renderAdmin(user);
          return;
        }
        reportError(error, code);
      });
  users.forEach((entry) => {
    const row = document.createElement('article');
    const identity = document.createElement('div');
    const email = document.createElement('strong');
    email.textContent = entry.email || entry.uid;
    const role = document.createElement('span');
    role.textContent = [entry.isAdmin ? 'admin' : '', entry.isCoach ? 'coach' : '']
      .filter(Boolean)
      .join(' · ');
    identity.append(email, role);
    const actions = document.createElement('div');
    const block = document.createElement('button');
    block.textContent = copy(entry.blocked ? 'unblock' : 'block');
    block.addEventListener('click', () =>
      runAdminAction(setUserBlocked(entry.uid, !entry.blocked), 'admin/block'),
    );
    actions.append(block);
    if (superAdmin && entry.uid !== user.uid) {
      const admin = document.createElement('button');
      admin.textContent = copy(entry.isAdmin ? 'revokeAdmin' : 'grantAdmin');
      admin.addEventListener('click', () =>
        runAdminAction(setUserAdmin(entry.uid, !entry.isAdmin), 'admin/role'),
      );
      actions.append(admin);
    }
    if (entry.uid !== user.uid) {
      const coach = document.createElement('button');
      coach.textContent = copy(entry.isCoach ? 'revokeCoach' : 'grantCoach');
      coach.addEventListener('click', () =>
        runAdminAction(setUserCoach(entry.uid, !entry.isCoach), 'admin/coach'),
      );
      actions.append(coach);
    }
    row.append(identity, actions);
    list?.append(row);
  });
}

function exerciseManagerBack(user: User): void {
  if (authState.isAdmin) {
    currentView = 'admin';
    void renderAdmin(user);
  } else {
    currentView = 'dashboard';
    renderDashboard(user);
  }
}

function parseMuscleWeights(text: string): Record<string, number> {
  const muscles: Record<string, number> = {};
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [key, value] = line.split(':').map((part) => part.trim());
      if (key && value && Number.isFinite(Number(value))) muscles[key] = Number(value);
    });
  return muscles;
}

function formatMuscleWeights(muscles: Record<string, number>): string {
  return Object.entries(muscles)
    .map(([key, value]) => `${key}:${value}`)
    .join('\n');
}

function closeExerciseEditor(): void {
  document.querySelector('.exercise-editor-modal')?.remove();
}

function openExerciseEditor(
  existing: Exercise | null,
  index: number | null,
  onSaved: () => void,
): void {
  closeExerciseEditor();
  const overlay = document.createElement('div');
  overlay.className = 'exercise-editor-modal';
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeExerciseEditor();
  });
  const card = document.createElement('form');
  card.className = 'exercise-editor-card';
  const title = document.createElement('h2');
  title.textContent = existing ? copy('editExercise') : copy('newExercise');

  const field = (labelKey: MessageKey, input: HTMLElement) => {
    const label = document.createElement('label');
    const span = document.createElement('span');
    span.textContent = copy(labelKey);
    label.append(span, input);
    return label;
  };

  const name = document.createElement('input');
  name.type = 'text';
  name.required = true;
  name.maxLength = 120;
  name.value = existing?.name ?? '';

  const equipment = document.createElement('select');
  (['', 'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'cardio'] as const).forEach(
    (value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value
        ? copy(`equip${value[0]?.toUpperCase()}${value.slice(1)}` as MessageKey)
        : '—';
      if (existing?.equipment === value) option.selected = true;
      equipment.append(option);
    },
  );

  const sets = document.createElement('input');
  sets.type = 'number';
  sets.min = '1';
  sets.max = '20';
  sets.value = String(existing?.sets ?? 4);

  const reps = document.createElement('input');
  reps.type = 'text';
  reps.maxLength = 20;
  reps.value = existing?.reps ?? '10';

  const rest = document.createElement('input');
  rest.type = 'number';
  rest.min = '0';
  rest.max = '1800';
  rest.value = String(existing?.rest ?? 90);

  const muscles = document.createElement('textarea');
  muscles.rows = 4;
  muscles.value = formatMuscleWeights(existing?.muscles ?? {});

  const videoUrl = document.createElement('input');
  videoUrl.type = 'url';
  videoUrl.maxLength = 2048;
  videoUrl.value = existing?.videoUrl ?? '';

  const videoUrlEn = document.createElement('input');
  videoUrlEn.type = 'url';
  videoUrlEn.maxLength = 2048;
  videoUrlEn.value = existing?.videoUrlEn ?? '';

  let linkedExerciseDbId = existing?.exerciseDbId ?? '';
  const mediaSection = document.createElement('div');
  mediaSection.className = 'exercise-media-picker';
  const mediaLabel = document.createElement('span');
  mediaLabel.textContent = copy('exampleMediaLabel');
  const mediaPreview = document.createElement('img');
  mediaPreview.className = 'exercise-media-preview';
  mediaPreview.hidden = true;
  const mediaStatus = document.createElement('p');
  mediaStatus.className = 'hint';
  const removeLink = document.createElement('button');
  removeLink.type = 'button';
  removeLink.className = 'link-button';
  removeLink.textContent = copy('removeExampleLink');
  removeLink.hidden = true;
  removeLink.addEventListener('click', () => {
    linkedExerciseDbId = '';
    mediaPreview.hidden = true;
    removeLink.hidden = true;
    mediaStatus.textContent = '';
  });
  const refreshMediaPreview = () => {
    if (!linkedExerciseDbId) return;
    mediaStatus.textContent = copy('exampleLinked');
    void getExerciseMedia(linkedExerciseDbId)
      .then((media) => {
        const src = media.gifUrl || media.imageUrl;
        if (src) {
          mediaPreview.src = src;
          mediaPreview.hidden = false;
        }
        removeLink.hidden = false;
      })
      .catch(() => {
        mediaStatus.textContent = '';
      });
  };
  refreshMediaPreview();
  const mediaSearchRow = document.createElement('div');
  mediaSearchRow.className = 'exercise-media-search';
  const mediaSearchInput = document.createElement('input');
  mediaSearchInput.type = 'text';
  mediaSearchInput.placeholder = copy('exampleSearchPlaceholder');
  const mediaSearchButton = document.createElement('button');
  mediaSearchButton.type = 'button';
  mediaSearchButton.textContent = copy('searchExampleMedia');
  const mediaResults = document.createElement('div');
  mediaResults.className = 'exercise-media-results';
  mediaSearchButton.addEventListener('click', () => {
    const query = mediaSearchInput.value.trim();
    if (!query) return;
    mediaResults.replaceChildren();
    mediaStatus.textContent = '';
    void searchExerciseMedia(query)
      .then((results) => {
        if (!results.length) mediaStatus.textContent = copy('noMediaResults');
        results.forEach((result) => {
          const resultButton = document.createElement('button');
          resultButton.type = 'button';
          resultButton.className = 'exercise-media-result';
          const thumb = document.createElement('img');
          thumb.src = result.imageUrl;
          thumb.loading = 'lazy';
          thumb.alt = result.name;
          const label = document.createElement('span');
          label.textContent = result.name;
          resultButton.append(thumb, label);
          resultButton.addEventListener('click', () => {
            linkedExerciseDbId = result.exerciseId;
            mediaResults.replaceChildren();
            refreshMediaPreview();
          });
          mediaResults.append(resultButton);
        });
      })
      .catch((error: unknown) => {
        mediaStatus.textContent = copy('mediaSearchFailed');
        reportError(error, 'catalog/media-search');
      });
  });
  mediaSearchRow.append(mediaSearchInput, mediaSearchButton);
  mediaSection.append(
    mediaLabel,
    mediaPreview,
    mediaStatus,
    removeLink,
    mediaSearchRow,
    mediaResults,
  );

  const notes = document.createElement('textarea');
  notes.rows = 3;
  notes.maxLength = 1000;
  notes.value = existing?.notes ?? '';

  const error = document.createElement('p');
  error.className = 'form-error';
  error.hidden = true;

  const actions = document.createElement('div');
  actions.className = 'exercise-editor-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = copy('cancel');
  cancel.addEventListener('click', () => closeExerciseEditor());
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'primary';
  submit.textContent = copy('save');
  actions.append(cancel, submit);

  card.append(
    title,
    field('exerciseName', name),
    field('equipmentLabel', equipment),
    field('sets', sets),
    field('reps', reps),
    field('rest', rest),
    field('muscleWeights', muscles),
    field('videoUrlPtLabel', videoUrl),
    field('videoUrlEnLabel', videoUrlEn),
    mediaSection,
    field('notes', notes),
    error,
    actions,
  );
  overlay.append(card);
  document.body.append(overlay);

  card.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = exerciseSchema.safeParse({
      name: name.value,
      sets: Number(sets.value),
      reps: reps.value,
      rest: Number(rest.value),
      equipment: equipment.value,
      muscles: parseMuscleWeights(muscles.value),
      videoUrl: videoUrl.value,
      videoUrlEn: videoUrlEn.value,
      exerciseDbId: linkedExerciseDbId,
      notes: notes.value,
    });
    if (!result.success) {
      error.textContent = result.error.issues[0]?.message ?? 'Invalid exercise';
      error.hidden = false;
      return;
    }
    const next = [...exerciseCatalog];
    if (index === null) next.push(result.data);
    else next[index] = result.data;
    void saveSharedExerciseCatalog(next)
      .then(() => {
        closeExerciseEditor();
        onSaved();
      })
      .catch((catchError: unknown) => {
        error.textContent = String(catchError);
        error.hidden = false;
        reportError(catchError, 'catalog/save');
      });
  });
}

function renderExerciseManager(user: User): void {
  shell(
    `<section class="feature-view"><button id="mgr-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">${exerciseCatalog.length}</p><h1>${copy('manageExercises')}</h1><input id="mgr-search" class="catalog-search" placeholder="${copy('search')}" autocomplete="off"><button id="mgr-add" class="secondary">+ ${copy('newExercise')}</button><button id="mgr-bulk-link" class="secondary">${copy('bulkLinkExamples')}</button><div id="mgr-list" class="catalog-list"></div><p id="mgr-status" class="hint" role="status"></p></section>`,
  );
  document.querySelector('#mgr-back')?.addEventListener('click', () => exerciseManagerBack(user));
  const draw = (query = '') => {
    const list = document.querySelector('#mgr-list');
    if (!list) return;
    list.replaceChildren();
    const normalized = query.trim().toLocaleLowerCase();
    exerciseCatalog
      .map((exercise, realIndex) => ({ exercise, realIndex }))
      .filter(
        ({ exercise }) => !normalized || exercise.name.toLocaleLowerCase().includes(normalized),
      )
      .forEach(({ exercise, realIndex }) => {
        const row = document.createElement('article');
        if (exercise.exerciseDbId) {
          const thumb = document.createElement('img');
          thumb.className = 'exercise-thumb';
          thumb.loading = 'lazy';
          thumb.alt = exercise.name;
          void getExerciseMedia(exercise.exerciseDbId)
            .then((media) => {
              if (media.imageUrl) thumb.src = media.imageUrl;
            })
            .catch(() => undefined);
          row.append(thumb);
        }
        const body = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = exercise.name;
        const meta = document.createElement('span');
        meta.textContent = `${exercise.equipment || '—'} · ${exercise.sets} × ${exercise.reps}`;
        body.append(name, meta);
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = copy('edit');
        edit.addEventListener('click', () =>
          openExerciseEditor(exercise, realIndex, () => {
            const status = document.querySelector('#mgr-status');
            if (status) status.textContent = copy('savedExercise');
            draw(query);
          }),
        );
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = copy('remove');
        remove.addEventListener('click', () => {
          if (!confirm(copy('deleteExerciseConfirm'))) return;
          const next = exerciseCatalog.filter((_, i) => i !== realIndex);
          void saveSharedExerciseCatalog(next)
            .then(() => draw(query))
            .catch((error: unknown) => reportError(error, 'catalog/delete'));
        });
        row.append(body, edit, remove);
        list.append(row);
      });
  };
  document.querySelector<HTMLInputElement>('#mgr-search')?.addEventListener('input', (event) => {
    draw((event.target as HTMLInputElement).value);
  });
  document.querySelector('#mgr-add')?.addEventListener('click', () =>
    openExerciseEditor(null, null, () => {
      const status = document.querySelector('#mgr-status');
      if (status) status.textContent = copy('savedExercise');
      draw();
    }),
  );
  document.querySelector<HTMLButtonElement>('#mgr-bulk-link')?.addEventListener('click', () => {
    const unlinked = exerciseCatalog.filter((exercise) => !exercise.exerciseDbId);
    const status = document.querySelector('#mgr-status');
    if (!unlinked.length) {
      if (status) status.textContent = copy('bulkLinkNoneLeft');
      return;
    }
    if (!confirm(copy('bulkLinkConfirm').replace('{count}', String(unlinked.length)))) return;
    const bulkButton = document.querySelector<HTMLButtonElement>('#mgr-bulk-link');
    if (bulkButton) bulkButton.disabled = true;
    void (async () => {
      const next = [...exerciseCatalog];
      let linked = 0;
      for (let i = 0; i < next.length; i += 1) {
        const exercise = next[i];
        if (!exercise || exercise.exerciseDbId) continue;
        if (status) status.textContent = `${copy('bulkLinking')} ${i + 1}/${next.length}`;
        try {
          const query = translateExerciseNameToEnglish(exercise.name);
          const results = await searchExerciseMedia(query);
          const bestMatch =
            (exercise.equipment &&
              results.find((result) =>
                result.name.toLocaleLowerCase().includes(exercise.equipment),
              )) ||
            results[0];
          if (bestMatch) {
            next[i] = { ...exercise, exerciseDbId: bestMatch.exerciseId };
            linked += 1;
          }
        } catch (error) {
          reportBackgroundError(error, 'catalog/bulk-link');
        }
        if ((i + 1) % 20 === 0) await saveSharedExerciseCatalog(next).catch(() => undefined);
        await new Promise((resolve) => window.setTimeout(resolve, 200));
      }
      await saveSharedExerciseCatalog(next).catch((error: unknown) =>
        reportError(error, 'catalog/bulk-link-save'),
      );
      if (bulkButton) bulkButton.disabled = false;
      if (status) status.textContent = `${copy('bulkLinkDone')} (${linked}/${unlinked.length})`;
      draw();
    })();
  });
  draw();
}

function renderCoachHub(user: User): void {
  shell(
    `<section class="feature-view"><button id="coach-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">COACH</p><h1>${copy('coachHub')}</h1><button id="coach-invite" class="secondary">${copy('generateInviteCode')}</button><p id="coach-invite-code" class="hint" role="status"></p><button id="coach-manage-exercises">${copy('manageExercises')}</button><button id="coach-manage-videos">${copy('myExerciseVideos')}</button><div id="coach-students" class="history-list"></div></section>`,
  );
  document.querySelector('#coach-back')?.addEventListener('click', () => {
    currentView = 'dashboard';
    renderDashboard(user);
  });
  document
    .querySelector('#coach-manage-exercises')
    ?.addEventListener('click', () => renderExerciseManager(user));
  document
    .querySelector('#coach-manage-videos')
    ?.addEventListener('click', () => renderCoachVideoManager(user));
  document.querySelector('#coach-invite')?.addEventListener('click', () => {
    void createInvite()
      .then(({ code }) => {
        const label = document.querySelector('#coach-invite-code');
        if (label)
          label.textContent = `${copy('inviteCodeLabel')}: ${code} — ${copy('inviteExpiresNote')}`;
      })
      .catch((error: unknown) => reportError(error, 'coach/invite'));
  });
  const list = document.querySelector('#coach-students');
  void listCoachStudents(user.uid)
    .then((students) => {
      if (!list) return;
      if (!students.length) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = copy('noStudentsYet');
        list.append(empty);
        return;
      }
      students.forEach((student) => {
        const row = document.createElement('article');
        const email = document.createElement('strong');
        email.textContent = student.email || student.uid;
        const actions = document.createElement('div');
        const buildRoutine = document.createElement('button');
        buildRoutine.textContent = copy('buildStudentRoutine');
        buildRoutine.addEventListener('click', () => {
          selectedDay = todayDayKey();
          routineBackOverride = () => renderCoachHub(user);
          void renderRoutine(asExternalUser(student.uid));
        });
        const viewProgress = document.createElement('button');
        viewProgress.textContent = copy('viewStudentProgress');
        viewProgress.addEventListener('click', () => void renderStudentProgress(user, student));
        actions.append(buildRoutine, viewProgress);
        row.append(email, actions);
        list.append(row);
      });
    })
    .catch((error: unknown) => reportError(error, 'coach/students'));
}

function renderCoachVideoManager(user: User): void {
  shell(
    `<section class="feature-view"><button id="coach-videos-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">COACH</p><h1>${copy('myExerciseVideos')}</h1><p class="hint">${copy('myExerciseVideosHint')}</p><input id="coach-videos-search" class="catalog-search" placeholder="${copy('search')}" autocomplete="off"><div id="coach-videos-list" class="catalog-list"></div></section>`,
  );
  document
    .querySelector('#coach-videos-back')
    ?.addEventListener('click', () => renderCoachHub(user));
  let overrides: Record<string, string> = {};
  const draw = (query = '') => {
    const list = document.querySelector('#coach-videos-list');
    if (!list) return;
    list.replaceChildren();
    const normalized = query.trim().toLocaleLowerCase();
    exerciseCatalog
      .filter((exercise) => !normalized || exercise.name.toLocaleLowerCase().includes(normalized))
      .slice(0, 100)
      .forEach((exercise) => {
        const row = document.createElement('article');
        const name = document.createElement('strong');
        name.textContent = exercise.name;
        const input = document.createElement('input');
        input.type = 'url';
        input.placeholder = copy('videoUrlPtLabel');
        input.value = overrides[exercise.name] ?? '';
        const save = document.createElement('button');
        save.type = 'button';
        save.textContent = copy('save');
        const status = document.createElement('small');
        save.addEventListener('click', () => {
          const trimmed = input.value.trim();
          void saveCoachVideo(user.uid, exercise.name, trimmed)
            .then(() => {
              overrides = { ...overrides };
              if (trimmed) overrides[exercise.name] = trimmed;
              else delete overrides[exercise.name];
              coachVideoOverrides = overrides;
              status.textContent = copy('profileSaved');
            })
            .catch((error: unknown) => reportError(error, 'coach/video-save'));
        });
        row.append(name, input, save, status);
        list.append(row);
      });
  };
  void loadCoachVideos(user.uid).then((videos) => {
    overrides = videos;
    draw();
  });
  document
    .querySelector<HTMLInputElement>('#coach-videos-search')
    ?.addEventListener('input', (event) => {
      draw((event.target as HTMLInputElement).value);
    });
}

async function renderStudentProgress(coachUser: User, student: CoachStudent): Promise<void> {
  const studentUser = asExternalUser(student.uid);
  const [weights, sessions, records] = await Promise.all([
    loadUserData(studentUser, 'bodyWeights').then((value) => value ?? []),
    loadUserData(studentUser, 'sessionLog').then((value) => value ?? []),
    loadUserData(studentUser, 'exerciseRecords').then((value) => value ?? {}),
  ]);
  shell(
    `<section class="feature-view"><button id="student-progress-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">COACH · ${student.email || student.uid}</p><h1>${copy('progress')}</h1><div id="student-progress-body"></div></section>`,
  );
  document
    .querySelector('#student-progress-back')
    ?.addEventListener('click', () => renderCoachHub(coachUser));
  const body = document.querySelector('#student-progress-body');
  if (!body) return;

  const weightCard = document.createElement('article');
  const weightTitle = document.createElement('h2');
  weightTitle.textContent = copy('bodyWeight');
  const weightValue = document.createElement('p');
  const latestWeight = weights.at(-1);
  weightValue.textContent = latestWeight
    ? `${latestWeight.kg} kg · ${latestWeight.d}`
    : copy('noData');
  weightCard.append(weightTitle, weightValue);
  body.append(weightCard);

  const sessionsCard = document.createElement('article');
  const sessionsTitle = document.createElement('h2');
  sessionsTitle.textContent = copy('sessions');
  sessionsCard.append(sessionsTitle);
  const recentSessions = sessions.slice(-5).reverse();
  if (!recentSessions.length) {
    const empty = document.createElement('p');
    empty.textContent = copy('noData');
    sessionsCard.append(empty);
  } else {
    recentSessions.forEach((session) => {
      const row = document.createElement('p');
      const duration = session.durationSec ? `${Math.round(session.durationSec / 60)} min` : '—';
      row.textContent = `${session.date} · ${session.title} · ${duration} · ${Math.round(session.volume)} kg`;
      sessionsCard.append(row);
    });
  }
  body.append(sessionsCard);

  const recordsCard = document.createElement('article');
  const recordsTitle = document.createElement('h2');
  recordsTitle.textContent = copy('records');
  recordsCard.append(recordsTitle);
  const topRecords = Object.entries(records)
    .sort((a, b) => b[1].maxE1rm - a[1].maxE1rm)
    .slice(0, 8);
  if (!topRecords.length) {
    const empty = document.createElement('p');
    empty.textContent = copy('noData');
    recordsCard.append(empty);
  } else {
    topRecords.forEach(([name, record]) => {
      const row = document.createElement('p');
      row.textContent = `${name} · ${record.maxWeight} kg × ${record.maxWeightReps} · e1RM ${Math.round(record.maxE1rm)} kg`;
      recordsCard.append(row);
    });
  }
  body.append(recordsCard);
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
    unitSystem,
    onUnitSystemChange: (units) => {
      unitSystem = units;
      void cacheSet(`units:${user.uid}`, units);
    },
    onOpenLegal: () => renderLegal(() => void renderSettings(user)),
    showRirRpe,
    onShowRirRpeChange: (show) => {
      showRirRpe = show;
      void cacheSet(`showRirRpe:${user.uid}`, show);
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
  const weightUnit = weightUnitLabel(unitSystem);
  const lengthUnit = lengthUnitLabel(unitSystem);
  const weightBound = (kg: number) => displayWeight(kg, unitSystem, 0);
  const lengthBound = (cm: number) => displayLength(cm, unitSystem, 0);
  const measurementField = (key: MeasurementKey, min: number, max: number) =>
    `<label>${copy(key)} (${lengthUnit})<input name="${key}" type="number" min="${lengthBound(min)}" max="${lengthBound(max)}" step="0.1"></label>`;
  shell(`<section class="feature-view"><button id="feature-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">02 · ${copy('moduleRecoverLabel')}</p><h1>${copy('progress')}</h1>
    <div class="metric-grid"><article><span>${copy('weight')}</span><strong id="latest-weight">—</strong><small id="weight-delta"></small></article><article><span>${copy('readiness')}</span><strong id="readiness-score">—</strong><small id="readiness-class"></small></article><article><span>${copy('history')}</span><strong>${sessions.length}</strong></article></div>
    <div id="weight-chart" class="progress-chart" aria-label="${copy('weightChart')}"></div><form id="weight-form" class="compact-form"><label>${copy('weight')} (${weightUnit})<input id="weight-input" type="number" min="${weightBound(1)}" max="${weightBound(1000)}" step="0.1" required></label><button class="primary">${copy('add')}</button></form><section><h2>${copy('measurementTrends')}</h2><div id="measurement-charts" class="measurement-charts"></div></section>
    <form id="measurements-form" class="measurements-form">${measurementField('waist', 20, 300)}${measurementField('chest', 20, 300)}${measurementField('arm', 10, 150)}${measurementField('hip', 20, 300)}${measurementField('thigh', 10, 200)}<button class="primary">${copy('saveMeasurements')}</button></form>
    <form id="readiness-form" class="readiness-form">${(['sleep', 'energy', 'soreness', 'stress'] as const).map((key) => `<label>${copy(key)}<input name="${key}" type="range" min="1" max="5" value="3"></label>`).join('')}<label>${copy('readinessOverride')}<select name="override"><option value="">${copy('automatic')}</option>${(['high', 'normal', 'reduce', 'light', 'rest'] as const).map((value) => `<option value="${value}">${copy(`readiness_${value}` as MessageKey)}</option>`).join('')}</select></label><label>${copy('overrideReason')}<input name="overrideReason" maxlength="300"></label><button class="primary">${copy('save')}</button></form>
    <section class="training-analytics"><h2>${copy('trainingAnalytics')}</h2><article><strong id="readiness-correlation">—</strong><span>${copy('readinessCorrelation')}</span><small id="correlation-samples"></small></article><div id="muscle-volume" class="muscle-volume"></div></section><section class="weekly-report"><h2>${copy('weeklyReport')}</h2><div><article><strong>${report.sessions}</strong><span>${copy('sessions')}</span></article><article><strong>${Math.round(report.volume)}</strong><span>${copy('volume')}</span></article><article><strong>${Math.round(report.minutes)}</strong><span>${copy('minutes')}</span></article><article><strong>${streak}</strong><span>${copy('streak')}</span></article></div><button id="share-report">${copy('shareReport')}</button></section><section><h2>${copy('achievements')}</h2><div id="achievement-list" class="achievement-list"></div></section><button id="open-photos" class="secondary">${copy('progressPhotos')}</button><div id="session-history" class="history-list"></div></section>`);
  const weightTarget = document.querySelector('#latest-weight');
  if (weightTarget)
    weightTarget.textContent = latest
      ? `${displayWeight(latest.kg, unitSystem)} ${weightUnit}`
      : '—';
  const deltaTarget = document.querySelector('#weight-delta');
  if (deltaTarget) {
    const displayDelta = delta === null ? null : displayWeight(delta, unitSystem);
    deltaTarget.textContent =
      displayDelta === null ? '' : `${displayDelta >= 0 ? '+' : ''}${displayDelta} ${weightUnit}`;
  }
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
    weights.map((item) => ({ d: item.d, value: displayWeight(item.kg, unitSystem) })),
  );
  const measurementCharts = document.querySelector('#measurement-charts');
  (['waist', 'chest', 'arm', 'hip', 'thigh'] as MeasurementKey[]).forEach((key) => {
    const series = measurementSeries(measurements, key);
    const displaySeries = series.map((point) => ({
      ...point,
      value: displayLength(point.value, unitSystem),
    }));
    const card = document.createElement('article');
    const heading = document.createElement('h3');
    heading.textContent = `${copy(key)} (${lengthUnit})`;
    const delta = document.createElement('small');
    const change = seriesDelta(series);
    const displayChange = change === null ? null : displayLength(change, unitSystem);
    delta.textContent =
      displayChange === null
        ? copy('insufficientTrend')
        : `${displayChange >= 0 ? '+' : ''}${displayChange} ${lengthUnit}`;
    const chart = document.createElement('div');
    chart.className = 'progress-chart compact';
    chart.ariaLabel = `${copy(key)} · ${copy('measurementTrends')}`;
    card.append(heading, delta, chart);
    measurementCharts?.append(card);
    drawProgressChart(chart, displaySeries);
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
    const typed = Number(input?.value);
    if (!Number.isFinite(typed) || typed <= 0) return;
    const kg = parseWeightInput(typed, unitSystem);
    if (kg <= 0 || kg > 1000) return;
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
        const typed = Number(data.get(key));
        if (!Number.isFinite(typed) || typed <= 0) return [];
        const cm = parseLengthInput(typed, unitSystem);
        return cm > 0 ? [[key, cm]] : [];
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
  shell(`<section class="feature-view"><button id="feature-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">03 · ${copy('moduleFuelLabel')}</p><h1>${copy('nutrition')}</h1>
    <div class="metric-grid nutrition-metrics"><article><span>${copy('calories')}</span><strong>${Math.round(day.kcal)}</strong><small>${Math.round(percentage(day.kcal, day.kcalGoal))}%</small></article><article><span>${copy('protein')}</span><strong>${Math.round(day.protein)}g</strong><small>${Math.round(percentage(day.protein, day.proteinGoal))}%</small></article><article><span>${copy('fiber')}</span><strong>${Math.round(day.fiber)}g</strong><small>${Math.round(percentage(day.fiber, day.fiberGoal))}%</small></article><article><span>${copy('water')}</span><strong>${day.water.toFixed(2)}L</strong><button id="add-water">+ 250ml</button></article></div><button id="open-supplements" class="secondary">${copy('supplements')}</button><form id="barcode-form" class="barcode-form"><label>${copy('barcode')}<input name="barcode" inputmode="numeric" pattern="[0-9]{8,14}" maxlength="14" required></label><button type="submit">${copy('lookup')}</button><button type="button" id="scan-barcode" ${barcodeCameraSupported() ? '' : 'disabled'}>${copy('scanBarcode')}</button><video id="barcode-video" hidden muted></video><span id="barcode-status" role="status"></span></form>
    <form id="meal-form" class="meal-form"><label>${copy('mealName')}<input name="name" maxlength="120" required></label><label>${copy('calories')}<input name="kcal" type="number" min="0" max="10000" required></label><label>${copy('protein')}<input name="protein" type="number" min="0" max="1000" step="0.1"></label><label>${copy('carbs')}<input name="carb" type="number" min="0" max="1000" step="0.1"></label><label>${copy('fat')}<input name="fat" type="number" min="0" max="1000" step="0.1"></label><label>${copy('fiber')}<input name="fiber" type="number" min="0" max="1000" step="0.1"></label><button class="primary">${copy('add')} ${copy('meal')}</button></form>
    <section class="nutrition-copy"><h2>${copy('copyMeals')}</h2><label>${copy('targetDate')}<input id="nutrition-target-date" type="date" value="${today}"></label><button id="duplicate-day" class="secondary">${copy('duplicateDay')}</button><p id="nutrition-copy-status" role="status"></p></section><section><h2>${copy('favoriteMeals')}</h2><div id="favorite-meals" class="history-list"></div></section><div id="meal-list" class="history-list"></div></section>`);
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
    `<section class="feature-view"><button id="supp-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">${progress.taken}/${progress.total} ${copy('taken')}</p><h1>${copy('supplements')}</h1><div id="my-supplements" class="supplement-list"></div><h2>${copy('addSupplement')}</h2><input id="supp-search" class="catalog-search" placeholder="${copy('searchSupplement')}"><div id="supp-catalog" class="catalog-list"></div></section>`,
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
  const [workoutsValue, draft, exerciseHistory, progressionDecisions, exerciseRecords] =
    await Promise.all([
      loadUserData(user, 'workouts'),
      loadWorkoutDraft(user, selectedDay),
      loadUserData(user, 'exerciseHistory').catch(() => null),
      loadUserData(user, 'progressionDecisions').catch(() => null),
      loadUserData(user, 'exerciseRecords').catch(() => null),
    ]);
  const workouts = workoutsValue ?? {};
  if (!workouts[selectedDay]) {
    renderWorkoutEmptyState(user, workouts);
    return;
  }
  const freshEntries = createEntries(workouts, selectedDay);
  const draftMatches =
    draft &&
    draft.entries.map((item) => item.exercise.name).join('\n') ===
      freshEntries.map((item) => item.exercise.name).join('\n');
  workoutEntries = draftMatches ? draft.entries : freshEntries;
  workoutStartedAt = draftMatches ? draft.startedAt : null;
  resetWorkoutClock();
  shell(`<section class="workout-view"><button id="workout-back" class="link-button">← ${copy('back')}</button><div class="days" id="days"></div>
    <header class="workout-heading"><p class="eyebrow">${dateKey()}</p><h1 id="workout-title"></h1><div class="session-clock"><span>${copy('sessionTime')}</span><strong id="session-clock">00:00:00</strong><button id="session-toggle" type="button"></button></div><button id="edit-routine" class="link-button">${copy('editRoutineTitle')}</button></header><div id="exercise-list"></div><aside id="rest-timer" class="rest-timer" hidden></aside>
    <button id="finish-workout" class="primary" ${workoutEntries.length ? '' : 'disabled'}>${copy('finishWorkout')}</button><p id="workout-status" class="hint" role="status"></p></section>`);
  const title = document.querySelector('#workout-title');
  if (title) title.textContent = localizedDayTitle(workouts[selectedDay]);
  if (draftMatches) {
    const status = document.querySelector('#workout-status');
    if (status) status.textContent = copy('sessionResumed');
  }
  renderDayButtons(user, workouts);
  renderExerciseEntries(
    user,
    workouts,
    exerciseHistory ?? {},
    progressionDecisions ?? [],
    exerciseRecords ?? {},
  );
  const toggleButton = document.querySelector<HTMLButtonElement>('#session-toggle');
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
    if (toggleButton)
      toggleButton.textContent = copy(
        !workoutStartedAt ? 'startWorkout' : workoutPausedAt !== null ? 'resume' : 'pause',
      );
  };
  updateClock();
  sessionClock = window.setInterval(updateClock, 1000);
  toggleButton?.addEventListener('click', () => {
    if (!workoutStartedAt) {
      startWorkoutSession();
    } else if (workoutPausedAt !== null) {
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
  document.querySelector('#edit-routine')?.addEventListener('click', () => {
    clearWorkoutTimers();
    currentView = 'routine';
    void renderRoutine(user);
  });
}

function renderWorkoutEmptyState(user: User, workouts: Workouts): void {
  const weekEmpty = dayKeys.every((day) => !workouts[day]);
  const dayLabel = selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1);
  shell(
    `<section class="workout-view"><button id="workout-back" class="link-button">← ${copy('back')}</button><div class="days" id="days"></div>
    ${
      weekEmpty
        ? `<div class="empty-state onboard-card"><p class="onboard-title">👋 ${copy('welcomeTitle')}</p><p class="onboard-sub">${copy('welcomeSub')}</p><div class="onboard-actions"><button id="onboard-autogen" class="primary">${copy('autoGenerate')}</button><button id="onboard-template">${copy('templates')}</button><button id="onboard-manual">${copy('buildManually')}</button></div></div>`
        : `<div class="empty-state"><p>${copy('emptyRoutineForDay').replace('{day}', dayLabel)}</p><button id="go-create-routine" class="primary">${copy('createRoutineForDay')}</button></div>`
    }</section>`,
  );
  renderDayButtons(user, workouts, () => void renderWorkout(user));
  document.querySelector('#workout-back')?.addEventListener('click', () => {
    currentView = 'dashboard';
    renderDashboard(user);
  });
  const goRoutine = () => {
    currentView = 'routine';
    void renderRoutine(user);
  };
  document.querySelector('#onboard-autogen')?.addEventListener('click', () => {
    currentView = 'routine';
    renderWorkoutGenerator(user, workouts);
  });
  document.querySelector('#onboard-template')?.addEventListener('click', () => {
    currentView = 'routine';
    renderTemplatePicker(user, workouts);
  });
  document.querySelector('#onboard-manual')?.addEventListener('click', goRoutine);
  document.querySelector('#go-create-routine')?.addEventListener('click', goRoutine);
}

async function renderRoutine(user: User): Promise<void> {
  const workoutsValue = await loadUserData(user, 'workouts');
  const workouts = workoutsValue ?? {};
  shell(`<section class="workout-view"><button id="routine-back" class="link-button">← ${copy('back')}</button><div class="days" id="days"></div>
    <header class="workout-heading"><p class="eyebrow">${copy('routineExercises')}</p><h1 id="routine-title"></h1><div class="routine-actions"><button id="rename-routine">${copy('renameRoutine')}</button><button id="add-exercise">+ ${copy('addExercise')}</button><button id="routine-template">${copy('templates')}</button><button id="routine-autogen">${copy('autoGenerate')}</button></div></header><div id="routine-exercise-list"></div></section>`);
  const title = document.querySelector('#routine-title');
  if (title) title.textContent = localizedDayTitle(workouts[selectedDay]);
  renderDayButtons(user, workouts, () => void renderRoutine(user));
  renderRoutineExercises(user, workouts);
  document.querySelector('#routine-back')?.addEventListener('click', () => {
    if (routineBackOverride) {
      const back = routineBackOverride;
      routineBackOverride = null;
      back();
      return;
    }
    currentView = 'workout';
    void renderWorkout(user);
  });
  document
    .querySelector('#add-exercise')
    ?.addEventListener('click', () => renderExerciseCatalog(user, workouts));
  document
    .querySelector('#routine-template')
    ?.addEventListener('click', () => renderTemplatePicker(user, workouts));
  document
    .querySelector('#routine-autogen')
    ?.addEventListener('click', () => renderWorkoutGenerator(user, workouts));
  document.querySelector('#rename-routine')?.addEventListener('click', () => {
    const currentDay = workouts[selectedDay];
    const newTitle = prompt(copy('routineName'), currentDay ? localizedDayTitle(currentDay) : '');
    if (newTitle?.trim()) {
      const current = workouts[selectedDay] ?? {
        title: selectedDay,
        titleEn: '',
        cardioNote: '',
        exercises: [],
        abs: [],
      };
      const trimmed = newTitle.trim().slice(0, 80);
      void saveUserData(user, 'workouts', {
        ...workouts,
        [selectedDay]: { ...current, title: trimmed, titleEn: trimmed },
      })
        .then(() => renderRoutine(user))
        .catch((error: unknown) => reportError(error, 'workout/rename'));
    }
  });
}

function renderRoutineExercises(user: User, workouts: Workouts): void {
  const list = document.querySelector('#routine-exercise-list');
  if (!list) return;
  const exercises = workouts[selectedDay]?.exercises ?? [];
  if (!exercises.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = copy('noWorkout');
    list.append(empty);
    return;
  }
  exercises.forEach((exercise, exerciseIndex) => {
    const card = document.createElement('article');
    card.className = 'exercise-card';
    const topWrap = document.createElement('div');
    topWrap.className = 'exercise-top-wrap';
    const top = document.createElement('div');
    top.className = 'exercise-top';
    const heading = document.createElement('h2');
    heading.textContent = exercise.name;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'exercise-top-delete';
    remove.textContent = copy('remove');
    remove.addEventListener('click', () => {
      const current = workouts[selectedDay];
      if (!current) return;
      void saveUserData(user, 'workouts', {
        ...workouts,
        [selectedDay]: {
          ...current,
          exercises: current.exercises.filter((_, index) => index !== exerciseIndex),
        },
      })
        .then(() => clearWorkoutDraft(user, selectedDay))
        .then(() => renderRoutine(user))
        .catch((error: unknown) => reportError(error, 'workout/remove'));
    });
    top.append(heading);
    topWrap.append(top, remove);
    card.append(topWrap);
    attachSwipeToDelete(top, '.exercise-top.swiped');
    const meta = document.createElement('div');
    meta.className = 'exercise-meta';
    const updateTarget = (patch: Partial<Pick<Exercise, 'sets' | 'reps' | 'rest'>>) => {
      const current = workouts[selectedDay];
      if (!current) return;
      const nextExercises = current.exercises.map((item, index) =>
        index === exerciseIndex ? { ...item, ...patch } : item,
      );
      void saveUserData(user, 'workouts', {
        ...workouts,
        [selectedDay]: { ...current, exercises: nextExercises },
      })
        .then(() => clearWorkoutDraft(user, selectedDay))
        .then(() => renderRoutine(user))
        .catch((error: unknown) => reportError(error, 'workout/edit-target'));
    };
    const setsInput = document.createElement('input');
    setsInput.type = 'number';
    setsInput.min = '1';
    setsInput.max = '20';
    setsInput.step = '1';
    setsInput.value = String(exercise.sets);
    setsInput.ariaLabel = copy('sets');
    setsInput.addEventListener('change', () =>
      updateTarget({ sets: Math.min(20, Math.max(1, Math.round(Number(setsInput.value)) || 1)) }),
    );
    const repsInput = document.createElement('input');
    repsInput.type = 'text';
    repsInput.maxLength = 20;
    repsInput.value = exercise.reps;
    repsInput.ariaLabel = copy('reps');
    repsInput.addEventListener('change', () =>
      updateTarget({ reps: repsInput.value.trim().slice(0, 20) || '10' }),
    );
    const restInput = document.createElement('input');
    restInput.type = 'number';
    restInput.min = '0';
    restInput.max = '1800';
    restInput.step = '5';
    restInput.value = String(exercise.rest);
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
    list.append(card);
  });
}

function renderTemplatePicker(user: User, workouts: Workouts): void {
  shell(
    `<section class="feature-view"><button id="template-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">KYRO BUILDER</p><h1>${copy('chooseTemplate')}</h1><div id="template-list" class="template-list"></div></section>`,
  );
  document
    .querySelector('#template-back')
    ?.addEventListener('click', () => void renderRoutine(user));
  const list = document.querySelector('#template-list');
  (
    ['fullbody', 'upperLower', 'ppl', 'pplUpperLower', 'broSplit', 'fullBody5x'] as TemplateKey[]
  ).forEach((key) => {
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
          return renderRoutine(user);
        })
        .catch((error: unknown) => reportError(error, 'workout/template'));
    });
    card.append(title, description, apply);
    list?.append(card);
  });
}

const muscleGroupKeys: MuscleGroupKey[] = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'abs',
  'push',
  'pull',
  'fullbody',
];
const muscleGroupLabels: Record<MuscleGroupKey, MessageKey> = {
  chest: 'genChest',
  back: 'genBack',
  legs: 'genLegs',
  shoulders: 'genShoulders',
  arms: 'genArms',
  abs: 'genAbsGroup',
  push: 'genPush',
  pull: 'genPull',
  fullbody: 'genFullBody',
};
const equipmentKeys: Exercise['equipment'][] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'cardio',
];
const equipmentLabels: Record<string, MessageKey> = {
  barbell: 'equipBarbell',
  dumbbell: 'equipDumbbell',
  machine: 'equipMachine',
  cable: 'equipCable',
  bodyweight: 'equipBodyweight',
  cardio: 'equipCardio',
};

/** Guesses which muscle group a routine day is for, from its exercises (or failing that, its title), so the "add exercise" picker can default to a sensible filter. */
function guessDayMuscleGroups(day: Workouts[keyof Workouts]): MuscleGroupKey[] {
  if (day?.exercises.length) {
    const muscleTotals = new Map<string, number>();
    day.exercises.forEach((exercise) => {
      Object.entries(exercise.muscles).forEach(([muscle, value]) => {
        muscleTotals.set(muscle, (muscleTotals.get(muscle) ?? 0) + value);
      });
    });
    const best = muscleGroupKeys
      .map((key) => ({
        key,
        score: MUSCLE_GROUPS[key].reduce((sum, muscle) => sum + (muscleTotals.get(muscle) ?? 0), 0),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)[0];
    if (best) return [best.key];
  }
  const title = `${day?.title ?? ''} ${day?.titleEn ?? ''}`.toLocaleLowerCase();
  const keywordMap: [RegExp, MuscleGroupKey][] = [
    [/push/, 'push'],
    [/pull/, 'pull'],
    [/peito|chest/, 'chest'],
    [/costas|back/, 'back'],
    [/perna|legs/, 'legs'],
    [/ombro|shoulder/, 'shoulders'],
    [/braç|arms/, 'arms'],
    [/abd|abs\b/, 'abs'],
    [/corpo inteiro|full ?body/, 'fullbody'],
  ];
  const match = keywordMap.find(([regex]) => regex.test(title));
  return match ? [match[1]] : [];
}

function renderWorkoutGenerator(user: User, workouts: Workouts): void {
  const groupKeys = muscleGroupKeys;
  const groupLabels = muscleGroupLabels;
  const intensityKeys: IntensityKey[] = ['light', 'medium', 'heavy'];
  const intensityLabels: Record<IntensityKey, { title: MessageKey; desc: MessageKey }> = {
    light: { title: 'genLight', desc: 'genLightDesc' },
    medium: { title: 'genMedium', desc: 'genMediumDesc' },
    heavy: { title: 'genHeavy', desc: 'genHeavyDesc' },
  };

  const selectedGroups = new Set<MuscleGroupKey>();
  const selectedEquipment = new Set<Exercise['equipment']>();
  let selectedIntensity: IntensityKey | null = null;
  let preview: ReturnType<typeof generateWorkout> | null = null;

  shell(
    `<section class="feature-view"><button id="gen-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">KYRO BUILDER</p><h1>${copy('autoGenerate')}</h1><div id="gen-body"></div></section>`,
  );
  document.querySelector('#gen-back')?.addEventListener('click', () => void renderRoutine(user));

  const renderBody = () => {
    const body = document.querySelector('#gen-body');
    if (!body) return;
    body.replaceChildren();

    const groupsSection = document.createElement('section');
    const groupsHeading = document.createElement('h2');
    groupsHeading.textContent = copy('genGroups');
    const groupsGrid = document.createElement('div');
    groupsGrid.className = 'chip-grid';
    groupKeys.forEach((key) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = copy(groupLabels[key]);
      chip.ariaPressed = String(selectedGroups.has(key));
      chip.addEventListener('click', () => {
        if (selectedGroups.has(key)) selectedGroups.delete(key);
        else selectedGroups.add(key);
        preview = null;
        renderBody();
      });
      groupsGrid.append(chip);
    });
    groupsSection.append(groupsHeading, groupsGrid);
    body.append(groupsSection);

    const equipmentSection = document.createElement('section');
    const equipmentHeading = document.createElement('h2');
    equipmentHeading.textContent = copy('genEquipment');
    const equipmentGrid = document.createElement('div');
    equipmentGrid.className = 'chip-grid';
    equipmentKeys.forEach((key) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = copy(equipmentLabels[key] ?? 'equipBarbell');
      chip.ariaPressed = String(selectedEquipment.has(key));
      chip.addEventListener('click', () => {
        if (selectedEquipment.has(key)) selectedEquipment.delete(key);
        else selectedEquipment.add(key);
        preview = null;
        renderBody();
      });
      equipmentGrid.append(chip);
    });
    equipmentSection.append(equipmentHeading, equipmentGrid);
    body.append(equipmentSection);

    const intensitySection = document.createElement('section');
    const intensityHeading = document.createElement('h2');
    intensityHeading.textContent = copy('genIntensity');
    const intensityGrid = document.createElement('div');
    intensityGrid.className = 'intensity-grid';
    intensityKeys.forEach((key) => {
      const button = document.createElement('button');
      button.type = 'button';
      const title = document.createElement('strong');
      title.textContent = copy(intensityLabels[key].title);
      const desc = document.createElement('small');
      desc.textContent = copy(intensityLabels[key].desc);
      button.append(title, desc);
      button.ariaPressed = String(selectedIntensity === key);
      button.addEventListener('click', () => {
        selectedIntensity = key;
        preview = null;
        renderBody();
      });
      intensityGrid.append(button);
    });
    intensitySection.append(intensityHeading, intensityGrid);
    body.append(intensitySection);

    if (!preview && selectedGroups.size && selectedIntensity) {
      preview = generateWorkout([...selectedGroups], selectedIntensity, [...selectedEquipment]);
    }

    if (preview) {
      const previewSection = document.createElement('section');
      const previewHeading = document.createElement('h2');
      previewHeading.textContent = copy('genPreview');
      previewSection.append(previewHeading);
      [...preview.exercises, ...preview.abs].forEach((exercise) => {
        const row = document.createElement('p');
        row.textContent = `${exercise.name} — ${exercise.sets} × ${exercise.reps}`;
        previewSection.append(row);
      });
      const actions = document.createElement('div');
      const reroll = document.createElement('button');
      reroll.type = 'button';
      reroll.textContent = copy('genReroll');
      reroll.addEventListener('click', () => {
        preview = generateWorkout([...selectedGroups], selectedIntensity as IntensityKey, [
          ...selectedEquipment,
        ]);
        renderBody();
      });
      const apply = document.createElement('button');
      apply.type = 'button';
      apply.className = 'primary';
      apply.textContent = copy('genApply');
      apply.addEventListener('click', () => {
        if (!confirm(copy('genConfirm')) || !preview) return;
        const labelText = (locale: Locale) =>
          [...selectedGroups]
            .map((key) => messageFor(locale, groupLabels[key]))
            .join(' + ')
            .slice(0, 80);
        const generated = {
          ...preview,
          title: labelText('pt'),
          titleEn: labelText('en'),
        };
        void saveUserData(user, 'workouts', { ...workouts, [selectedDay]: generated })
          .then(() => clearWorkoutDraft(user, selectedDay))
          .then(() => renderRoutine(user))
          .catch((error: unknown) => reportError(error, 'workout/generate'));
      });
      actions.append(reroll, apply);
      previewSection.append(actions);
      body.append(previewSection);
    } else if (selectedGroups.size || selectedIntensity) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = copy('genEmpty');
      body.append(hint);
    }
  };
  renderBody();
  void loadUserData(user, 'profile').then((profile) => {
    if (selectedIntensity || !profile) return;
    const suggested: Record<Profile['goal'], IntensityKey> = {
      hypertrophy: 'medium',
      fatLoss: 'medium',
      strength: 'heavy',
      endurance: 'light',
      general: 'medium',
    };
    selectedIntensity = suggested[profile.goal];
    renderBody();
  });
}

function renderExerciseCatalog(user: User, workouts: Workouts): void {
  const selectedGroups = new Set<MuscleGroupKey>(guessDayMuscleGroups(workouts[selectedDay]));
  const selectedEquipment = new Set<Exercise['equipment']>();
  shell(
    `<section class="feature-view"><button id="catalog-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">CATALOG · ${exerciseCatalog.length}</p><h1>${copy('addExercise')}</h1><input id="catalog-search" class="catalog-search" placeholder="${copy('search')}" autocomplete="off"><div id="catalog-filters"></div><div id="catalog-list" class="catalog-list"></div></section>`,
  );
  const currentQuery = () =>
    document.querySelector<HTMLInputElement>('#catalog-search')?.value ?? '';
  const renderFilters = () => {
    const filters = document.querySelector('#catalog-filters');
    if (!filters) return;
    filters.replaceChildren();
    const groupsHeading = document.createElement('h2');
    groupsHeading.textContent = copy('genGroups');
    const groupsGrid = document.createElement('div');
    groupsGrid.className = 'chip-grid';
    muscleGroupKeys.forEach((key) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = copy(muscleGroupLabels[key]);
      chip.ariaPressed = String(selectedGroups.has(key));
      chip.addEventListener('click', () => {
        if (selectedGroups.has(key)) selectedGroups.delete(key);
        else selectedGroups.add(key);
        renderFilters();
        draw(currentQuery());
      });
      groupsGrid.append(chip);
    });
    const equipmentHeading = document.createElement('h2');
    equipmentHeading.textContent = copy('genEquipment');
    const equipmentGrid = document.createElement('div');
    equipmentGrid.className = 'chip-grid';
    equipmentKeys.forEach((key) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = copy(equipmentLabels[key] ?? 'equipBarbell');
      chip.ariaPressed = String(selectedEquipment.has(key));
      chip.addEventListener('click', () => {
        if (selectedEquipment.has(key)) selectedEquipment.delete(key);
        else selectedEquipment.add(key);
        renderFilters();
        draw(currentQuery());
      });
      equipmentGrid.append(chip);
    });
    filters.append(groupsHeading, groupsGrid, equipmentHeading, equipmentGrid);
  };
  const draw = (query = '') => {
    const list = document.querySelector('#catalog-list');
    if (!list) return;
    list.replaceChildren();
    const groupMuscles = [...selectedGroups].flatMap((key) => MUSCLE_GROUPS[key]);
    searchExercises(query, i18n.locale)
      .filter(
        (exercise) =>
          !groupMuscles.length ||
          groupMuscles.some((muscle) => (exercise.muscles[muscle] ?? 0) > 0),
      )
      .filter((exercise) => !selectedEquipment.size || selectedEquipment.has(exercise.equipment))
      .slice(0, 100)
      .forEach((exercise) => {
        const row = document.createElement('article');
        if (exercise.exerciseDbId) {
          const thumb = document.createElement('img');
          thumb.className = 'exercise-thumb';
          thumb.loading = 'lazy';
          thumb.alt = exercise.name;
          void getExerciseMedia(exercise.exerciseDbId)
            .then((media) => {
              if (media.imageUrl) thumb.src = media.imageUrl;
            })
            .catch(() => undefined);
          row.append(thumb);
        }
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
            .then(() => renderRoutine(user))
            .catch((error: unknown) => reportError(error, 'workout/add'));
        });
        row.append(body, add);
        list.append(row);
      });
  };
  renderFilters();
  draw();
  document
    .querySelector('#catalog-back')
    ?.addEventListener('click', () => void renderRoutine(user));
  document
    .querySelector<HTMLInputElement>('#catalog-search')
    ?.addEventListener('input', (event) => draw((event.currentTarget as HTMLInputElement).value));
}

function renderDayButtons(
  user: User,
  workouts: Workouts,
  onSelect: () => void = () => void renderWorkout(user),
): void {
  const container = document.querySelector('#days');
  if (!container) return;
  dayKeys.forEach((day) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = day.slice(0, 3).toUpperCase();
    button.ariaPressed = String(day === selectedDay);
    button.addEventListener('click', () => {
      selectedDay = day;
      onSelect();
    });
    if (!workouts[day]) button.classList.add('empty');
    container.append(button);
  });
}

/** Wires up a swipe-left-to-reveal-delete gesture on `row` via Pointer Events (works with touch and mouse, unlike the exercise-card's HTML5 drag-and-drop reorder). `closeSelector` scopes which other open rows get closed when this one starts swiping. */
function attachSwipeToDelete(row: HTMLElement, closeSelector: string, revealWidth = 76): void {
  let dragStartX = 0;
  let dragStartY = 0;
  let dragBaseX = 0;
  let tracking = false;
  let horizontalDrag = false;
  row.addEventListener('pointerdown', (event) => {
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragBaseX = row.classList.contains('swiped') ? -revealWidth : 0;
    tracking = true;
    horizontalDrag = false;
  });
  row.addEventListener('pointermove', (event) => {
    if (!tracking) return;
    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    if (!horizontalDrag) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        tracking = false;
        return;
      }
      horizontalDrag = true;
      row.setPointerCapture(event.pointerId);
      document.querySelectorAll(closeSelector).forEach((openRow) => {
        if (openRow !== row) {
          openRow.classList.remove('swiped');
          (openRow as HTMLElement).style.transform = '';
        }
      });
    }
    const next = Math.min(0, Math.max(-revealWidth, dragBaseX + dx));
    row.style.transform = `translateX(${next}px)`;
    event.preventDefault();
  });
  const endSwipeDrag = (event: PointerEvent) => {
    if (!tracking) return;
    tracking = false;
    if (!horizontalDrag) return;
    const dx = event.clientX - dragStartX;
    const finalX = Math.min(0, Math.max(-revealWidth, dragBaseX + dx));
    const open = finalX < -revealWidth / 2;
    row.classList.toggle('swiped', open);
    row.style.transform = open ? `translateX(-${revealWidth}px)` : '';
  };
  row.addEventListener('pointerup', endSwipeDrag);
  row.addEventListener('pointercancel', endSwipeDrag);
}

function renderExerciseEntries(
  user: User,
  workouts: Workouts,
  exerciseHistory: Record<string, PerformanceEntry[]>,
  progressionDecisions: ProgressionDecision[],
  exerciseRecords: ExerciseRecords,
): void {
  const list = document.querySelector('#exercise-list');
  if (!list) return;
  const persistDraft = () => {
    startWorkoutSession();
    void saveWorkoutDraft(user, selectedDay, workoutStartedAt as string, workoutEntries).catch(
      (error: unknown) => reportError(error, 'workout/draft'),
    );
  };
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
      const current = workouts[selectedDay];
      const exerciseCount = current?.exercises.length ?? 0;
      if (fromIndex >= 0 && fromIndex < exerciseCount && exerciseIndex < exerciseCount) {
        const [item] = workoutEntries.splice(fromIndex, 1);
        if (item) workoutEntries.splice(exerciseIndex, 0, item);
      }
      void saveUserData(
        user,
        'workouts',
        reorderExercise(workouts, selectedDay, fromIndex, exerciseIndex),
      )
        .then(() =>
          workoutStartedAt
            ? saveWorkoutDraft(user, selectedDay, workoutStartedAt, workoutEntries)
            : Promise.resolve(),
        )
        .then(() => renderWorkout(user))
        .catch((error: unknown) => reportError(error, 'workout/reorder'));
    });
    const topWrap = document.createElement('div');
    topWrap.className = 'exercise-top-wrap';
    topWrap.draggable = false;
    const top = document.createElement('div');
    top.className = 'exercise-top';
    top.draggable = false;
    const heading = document.createElement('h2');
    heading.textContent = entry.exercise.name;
    const actions = document.createElement('div');
    const reorder = (direction: -1 | 1) => {
      const current = workouts[selectedDay];
      const exerciseCount = current?.exercises.length ?? 0;
      const toIndex = exerciseIndex + direction;
      if (
        exerciseIndex >= 0 &&
        exerciseIndex < exerciseCount &&
        toIndex >= 0 &&
        toIndex < exerciseCount
      ) {
        const [item] = workoutEntries.splice(exerciseIndex, 1);
        if (item) workoutEntries.splice(toIndex, 0, item);
      }
      void saveUserData(
        user,
        'workouts',
        moveExercise(workouts, selectedDay, exerciseIndex, direction),
      )
        .then(() =>
          workoutStartedAt
            ? saveWorkoutDraft(user, selectedDay, workoutStartedAt, workoutEntries)
            : Promise.resolve(),
        )
        .then(() => renderWorkout(user))
        .catch((error: unknown) => reportError(error, 'workout/reorder'));
    };
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
    const removeExercise = document.createElement('button');
    removeExercise.type = 'button';
    removeExercise.className = 'exercise-top-delete';
    removeExercise.textContent = copy('remove');
    removeExercise.addEventListener('click', () => {
      const current = workouts[selectedDay];
      if (!current) return;
      const nextExercises = current.exercises.filter((_, index) => index !== exerciseIndex);
      workoutEntries.splice(exerciseIndex, 1);
      void saveUserData(user, 'workouts', {
        ...workouts,
        [selectedDay]: { ...current, exercises: nextExercises },
      })
        .then(() =>
          workoutStartedAt
            ? saveWorkoutDraft(user, selectedDay, workoutStartedAt, workoutEntries)
            : Promise.resolve(),
        )
        .then(() => renderWorkout(user))
        .catch((error: unknown) => reportError(error, 'workout/remove'));
    });
    actions.append(up, down);
    top.append(heading, actions);
    topWrap.append(top, removeExercise);
    card.append(topWrap);
    attachSwipeToDelete(top, '.exercise-top.swiped');
    const meta = document.createElement('p');
    meta.className = 'exercise-meta';
    meta.textContent = `${entry.exercise.sets} × ${entry.exercise.reps} · ${copy('rest')} ${entry.exercise.rest}s`;
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
    const videoUrl = localizedVideoUrl(entry.exercise);
    if (videoUrl) {
      const video = document.createElement('button');
      video.type = 'button';
      video.className = 'exercise-video';
      video.textContent = copy('watchVideo');
      video.addEventListener('click', () => openVideoModal(videoUrl, entry.exercise.name));
      card.append(video);
    }
    if (entry.exercise.exerciseDbId) {
      const exerciseDbId = entry.exercise.exerciseDbId;
      const exampleButton = document.createElement('button');
      exampleButton.type = 'button';
      exampleButton.className = 'exercise-video';
      exampleButton.textContent = copy('watchExample');
      exampleButton.addEventListener('click', () => {
        void getExerciseMedia(exerciseDbId)
          .then((media) => {
            const src = media.gifUrl || media.imageUrl;
            if (src) openExampleModal(src, entry.exercise.name);
          })
          .catch((error: unknown) => reportError(error, 'workout/example-media'));
      });
      card.append(exampleButton);
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
      const details = document.createElement('details');
      details.className = 'exercise-alternatives-accordion';
      const summary = document.createElement('summary');
      summary.textContent = copy('findAlternative');
      const alternativesList = document.createElement('div');
      alternativesList.className = 'exercise-alternatives';
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
          const updatedExercise =
            exerciseIndex < current.exercises.length
              ? exercises[exerciseIndex]
              : abs[abdominalIndex];
          if (updatedExercise) {
            workoutEntries[exerciseIndex] = {
              exercise: updatedExercise,
              sets: Array.from({ length: updatedExercise.sets }, () => ({
                kg: 0,
                reps: 0,
                done: false,
                rir: undefined,
                rpe: undefined,
              })),
            };
          }
          void saveUserData(user, 'workouts', {
            ...workouts,
            [selectedDay]: { ...current, exercises, abs },
          })
            .then(() =>
              workoutStartedAt
                ? saveWorkoutDraft(user, selectedDay, workoutStartedAt, workoutEntries)
                : Promise.resolve(),
            )
            .then(() => renderWorkout(user))
            .catch((error: unknown) => reportError(error, 'workout/substitution'));
        });
        alternativesList.append(option);
      });
      details.append(summary, alternativesList);
      card.append(details);
    }
    const setHeader = document.createElement('div');
    setHeader.className = showRirRpe ? 'set-row set-header' : 'set-row set-header compact';
    const headerLabels = showRirRpe
      ? ['', copy('load'), copy('reps'), copy('rir'), copy('rpe'), '✓']
      : ['', copy('load'), copy('reps'), '✓'];
    headerLabels.forEach((label) => {
      const cell = document.createElement('span');
      cell.textContent = label;
      setHeader.append(cell);
    });
    card.append(setHeader);
    if (entry.sets.length > 1) {
      const repeatLabel = document.createElement('label');
      repeatLabel.className = 'repeat-set-toggle';
      const repeatCheckbox = document.createElement('input');
      repeatCheckbox.type = 'checkbox';
      const repeatText = document.createElement('span');
      repeatText.textContent = copy('repeatFirstSet');
      repeatLabel.append(repeatCheckbox, repeatText);
      repeatCheckbox.addEventListener('change', () => {
        if (!repeatCheckbox.checked) return;
        const first = entry.sets[0];
        if (!first) return;
        entry.sets.forEach((set, index) => {
          if (index === 0) return;
          set.kg = first.kg;
          set.reps = first.reps;
        });
        persistDraft();
        void renderWorkout(user);
      });
      card.append(repeatLabel);
    }
    const persistSetCountChange = () => {
      const current = workouts[selectedDay];
      if (!current) return;
      const isAbs = exerciseIndex >= current.exercises.length;
      const abdominalIndex = exerciseIndex - current.exercises.length;
      const nextCount = Math.max(1, Math.min(20, entry.sets.length));
      const exercises = current.exercises.map((exercise, index) =>
        !isAbs && index === exerciseIndex ? { ...exercise, sets: nextCount } : exercise,
      );
      const abs = current.abs.map((exercise, index) =>
        isAbs && index === abdominalIndex ? { ...exercise, sets: nextCount } : exercise,
      );
      void saveUserData(user, 'workouts', {
        ...workouts,
        [selectedDay]: { ...current, exercises, abs },
      })
        .then(() =>
          workoutStartedAt
            ? saveWorkoutDraft(user, selectedDay, workoutStartedAt, workoutEntries)
            : Promise.resolve(),
        )
        .then(() => renderWorkout(user))
        .catch((error: unknown) => reportError(error, 'workout/set-count'));
    };
    entry.sets.forEach((set, setIndex) => {
      const wrap = document.createElement('div');
      wrap.className = 'set-row-wrap';
      wrap.draggable = false;
      const row = document.createElement('div');
      row.className = showRirRpe ? 'set-row' : 'set-row compact';
      row.draggable = false;
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
        if (set.done && set.kg > 0 && set.reps > 0) {
          const record = exerciseRecords[entry.exercise.name];
          const e1rm = estimatedOneRepMax(set.kg, set.reps);
          const isNewRecord = !record || set.kg > record.maxWeight || e1rm > record.maxE1rm;
          if (isNewRecord) celebratePersonalRecord();
        }
      });
      row.append(number, kg, reps, ...(showRirRpe ? [rir, rpe] : []), done);
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'set-row-delete';
      deleteButton.textContent = copy('remove');
      deleteButton.addEventListener('click', () => {
        if (entry.sets.length <= 1) return;
        entry.sets.splice(setIndex, 1);
        persistSetCountChange();
      });
      wrap.append(row, deleteButton);
      card.append(wrap);
      card.append(guidance);
      attachSwipeToDelete(row, '.set-row.swiped');
    });
    const addSetButton = document.createElement('button');
    addSetButton.type = 'button';
    addSetButton.className = 'add-set-button';
    addSetButton.textContent = copy('addSet');
    addSetButton.disabled = entry.sets.length >= 20;
    addSetButton.addEventListener('click', () => {
      if (entry.sets.length >= 20) return;
      entry.sets.push({ kg: 0, reps: 0, done: false, rir: undefined, rpe: undefined });
      persistSetCountChange();
    });
    card.append(addSetButton);
    list.append(card);
  });
}

function localizedDayTitle(day: Workouts[keyof Workouts]): string {
  if (!day) return copy('noWorkout');
  if (i18n.locale === 'en') return day.titleEn || day.title;
  return day.title || day.titleEn;
}

function localizedVideoUrl(exercise: Exercise): string {
  const coachVideo = coachVideoOverrides[exercise.name];
  if (coachVideo) return coachVideo;
  if (i18n.locale === 'en') return exercise.videoUrlEn || exercise.videoUrl;
  return exercise.videoUrl || exercise.videoUrlEn;
}

function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1) || null;
    if (parsed.pathname === '/watch') return parsed.searchParams.get('v');
    return null;
  } catch {
    return null;
  }
}

function closeVideoModal(): void {
  document.querySelector('.video-modal')?.remove();
}

function openVideoModal(url: string, title: string): void {
  const videoId = extractYouTubeId(url);
  if (!videoId) return;
  closeVideoModal();
  const overlay = document.createElement('div');
  overlay.className = 'video-modal';
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeVideoModal();
  });
  const frame = document.createElement('div');
  frame.className = 'video-modal-frame';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '✕';
  close.ariaLabel = copy('close');
  close.addEventListener('click', closeVideoModal);
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1`;
  iframe.title = title;
  iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.append(heading, close, iframe);
  overlay.append(frame);
  document.body.append(overlay);
}

function openExampleModal(src: string, title: string): void {
  closeVideoModal();
  const overlay = document.createElement('div');
  overlay.className = 'video-modal';
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeVideoModal();
  });
  const frame = document.createElement('div');
  frame.className = 'video-modal-frame';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '✕';
  close.ariaLabel = copy('close');
  close.addEventListener('click', closeVideoModal);
  const image = document.createElement('img');
  image.src = src;
  image.alt = title;
  image.className = 'example-modal-image';
  frame.append(heading, close, image);
  overlay.append(frame);
  document.body.append(overlay);
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
  const nextSessions = [...existing, session].slice(-450);
  await Promise.all([
    saveUserData(user, 'sessionLog', nextSessions),
    saveUserData(user, 'exerciseHistory', nextHistory),
    saveUserData(user, 'exerciseRecords', nextRecords),
  ]);
  await clearWorkoutDraft(user, selectedDay);
  const status = document.querySelector('#workout-status');
  if (status) status.textContent = navigator.onLine ? copy('workoutSaved') : copy('syncPending');
  clearWorkoutTimers();
  workoutStartedAt = null;
  resetWorkoutClock();
  showCelebration(
    trainingStreak(nextSessions),
    `${copy('weeklyReport')}: ${session.exerciseCount} ${copy('sessions')} · ${Math.round(session.volume)} kg`,
  );
}

function spawnConfetti(): void {
  const container = document.createElement('div');
  container.className = 'confetti-burst';
  const colors = ['#d7ff3d', '#4dc3ff', '#ff4d5e', '#eef0f2'];
  for (let i = 0; i < 40; i += 1) {
    const piece = document.createElement('span');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)] ?? '#d7ff3d';
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    piece.style.animationDuration = `${1.6 + Math.random() * 0.8}s`;
    container.append(piece);
  }
  document.body.append(container);
  window.setTimeout(() => container.remove(), 3000);
}

function celebratePersonalRecord(): void {
  spawnConfetti();
  const badge = document.createElement('div');
  badge.className = 'pr-badge';
  badge.textContent = `🏆 ${copy('newPersonalRecord')}`;
  document.body.append(badge);
  window.setTimeout(() => badge.remove(), 2600);
}

function showCelebration(streak: number, shareText: string): void {
  const overlay = document.createElement('div');
  overlay.className = 'celebrate-overlay show';
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.remove();
  });
  const card = document.createElement('div');
  card.className = 'celebrate-card';
  const title = document.createElement('h1');
  title.innerHTML = copy('celebrationTitle');
  const body = document.createElement('p');
  body.textContent = copy('celebrationBody');
  card.append(title, body);
  if (streak > 0) {
    const streakBadge = document.createElement('div');
    streakBadge.className = 'celebrate-streak';
    streakBadge.textContent = `🔥 ${streak} ${copy('celebrationStreak')}`;
    card.append(streakBadge);
  }
  const actions = document.createElement('div');
  actions.className = 'cel-actions';
  const share = document.createElement('button');
  share.type = 'button';
  share.textContent = copy('shareReport');
  share.addEventListener(
    'click',
    () =>
      void shareOrFallback({ title: 'KYRO', text: shareText }).catch((error: unknown) => {
        if ((error as Error).name !== 'AbortError') reportError(error, 'workout/celebrate-share');
      }),
  );
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = copy('close');
  close.addEventListener('click', () => overlay.remove());
  actions.append(share, close);
  card.append(actions);
  overlay.append(card);
  document.body.append(overlay);
  spawnConfetti();
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
let swRefreshing = false;
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (swRefreshing) return;
  swRefreshing = true;
  location.reload();
});
void registerPwaUpdates((registration) => {
  updateRegistration = registration;
  document.querySelector<HTMLElement>('#update')?.removeAttribute('hidden');
}).catch((error: unknown) => reportError(error, 'pwa/register'));
