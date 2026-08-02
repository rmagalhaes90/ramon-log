import './styles.css';
import type { User } from 'firebase/auth';
import { installGlobalErrorHandlers, onError, reportError } from './core/errors';
import { createI18n, type Locale, type MessageKey } from './core/i18n';
import {
  authErrorKey, createAccount, loginWithGoogle, loginWithPassword, logout, observeAuth,
  refreshVerification, requestPasswordReset, resendVerification, type AuthState,
} from './features/auth';
import { cacheGet, cacheSet, queueList } from './services/database';
import { activateUpdate, registerPwaUpdates } from './services/pwa-update';

installGlobalErrorHandlers();
const i18n = createI18n();
i18n.setLocale(i18n.locale);
const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing #app root');
const appRoot = root;

let authState: AuthState = { status: 'loading', user: null };
let authMode: 'login' | 'signup' = 'login';
let updateRegistration: ServiceWorkerRegistration | null = null;

function copy(key: MessageKey): string { return i18n.t(key); }

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
      .then(renderDashboard).catch((error: unknown) => reportError(error, 'onboarding/save'));
  });
}

async function renderReady(user: User): Promise<void> {
  if (await needsOnboarding(user)) { renderOnboarding(user); return; }
  renderDashboard();
}

function renderDashboard(): void {
  shell(`<section class="hero"><p class="eyebrow">${copy('foundation')}</p><h1>${copy('tagline')}</h1>
    <div class="status"><span id="network">${copy(navigator.onLine ? 'online' : 'offline')}</span><span>·</span><span>${copy('queue')}: <b id="queue-count">0</b></span></div>
    <button id="logout" class="link-button">${copy('logout')}</button></section>
    <section class="feature-grid" aria-label="KYRO modules"><article><span>01</span><h2>TRAIN</h2><p>Workouts, routines, exercises and sets.</p></article>
    <article><span>02</span><h2>RECOVER</h2><p>Readiness, history and progress.</p></article><article><span>03</span><h2>FUEL</h2><p>Nutrition and supplements.</p></article>
    <article><span>04</span><h2>SYNC</h2><p>Offline-first, private and resilient.</p></article></section>`);
  document.querySelector('#logout')?.addEventListener('click', () => void logout().catch((error: unknown) => reportError(error, 'auth/logout')));
  void queueList().then((items) => { const count = document.querySelector('#queue-count'); if (count) count.textContent = String(items.length); })
    .catch((error: unknown) => reportError(error, 'queue/render'));
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
