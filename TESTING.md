# Testes

## Local

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` e `pnpm test:e2e` formam a barreira mínima. Chromium e WebKit mobile validam o shell; fluxos autenticados usam exclusivamente Emulator.

Com Java 21 no `PATH`: `pnpm test:emulator:auth`, `pnpm test:e2e:auth`, `pnpm test:emulator:rules` e `pnpm test:emulator:functions`.

## CI

`.github/workflows/ci.yml` executa instalação limpa, formato, tipos, lint, unitários, build, browsers, E2E, Emulators e audit. Não faz deploy.

Testes em aparelho real continuam obrigatórios para câmera, Web Share, instalação PWA, safe areas e notificações iOS.
