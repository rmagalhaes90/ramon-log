# Changelog

## Unreleased — KYRO v4 foundation

### Added

- Fundação paralela Vite + TypeScript strict, sem substituir o baseline.
- ESLint type-aware, Prettier, Vitest e Playwright (Chromium/WebKit mobile).
- Firebase SDK modular com ambiente validado.
- i18n PT/EN, tokens visuais KYRO e shell responsivo.
- IndexedDB, contrato Zod e fila offline com backoff.
- Tratamento global de erros e novo fluxo de atualização PWA baseado em worker `waiting`.
- Auditoria, arquitetura, matriz de paridade, guia de migração, segurança e relatório de testes.
- Fluxo modular de autenticação por email/senha e Google, recuperação, verificação de email, bloqueio administrativo e logout.
- Onboarding inicial com preferência de unidades persistida em IndexedDB.
- Contratos Zod para exercícios, treinos, séries, sessões, readiness, nutrição, perfil, peso e fotos.

### Preserved

- Aplicação legada, Service Worker, manifests, versão e ícones permanecem sem alterações.

### Not yet migrated

- Features de produto permanecem no baseline até implementação e validação item a item na matriz de paridade.
