# KYRO v4

KYRO — Your Intelligent Gym Progression System. A v4 é uma aplicação paralela Vite + TypeScript strict; o baseline legado permanece intacto na raiz durante a homologação.

## Desenvolvimento

Requisitos: Node 22+, pnpm 11 e Java 21 para os emuladores Firestore/Storage.

```bash
pnpm install
pnpm --dir functions --ignore-workspace install --frozen-lockfile --ignore-scripts
pnpm dev
```

Acesse `http://127.0.0.1:5173`. Para dados isolados, inicie os Emulators com o projeto reservado `demo-kyro-v4` e defina `VITE_USE_FIREBASE_EMULATORS=true` no processo do Vite.

## Qualidade

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm test:emulator:rules
pnpm test:emulator:functions
```

Consulte [TESTING.md](TESTING.md), [FIREBASE_SETUP.md](FIREBASE_SETUP.md) e [DEPLOYMENT.md](DEPLOYMENT.md). Nenhum deploy é automático.

## Estrutura

- `app-v4/src/features`: domínios funcionais.
- `app-v4/src/services`: Firebase, IndexedDB, sync, Storage e PWA.
- `functions`: backend confiável para claims, bloqueio e exclusão.
- `app-v4/tests` e `app-v4/e2e`: Vitest e Playwright.
- `index.html`: baseline preservado; não é a composition root da v4.

## Segurança e privacidade

Nunca use dados de produção no desenvolvimento. As chaves web Firebase são identificadores públicos; autorização depende de Rules e custom claims. Consulte [SECURITY.md](SECURITY.md) e [PRIVACY_POLICY.md](PRIVACY_POLICY.md).
