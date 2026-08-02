import './styles.css';
import type { User } from 'firebase/auth';
import { installGlobalErrorHandlers, onError, reportError } from './core/errors';
import { createI18n, type Locale, type MessageKey } from './core/i18n';
import type { NutritionDay, Workouts } from './domain/schemas';
import {
  authErrorKey, createAccount, loginWithGoogle, loginWithPassword, logout, observeAuth,
  refreshVerification, requestPasswordReset, resendVerification, type AuthState,
} from './features/auth';
import { deleteOwnAccount } from './features/account/delete-account';
import { completedExerciseCount, createEntries, dateKey, dayKeys, todayDayKey, workoutVolume, type DayKey, type ExerciseEntry } from './features/workouts/model';
import { emptyNutritionDay, percentage } from './features/nutrition/model';
import { readinessClass, readinessScore, weightDelta } from './features/progress/model';
import { cacheGet, cacheSet, clearLocalData, queueList } from './services/database';
import { activateUpdate, registerPwaUpdates } from './services/pwa-update';
import { flushUserDataQueue, loadUserData, saveUserData } from './services/user-data';

installGlobalErrorHandlers();
const i18n = createI18n();
i18n.setLocale(i18n.locale);
const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing #app root');
const appRoot = root;

let authState: AuthState = { status: 'loading', user: null };
let authMode: 'login' | 'signup' = 'login';
let updateRegistration: ServiceWorkerRegistration | null = null;
let currentView: 'dashboard' | 'workout' | 'progress' | 'nutrition' | 'settings' = 'dashboard';
let selectedDay: DayKey = todayDayKey();
let workoutEntries: ExerciseEntry[] = [];
let workoutStartedAt = new Date().toISOString();

function copy(key: MessageKey): string { return i18n.t(key); }
function formText(data: FormData, key: string): string { const value = data.get(key); return typeof value === 'string' ? value : ''; }

function shell(content: string): void {
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
  if (error) { error.textContent = message; error.hidden = !message; }
}

function setBusy(busy: boolean): void {
  document.querySelectorAll<HTMLButtonElement>('.auth-card button').forEach((button) => { button.disabled = busy; });
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
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => button.addEventListener('click', () => {
    authMode = button.dataset.mode as 'login' | 'signup'; renderAuth();
  }));
  document.querySelector('#auth-form')?.addEventListener('submit', (event) => void submitAuth(event));
  document.querySelector('#google')?.addEventListener('click', () => void runAuth(loginWithGoogle));
  document.querySelector('#forgot')?.addEventListener('click', () => void resetPassword());
}

async function runAuth(action: () => Promise<void>): Promise<void> {
  setFormError(''); setBusy(true);
  try { await action(); } catch (error: unknown) { setFormError(copy(authErrorKey(error))); }
  finally { setBusy(false); }
}

async function submitAuth(event: Event): Promise<void> {
  event.preventDefault();
  const email = document.querySelector<HTMLInputElement>('#auth-email')?.value ?? '';
  const password = document.querySelector<HTMLInputElement>('#auth-password')?.value ?? '';
  await runAuth(() => authMode === 'login' ? loginWithPassword(email, password) : createAccount(email, password));
}

async function resetPassword(): Promise<void> {
  const email = document.querySelector<HTMLInputElement>('#auth-email')?.value ?? '';
  if (!email) { document.querySelector<HTMLInputElement>('#auth-email')?.focus(); return; }
  await runAuth(() => requestPasswordReset(email));
  setFormError(copy('resetSent'));
}

function renderVerification(user: User): void {
  shell(`<section class="auth-card verify" aria-labelledby="verify-title"><p class="eyebrow">EMAIL</p><h1 id="verify-title">${copy('verifyTitle')}</h1>
    <p>${copy('verifyBody')}</p><strong class="email-address"></strong><p id="auth-error" class="form-error" role="status" hidden></p>
    <button class="primary" id="verify-check">${copy('verifyCheck')}</button><button class="secondary" id="verify-again">${copy('verifyAgain')}</button>
    <button class="link-button" id="verify-logout">${copy('useAnother')}</button></section>`);
  const address = document.querySelector('.email-address'); if (address) address.textContent = user.email ?? '';
  document.querySelector('#verify-check')?.addEventListener('click', () => void runVerification(async () => {
    if (await refreshVerification(user)) location.reload(); else setFormError(copy('verifyPending'));
  }));
  document.querySelector('#verify-again')?.addEventListener('click', () => void runVerification(async () => {
    await resendVerification(user); setFormError(copy('verifySent'));
  }));
  document.querySelector('#verify-logout')?.addEventListener('click', () => void logout().catch((error: unknown) => reportError(error, 'auth/logout')));
}

async function runVerification(action: () => Promise<void>): Promise<void> {
  setBusy(true); try { await action(); } catch (error: unknown) { setFormError(copy(authErrorKey(error))); } finally { setBusy(false); }
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
    void Promise.all([cacheSet(`units:${user.uid}`, units), cacheSet(`onboarding:${user.uid}`, true)])
      .then(() => renderDashboard(user)).catch((error: unknown) => reportError(error, 'onboarding/save'));
  });
}

async function renderReady(user: User): Promise<void> {
  if (await needsOnboarding(user)) { renderOnboarding(user); return; }
  if (currentView === 'workout') await renderWorkout(user);
  else if (currentView === 'progress') await renderProgress(user);
  else if (currentView === 'nutrition') await renderNutrition(user);
  else if (currentView === 'settings') renderSettings(user);
  else renderDashboard(user);
}

function renderDashboard(user: User): void {
  shell(`<section class="hero"><p class="eyebrow">${copy('foundation')}</p><h1>${copy('tagline')}</h1>
    <div class="status"><span id="network">${copy(navigator.onLine ? 'online' : 'offline')}</span><span>·</span><span>${copy('queue')}: <b id="queue-count">0</b></span></div>
    <button id="start-workout" class="primary">${copy('train')}</button><button id="logout" class="link-button">${copy('logout')}</button></section>
    <section class="feature-grid" aria-label="KYRO modules"><article><span>01</span><h2>TRAIN</h2><p>Workouts, routines, exercises and sets.</p></article>
    <article><span>02</span><h2>RECOVER</h2><p>Readiness, history and progress.</p><button id="open-progress">${copy('progress')}</button></article><article><span>03</span><h2>FUEL</h2><p>Nutrition and supplements.</p><button id="open-nutrition">${copy('nutrition')}</button></article>
    <article><span>04</span><h2>SYNC</h2><p>Offline-first, private and resilient.</p><button id="open-settings">${copy('settings')}</button></article></section>`);
  document.querySelector('#logout')?.addEventListener('click', () => void logout().catch((error: unknown) => reportError(error, 'auth/logout')));
  document.querySelector('#start-workout')?.addEventListener('click', () => { currentView = 'workout'; void renderWorkout(user); });
  document.querySelector('#open-progress')?.addEventListener('click', () => { currentView = 'progress'; void renderProgress(user); });
  document.querySelector('#open-nutrition')?.addEventListener('click', () => { currentView = 'nutrition'; void renderNutrition(user); });
  document.querySelector('#open-settings')?.addEventListener('click', () => { currentView = 'settings'; renderSettings(user); });
  void flushUserDataQueue(user).catch((error: unknown) => reportError(error, 'sync/flush'));
  void queueList().then((items) => { const count = document.querySelector('#queue-count'); if (count) count.textContent = String(items.length); })
    .catch((error: unknown) => reportError(error, 'queue/render'));
}

function renderSettings(user: User): void {
  const passwordProvider=user.providerData.some(({providerId})=>providerId==='password');
  shell(`<section class="feature-view"><button id="feature-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">04 · ACCOUNT</p><h1>${copy('settings')}</h1>
    <article class="danger-zone"><h2>${copy('deleteAccount')}</h2><p>${copy('deleteWarning')}</p><form id="delete-form"><label>${copy('confirmation')}<input name="phrase" autocomplete="off" required></label>${passwordProvider?`<label>${copy('password')}<input name="password" type="password" autocomplete="current-password" required></label>`:''}<button class="danger-button">${copy('deleteAccount')}</button></form><p id="delete-status" role="status"></p></article></section>`);
  bindBack(user);
  document.querySelector('#delete-form')?.addEventListener('submit',(event)=>{event.preventDefault();const form=event.currentTarget as HTMLFormElement;const data=new FormData(form);const expected=i18n.locale==='pt'?'EXCLUIR':'DELETE';if(formText(data,'phrase').trim().toUpperCase()!==expected)return;form.querySelectorAll('button,input').forEach((element)=>{(element as HTMLButtonElement|HTMLInputElement).disabled=true;});const status=document.querySelector('#delete-status');if(status)status.textContent=copy('deleting');void deleteOwnAccount(user,{password:formText(data,'password'),onStage:(stage)=>{if(status)status.textContent=`${copy('deleting')} ${stage}`;}}).then(clearLocalData).catch((error:unknown)=>{reportError(error,'account/delete');if(status)status.textContent=copy('deleteFailed');form.querySelectorAll('button,input').forEach((element)=>{(element as HTMLButtonElement|HTMLInputElement).disabled=false;});});});
}

function bindBack(user: User): void { document.querySelector('#feature-back')?.addEventListener('click', () => { currentView = 'dashboard'; renderDashboard(user); }); }

async function renderProgress(user: User): Promise<void> {
  const [weights, readiness, sessions] = await Promise.all([
    loadUserData(user, 'bodyWeights').then((value) => value ?? []), loadUserData(user, 'readinessLog').then((value) => value ?? {}), loadUserData(user, 'sessionLog').then((value) => value ?? []),
  ]);
  const latest = [...weights].sort((a,b) => b.d.localeCompare(a.d))[0]; const delta = weightDelta(weights); const todayReadiness = readiness[dateKey()];
  shell(`<section class="feature-view"><button id="feature-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">02 · RECOVER</p><h1>${copy('progress')}</h1>
    <div class="metric-grid"><article><span>${copy('weight')}</span><strong id="latest-weight">—</strong><small id="weight-delta"></small></article><article><span>${copy('readiness')}</span><strong id="readiness-score">—</strong><small id="readiness-class"></small></article><article><span>${copy('history')}</span><strong>${sessions.length}</strong></article></div>
    <form id="weight-form" class="compact-form"><label>${copy('weight')}<input id="weight-input" type="number" min="1" max="1000" step="0.1" required></label><button class="primary">${copy('add')}</button></form>
    <form id="readiness-form" class="readiness-form">${(['sleep','energy','soreness','stress'] as const).map((key) => `<label>${copy(key)}<input name="${key}" type="range" min="1" max="5" value="3"></label>`).join('')}<button class="primary">${copy('save')}</button></form>
    <div id="session-history" class="history-list"></div></section>`);
  const weightTarget=document.querySelector('#latest-weight'); if(weightTarget)weightTarget.textContent=latest?`${latest.kg.toFixed(1)} kg`:'—';
  const deltaTarget=document.querySelector('#weight-delta'); if(deltaTarget)deltaTarget.textContent=delta===null?'':`${delta>=0?'+':''}${delta.toFixed(1)} kg`;
  const scoreTarget=document.querySelector('#readiness-score'); if(scoreTarget)scoreTarget.textContent=todayReadiness?String(todayReadiness.score):'—';
  const classTarget=document.querySelector('#readiness-class'); if(classTarget)classTarget.textContent=todayReadiness?todayReadiness.classification:'';
  const history=document.querySelector('#session-history'); sessions.slice(-20).reverse().forEach((session)=>{const row=document.createElement('article');const title=document.createElement('strong');title.textContent=session.title;const meta=document.createElement('span');meta.textContent=`${session.date} · ${Math.round(session.volume)} kg·vol`;row.append(title,meta);history?.append(row);});
  bindBack(user);
  document.querySelector('#weight-form')?.addEventListener('submit',(event)=>{event.preventDefault();const input=document.querySelector<HTMLInputElement>('#weight-input');const kg=Number(input?.value);if(!Number.isFinite(kg)||kg<=0||kg>1000)return;const next=[...weights.filter((item)=>item.d!==dateKey()),{d:dateKey(),kg}].sort((a,b)=>a.d.localeCompare(b.d));void saveUserData(user,'bodyWeights',next).then(()=>renderProgress(user)).catch((error:unknown)=>reportError(error,'progress/weight'));});
  document.querySelector('#readiness-form')?.addEventListener('submit',(event)=>{event.preventDefault();const data=new FormData(event.currentTarget as HTMLFormElement);const values=['sleep','energy','soreness','stress'].map((key)=>Number(data.get(key)));const [sleep=3,energy=3,soreness=3,stress=3]=values;const score=readinessScore(sleep,energy,soreness,stress);const next={...readiness,[dateKey()]:{sleep,energy,soreness,stress,score,classification:readinessClass(score),recordedAt:new Date().toISOString()}};void saveUserData(user,'readinessLog',next).then(()=>renderProgress(user)).catch((error:unknown)=>reportError(error,'progress/readiness'));});
}

async function renderNutrition(user: User): Promise<void> {
  const log = await loadUserData(user, 'nutritionLog') ?? {}; const today=dateKey(); const previous=Object.keys(log).sort().map((key)=>log[key]).filter((value):value is NutritionDay=>Boolean(value)).at(-1); const day=log[today] ?? emptyNutritionDay(previous);
  shell(`<section class="feature-view"><button id="feature-back" class="link-button">← ${copy('back')}</button><p class="eyebrow">03 · FUEL</p><h1>${copy('nutrition')}</h1>
    <div class="metric-grid nutrition-metrics"><article><span>${copy('calories')}</span><strong>${Math.round(day.kcal)}</strong><small>${Math.round(percentage(day.kcal,day.kcalGoal))}%</small></article><article><span>${copy('protein')}</span><strong>${Math.round(day.protein)}g</strong><small>${Math.round(percentage(day.protein,day.proteinGoal))}%</small></article><article><span>${copy('water')}</span><strong>${day.water.toFixed(2)}L</strong><button id="add-water">+ 250ml</button></article></div>
    <form id="meal-form" class="meal-form"><label>${copy('mealName')}<input name="name" maxlength="120" required></label><label>${copy('calories')}<input name="kcal" type="number" min="0" max="10000" required></label><label>${copy('protein')}<input name="protein" type="number" min="0" max="1000" step="0.1"></label><label>${copy('carbs')}<input name="carb" type="number" min="0" max="1000" step="0.1"></label><label>${copy('fat')}<input name="fat" type="number" min="0" max="1000" step="0.1"></label><button class="primary">${copy('add')} ${copy('meal')}</button></form>
    <div id="meal-list" class="history-list"></div></section>`);
  bindBack(user); const list=document.querySelector('#meal-list');day.meals.slice().reverse().forEach((meal)=>{const row=document.createElement('article');const name=document.createElement('strong');name.textContent=meal.name;const meta=document.createElement('span');meta.textContent=`${Math.round(meal.kcal)} kcal · P ${Math.round(meal.prot)}g · C ${Math.round(meal.carb)}g · F ${Math.round(meal.fat)}g`;row.append(name,meta);list?.append(row);});
  const persist=(next: NutritionDay)=>saveUserData(user,'nutritionLog',{...log,[today]:next}).then(()=>renderNutrition(user));
  document.querySelector('#add-water')?.addEventListener('click',()=>void persist({...day,water:Math.min(50,day.water+0.25)}).catch((error:unknown)=>reportError(error,'nutrition/water')));
  document.querySelector('#meal-form')?.addEventListener('submit',(event)=>{event.preventDefault();const data=new FormData(event.currentTarget as HTMLFormElement);const meal={id:crypto.randomUUID().slice(0,60),name:formText(data,'name').slice(0,120),kcal:Number(data.get('kcal'))||0,prot:Number(data.get('protein'))||0,carb:Number(data.get('carb'))||0,fat:Number(data.get('fat'))||0,t:new Date().toISOString()};const next={...day,kcal:day.kcal+meal.kcal,protein:day.protein+meal.prot,carb:day.carb+meal.carb,fat:day.fat+meal.fat,meals:[...day.meals,meal]};void persist(next).catch((error:unknown)=>reportError(error,'nutrition/meal'));});
}

async function renderWorkout(user: User): Promise<void> {
  const workouts = await loadUserData(user, 'workouts') ?? {};
  workoutEntries = createEntries(workouts, selectedDay);
  workoutStartedAt = new Date().toISOString();
  shell(`<section class="workout-view"><button id="workout-back" class="link-button">← ${copy('back')}</button><div class="days" id="days"></div>
    <header class="workout-heading"><p class="eyebrow">${dateKey()}</p><h1 id="workout-title"></h1></header><div id="exercise-list"></div>
    <button id="finish-workout" class="primary" ${workoutEntries.length ? '' : 'disabled'}>${copy('finishWorkout')}</button><p id="workout-status" class="hint" role="status"></p></section>`);
  const title = document.querySelector('#workout-title'); if (title) title.textContent = workouts[selectedDay]?.title ?? copy('noWorkout');
  renderDayButtons(user, workouts); renderExerciseEntries();
  document.querySelector('#workout-back')?.addEventListener('click', () => { currentView = 'dashboard'; renderDashboard(user); });
  document.querySelector('#finish-workout')?.addEventListener('click', () => void finishWorkout(user, workouts));
}

function renderDayButtons(user: User, workouts: Workouts): void {
  const container = document.querySelector('#days'); if (!container) return;
  dayKeys.forEach((day) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = day.slice(0, 3).toUpperCase();
    button.ariaPressed = String(day === selectedDay); button.addEventListener('click', () => { selectedDay = day; void renderWorkout(user); });
    if (!workouts[day]) button.classList.add('empty'); container.append(button);
  });
}

function renderExerciseEntries(): void {
  const list = document.querySelector('#exercise-list'); if (!list) return;
  if (!workoutEntries.length) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = copy('noWorkout'); list.append(empty); return; }
  workoutEntries.forEach((entry, exerciseIndex) => {
    const card = document.createElement('article'); card.className = 'exercise-card';
    const heading = document.createElement('h2'); heading.textContent = entry.exercise.name; card.append(heading);
    const meta = document.createElement('p'); meta.className = 'exercise-meta'; meta.textContent = `${entry.exercise.sets} × ${entry.exercise.reps} · ${copy('rest')} ${entry.exercise.rest}s`; card.append(meta);
    entry.sets.forEach((set, setIndex) => {
      const row = document.createElement('div'); row.className = 'set-row';
      const number = document.createElement('span'); number.textContent = String(setIndex + 1);
      const kg = document.createElement('input'); kg.type = 'number'; kg.min = '0'; kg.max = '1000'; kg.step = '0.5'; kg.inputMode = 'decimal'; kg.placeholder = copy('load'); kg.ariaLabel = `${copy('load')} ${setIndex + 1}`;
      const reps = document.createElement('input'); reps.type = 'number'; reps.min = '0'; reps.max = '1000'; reps.step = '1'; reps.inputMode = 'numeric'; reps.placeholder = copy('reps'); reps.ariaLabel = `${copy('reps')} ${setIndex + 1}`;
      const done = document.createElement('input'); done.type = 'checkbox'; done.ariaLabel = `${copy('continue')} ${setIndex + 1}`;
      kg.addEventListener('input', () => { set.kg = Number(kg.value) || 0; }); reps.addEventListener('input', () => { set.reps = Number(reps.value) || 0; }); done.addEventListener('change', () => { set.done = done.checked; row.classList.toggle('done', done.checked); });
      row.append(number, kg, reps, done); card.append(row);
    });
    list.append(card); void exerciseIndex;
  });
}

async function finishWorkout(user: User, workouts: Workouts): Promise<void> {
  const count = completedExerciseCount(workoutEntries); if (!count) return;
  const endedAt = new Date(); const existing = await loadUserData(user, 'sessionLog') ?? [];
  const session = { id: crypto.randomUUID().slice(0, 60), date: dateKey(endedAt), day: selectedDay, title: workouts[selectedDay]?.title ?? selectedDay,
    startedAt: workoutStartedAt, endedAt: endedAt.toISOString(), durationSec: Math.max(0, Math.round((endedAt.getTime() - new Date(workoutStartedAt).getTime()) / 1000)),
    volume: workoutVolume(workoutEntries), exerciseCount: count };
  await saveUserData(user, 'sessionLog', [...existing, session].slice(-450));
  const status = document.querySelector('#workout-status'); if (status) status.textContent = navigator.onLine ? copy('workoutSaved') : copy('syncPending');
  workoutStartedAt = endedAt.toISOString();
}

function render(): void {
  if (authState.status === 'loading') { shell('<section class="loading" aria-label="Loading"><div></div></section>'); return; }
  if (authState.status === 'signed-out' || authState.status === 'blocked') { renderAuth(); return; }
  if (authState.status === 'unverified' && authState.user) { renderVerification(authState.user); return; }
  if (authState.user) void renderReady(authState.user).catch((error: unknown) => reportError(error, 'app/render'));
}

onError(() => { const toast = document.querySelector<HTMLElement>('#error'); if (toast) { toast.textContent = copy('error'); toast.hidden = false; } });
observeAuth((state) => { authState = state; render(); });
window.addEventListener('online', render); window.addEventListener('offline', render);
navigator.serviceWorker?.addEventListener('controllerchange', () => location.reload());
render();
void registerPwaUpdates((registration) => { updateRegistration = registration; document.querySelector<HTMLElement>('#update')?.removeAttribute('hidden'); })
  .catch((error: unknown) => reportError(error, 'pwa/register'));
