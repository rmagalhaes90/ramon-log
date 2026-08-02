export type Locale = 'pt' | 'en';

const messages = {
  pt: {
    tagline: 'Treino e progresso, mesmo offline.',
    foundation: 'Fundação v4 em construção',
    baseline: 'Abrir versão estável',
    online: 'Online',
    offline: 'Offline — alterações entrarão na fila',
    update: 'Nova versão disponível',
    updateNow: 'Atualizar agora',
    auth: 'Autenticação modular pronta para integração',
    queue: 'Itens pendentes',
    error: 'Algo não saiu como esperado. Seus dados locais foram preservados.',
  },
  en: {
    tagline: 'Training and progress, even offline.',
    foundation: 'v4 foundation in progress',
    baseline: 'Open stable version',
    online: 'Online',
    offline: 'Offline — changes will be queued',
    update: 'A new version is available',
    updateNow: 'Update now',
    auth: 'Modular authentication ready for integration',
    queue: 'Pending items',
    error: 'Something went wrong. Your local data was preserved.',
  },
} as const;

export type MessageKey = keyof (typeof messages)['pt'];

export function detectLocale(): Locale {
  const query = new URLSearchParams(location.search).get('lang');
  if (query === 'pt' || query === 'en') return query;
  const saved = localStorage.getItem('kyro-v4-locale');
  if (saved === 'pt' || saved === 'en') return saved;
  return /^pt(?:-|$)/i.test(navigator.language) ? 'pt' : 'en';
}

export function createI18n(initial = detectLocale()) {
  let locale: Locale = initial;
  return {
    get locale() {
      return locale;
    },
    t: (key: MessageKey): string => messages[locale][key],
    setLocale(next: Locale): void {
      locale = next;
      localStorage.setItem('kyro-v4-locale', next);
      document.documentElement.lang = next === 'pt' ? 'pt-BR' : 'en';
    },
  };
}
