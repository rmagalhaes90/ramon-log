import './styles.css';
import { installGlobalErrorHandlers, onError, reportError } from './core/errors';
import { createI18n, type Locale } from './core/i18n';
import { observeAuth } from './features/auth';
import { queueList } from './services/database';
import { activateUpdate, registerPwaUpdates } from './services/pwa-update';

installGlobalErrorHandlers();
const i18n = createI18n();
i18n.setLocale(i18n.locale);

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing #app root');

root.innerHTML = `
  <header class="topbar"><a class="brand" href="./" aria-label="KYRO">KYRO<span>.</span></a>
    <div class="locale" role="group" aria-label="Language"><button data-locale="pt">PT</button><button data-locale="en">EN</button></div>
  </header>
  <main>
    <section class="hero"><p class="eyebrow" data-copy="foundation"></p><h1 data-copy="tagline"></h1>
      <div class="status"><span id="network"></span><span>·</span><span><span data-copy="queue"></span>: <b id="queue-count">0</b></span></div>
      <p class="auth-state" id="auth-state"></p>
      <a class="primary" href="../index.html" data-copy="baseline"></a>
    </section>
    <section class="feature-grid" aria-label="KYRO modules">
      <article><span>01</span><h2>TRAIN</h2><p>Workouts, routines, exercises and sets.</p></article>
      <article><span>02</span><h2>RECOVER</h2><p>Readiness, history and progress.</p></article>
      <article><span>03</span><h2>FUEL</h2><p>Nutrition and supplements.</p></article>
      <article><span>04</span><h2>SYNC</h2><p>Offline-first, private and resilient.</p></article>
    </section>
  </main>
  <aside id="error" class="toast error" role="alert" hidden></aside>
  <aside id="update" class="toast" role="status" hidden><span data-copy="update"></span><button id="update-now" data-copy="updateNow"></button></aside>
`;

function renderCopy(): void {
  document.querySelectorAll<HTMLElement>('[data-copy]').forEach((element) => {
    const key = element.dataset.copy;
    if (key && key in ({ foundation: 1, tagline: 1, baseline: 1, queue: 1, update: 1, updateNow: 1 } as const)) {
      element.textContent = i18n.t(key as 'foundation' | 'tagline' | 'baseline' | 'queue' | 'update' | 'updateNow');
    }
  });
  document.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach((button) => {
    button.ariaPressed = String(button.dataset.locale === i18n.locale);
  });
  renderNetwork();
}

function renderNetwork(): void {
  const network = document.querySelector('#network');
  if (network) network.textContent = i18n.t(navigator.onLine ? 'online' : 'offline');
}

async function renderQueue(): Promise<void> {
  const count = document.querySelector('#queue-count');
  if (count) count.textContent = String((await queueList()).length);
}

document.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach((button) => {
  button.addEventListener('click', () => {
    i18n.setLocale(button.dataset.locale as Locale);
    renderCopy();
  });
});
window.addEventListener('online', renderNetwork);
window.addEventListener('offline', renderNetwork);
onError(() => {
  const toast = document.querySelector<HTMLElement>('#error');
  if (toast) {
    toast.textContent = i18n.t('error');
    toast.hidden = false;
  }
});

const stopAuth = observeAuth((state) => {
  const target = document.querySelector('#auth-state');
  if (target) target.textContent = `${i18n.t('auth')} · ${state.status}`;
});
window.addEventListener('pagehide', stopAuth, { once: true });

let updateRegistration: ServiceWorkerRegistration | null = null;
document.querySelector('#update-now')?.addEventListener('click', () => {
  if (updateRegistration) activateUpdate(updateRegistration);
});
navigator.serviceWorker?.addEventListener('controllerchange', () => location.reload());

renderCopy();
void renderQueue().catch((error: unknown) => reportError(error, 'queue-render'));
void registerPwaUpdates((registration) => {
  updateRegistration = registration;
  const toast = document.querySelector<HTMLElement>('#update');
  if (toast) toast.hidden = false;
}).catch((error: unknown) => reportError(error, 'pwa-register'));
