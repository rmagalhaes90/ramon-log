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
| Readiness/progresso/medidas | ✅ | 🟡 | Peso, gráfico SVG, cinco medidas, sessões e readiness implementados; faltam gráficos por medida e tendências avançadas |
| Nutrição/barcode/suplementos | ✅ | 🟡 | Refeições, macros, água e catálogo de suplementos com agenda/check diário offline; falta barcode e edição avançada de horários |
| Fotos/comparação/Storage | ✅ | 🟡 | Galeria privada, JPEG até 3 MB, upload resumível, comparação e exclusão confirmada; faltam EXIF/orientação e retry offline de blobs |
| Compartilhamento | ✅ | 🟡 | Web Share de arquivos com fallback para clipboard e cancelamento tratado; falta E2E Chromium/WebKit autenticado |
| Offline/fila | ✅ | 🟡 | Cache e fila de documentos integrados; faltam conflitos, quota e testes de reload |
| PWA/atualização | ✅ | 🟡 | Worker versionado e cache runtime de chunks; faltam rollback e suspensão iOS |
| Notificações | ✅ | 🟡 | Permissão por gesto, preferência sincronizada, teste e alerta local de descanso; faltam push remoto/FCM e lembretes fechados no iOS |
| Admin | ✅ | 🟡 | listagem, bloqueio e concessão/revogação v4; faltam claims e testes Emulator |
| Exclusão de conta | ✅ | 🟡 | fluxo modular completo no cliente; backend idempotente ainda recomendado |
| Import/export/reset | ✅ | 🟡 | JSON versionado, limite de 5 MB, validação estrita, backup prévio e rollback lógico; fotos binárias e reset seletivo ainda faltam |

Paridade global: **não atingida**. O baseline continua sendo a versão operacional.

## Progresso acompanhado por fase

Percentual estimado da migração funcional: **65%**. A estimativa pondera paridade de comportamento e validação, não apenas quantidade de arquivos.

| Fase | Progresso | Estado |
|---|---:|---|
| Fundação, contratos, qualidade e design system | 85% | TypeScript strict, ferramentas, i18n, erros e tokens ativos; falta ampliar componentes reutilizáveis |
| Auth, verificação, onboarding e conta | 70% | Fluxos principais implementados; faltam tour completo e E2E com Emulator |
| Treinos, rotinas, catálogo e histórico | 60% | Núcleo operacional, timers, notas, PR/e1RM e histórico implementados |
| Progresso, readiness e nutrição | 65% | Peso, gráfico, medidas, readiness e suplementos implementados; faltam tendências avançadas e barcode |
| Fotos, compartilhamento e notificações | 60% | Fotos privadas, comparação, Web Share e alertas locais migrados; faltam EXIF e push remoto |
| Admin e segurança Firebase | 55% | UI, regras e bloqueio implementados; faltam claims/backend e testes Emulator |
| Offline, sincronização e PWA | 55% | IndexedDB, fila e cache de chunks ativos; faltam conflitos, quota, rollback e validação iOS prolongada |
| Import/export, acessibilidade e E2E | 50% | Backup/importação validados e smoke tests configurados; faltam binários, reset seletivo e E2E completo |
