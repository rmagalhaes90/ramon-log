# Matriz de paridade KYRO

Legenda: ✅ fundação implementada; 🟡 iniciado; ⬜ ainda no baseline; 🔴 bloqueio externo.

| Capacidade | Baseline | v4 | Critério de aceite |
|---|---:|---:|---|
| Identidade visual/design tokens | ✅ | 🟡 | Comparação visual mobile/desktop, safe areas e reduced motion |
| PT/EN e unidades | ✅ | 🟡 | Fundação traduzida e unidade persistida; faltam strings das features |
| Auth email/Google/reset | ✅ | 🟡 | Implementado com SDK modular; falta Emulator/E2E conectado |
| Verificação de email | ✅ | 🟡 | Bloqueio, reenvio/cooldown e reload implementados; falta E2E |
| Onboarding | ✅ | 🟡 | Preferência inicial persistida; falta portar tour completo do produto |
| Treinos/rotinas/exercícios/séries | ✅ | 🟡 | Catálogo completo, rename/add/remove, séries, notas, timer de sessão/descanso, aquecimento, anilhas, e1RM e PR; faltam reorder, gerador e templates avançados |
| Histórico/relatórios/conquistas | ✅ | 🟡 | Sessões, histórico por exercício e recordes são gravados com cache/fila; faltam relatórios visuais e conquistas |
| Readiness/progresso/medidas | ✅ | 🟡 | Peso, delta, sessões e readiness equivalentes; faltam medidas/gráficos |
| Nutrição/barcode/suplementos | ✅ | 🟡 | Refeições, macros, água e catálogo de suplementos com agenda/check diário offline; falta barcode e edição avançada de horários |
| Fotos/comparação/Storage | ✅ | ⬜ | EXIF, limites, upload retry e exclusão confirmada |
| Compartilhamento | ✅ | ⬜ | Web Share files + fallback em Chromium/WebKit |
| Offline/fila | ✅ | 🟡 | Cache e fila de documentos integrados; faltam conflitos, quota e testes de reload |
| PWA/atualização | ✅ | 🟡 | Worker versionado e cache runtime de chunks; faltam rollback e suspensão iOS |
| Notificações | ✅ | ⬜ | permissão por gesto, push e timer local |
| Admin | ✅ | 🟡 | listagem, bloqueio e concessão/revogação v4; faltam claims e testes Emulator |
| Exclusão de conta | ✅ | 🟡 | fluxo modular completo no cliente; backend idempotente ainda recomendado |
| Import/export/reset | ✅ | ⬜ | round-trip, limites, backup e rollback |

Paridade global: **não atingida**. O baseline continua sendo a versão operacional.

## Progresso acompanhado por fase

Percentual estimado da migração funcional: **48%**. A estimativa pondera paridade de comportamento e validação, não apenas quantidade de arquivos.

| Fase | Progresso | Estado |
|---|---:|---|
| Fundação, contratos, qualidade e design system | 85% | TypeScript strict, ferramentas, i18n, erros e tokens ativos; falta ampliar componentes reutilizáveis |
| Auth, verificação, onboarding e conta | 70% | Fluxos principais implementados; faltam tour completo e E2E com Emulator |
| Treinos, rotinas, catálogo e histórico | 60% | Núcleo operacional, timers, notas, PR/e1RM e histórico implementados |
| Progresso, readiness e nutrição | 50% | Dados essenciais e suplementos implementados; faltam gráficos, medidas e barcode |
| Fotos, compartilhamento e notificações | 5% | Contratos iniciais existem; interfaces e fluxos continuam no baseline |
| Admin e segurança Firebase | 55% | UI, regras e bloqueio implementados; faltam claims/backend e testes Emulator |
| Offline, sincronização e PWA | 55% | IndexedDB, fila e cache de chunks ativos; faltam conflitos, quota, rollback e validação iOS prolongada |
| Import/export, acessibilidade e E2E | 15% | Smoke tests configurados; fluxos completos ainda não migrados |
