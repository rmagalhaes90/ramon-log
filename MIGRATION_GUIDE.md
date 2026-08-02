# Guia de migração KYRO v4

## Testes Firebase locais

Com Java 21+ no `PATH`, execute `pnpm test:emulator:auth`, `pnpm test:e2e:auth` e `pnpm test:emulator:rules`. Todos usam o projeto reservado `demo-kyro-v4`; tentativas de acessar serviços reais são bloqueadas pelo Firebase CLI.

## Execução local

1. Copie `.env.example` para `.env.local` e preencha um projeto Firebase de desenvolvimento.
2. Execute `npm install`.
3. Execute `npm run dev`; a v4 abre na raiz do servidor Vite e oferece link explícito para o baseline.
4. Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` e, com browsers instalados, `npm run test:e2e`.

## Fases

1. Fundação: tooling, design tokens, i18n, erros, Firebase modular, IndexedDB, fila e PWA.
2. Contratos: esquemas Zod para todos os documentos e fixtures anonimizadas do legado.
3. Migração vertical: auth/onboarding; treinos; progresso; nutrição; fotos/share; admin/notificações.
4. Shadow mode: v4 lê cópias, compara cálculos e não escreve no namespace produtivo.
5. Migração por usuário: snapshot, validação, escrita idempotente, verificação e marcador de conclusão. Nunca apagar origem.
6. Cutover gradual com rollback para o baseline e monitoramento de filas/erros.

## Compatibilidade de dados

O baseline usa `users/{uid}/data/{key}`, `sharedUsers/{uid}`, `shared/exerciseDatabase` e Storage em `users/{uid}/photos`. Esses caminhos permanecem congelados até regras e schemas serem testados. A v4 não deve habilitar escrita produtiva por padrão durante a fundação.

## Publicação

Não publicar no GitHub Pages nesta migração. O artefato `dist-v4/` é apenas verificável localmente. Um Draft PR pode ser aberto quando todos os gates da fundação estiverem verdes; isso não autoriza merge nem deploy.
