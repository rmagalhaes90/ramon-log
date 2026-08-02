# Arquitetura KYRO v4

## Estratégia paralela

O produto estável permanece nos arquivos da raiz. A aplicação v4 vive em `app-v4/` e gera `dist-v4/`; não substitui nem publica o baseline. O corte só ocorrerá quando a matriz de paridade estiver aprovada e houver plano de rollback.

## Camadas

```text
features (auth, workouts, progress, nutrition, admin)
       ↓
services (Firebase modular, IndexedDB, offline queue, PWA updates)
       ↓
core (errors, i18n, validation, design tokens)
```

- Features possuem UI, estado e casos de uso; não acessam SDKs diretamente.
- Services encapsulam efeitos externos e retornam resultados tipados.
- Zod valida fronteiras: Firestore, importações, IndexedDB, rede e mensagens do SW.
- O estado confirmado remoto e o estado otimista local são distintos. Toda mutação offline recebe ID idempotente, usuário, instante e política de retry.
- Erros inesperados chegam ao reporter global; erros de domínio são exibidos próximos à ação e nunca descartados silenciosamente.

## Dados e sincronização

IndexedDB contém cache versionado e fila. O processador sincroniza apenas quando autenticado e online, aplica backoff, preserva falhas e só remove uma operação após confirmação. Migrações futuras nunca apagam o namespace legado. Adaptadores de leitura poderão importar `ramon_log_*` depois de snapshot, validação e confirmação de escrita.

## Segurança

O cliente não decide autorização. Firestore Rules, Storage Rules e testes de emulador serão obrigatórios antes de migrar admin ou exclusão. Segredos operacionais não entram no bundle; identificadores públicos Firebase vêm de `.env` validado.

## Build e qualidade

TypeScript strict, ESLint type-aware, Prettier, Vitest e Playwright compõem o gate. Vite gera assets com hash. A PWA v4 usa SW independente e nunca deve controlar o escopo do baseline durante desenvolvimento/migração.
