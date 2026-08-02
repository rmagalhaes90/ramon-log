# Matriz de paridade KYRO

Legenda: ✅ fundação implementada; 🟡 iniciado; ⬜ ainda no baseline; 🔴 bloqueio externo.

| Capacidade | Baseline | v4 | Critério de aceite |
|---|---:|---:|---|
| Identidade visual/design tokens | ✅ | 🟡 | Comparação visual mobile/desktop, safe areas e reduced motion |
| PT/EN e unidades | ✅ | 🟡 | Fundação traduzida e unidade persistida; faltam strings das features |
| Auth email/Google/reset | ✅ | 🟡 | Implementado com SDK modular; falta Emulator/E2E conectado |
| Verificação de email | ✅ | 🟡 | Bloqueio, reenvio/cooldown e reload implementados; falta E2E |
| Onboarding | ✅ | 🟡 | Preferência inicial persistida; falta portar tour completo do produto |
| Treinos/rotinas/exercícios/séries | ✅ | 🟡 | Catálogo completo, edição, reordenação, três templates/gerador, séries, notas, timers, aquecimento, anilhas, e1RM, PR e rascunho recuperável; faltam drag-and-drop e vídeos |
| Histórico/relatórios/conquistas | ✅ | 🟡 | Sessões, histórico por exercício, recordes, relatório semanal, streak e seis conquistas implementados; faltam relatórios avançados/compartilháveis |
| Readiness/progresso/medidas | ✅ | 🟡 | Peso, gráfico SVG, cinco medidas, sessões e readiness implementados; faltam gráficos por medida e tendências avançadas |
| Nutrição/barcode/suplementos | ✅ | 🟡 | Refeições, macros, água, suplementos e consulta GTIN pela API v3 do Open Food Facts; faltam leitura por câmera e edição avançada de horários |
| Fotos/comparação/Storage | ✅ | 🟡 | Galeria privada, JPEG até 3 MB, upload resumível, comparação e exclusão confirmada; faltam EXIF/orientação e retry offline de blobs |
| Compartilhamento | ✅ | 🟡 | Web Share de arquivos com fallback para clipboard e cancelamento tratado; falta E2E Chromium/WebKit autenticado |
| Offline/fila | ✅ | 🟡 | Cache/fila integrados e rascunho de treino restaurável por 24 h; faltam conflitos multi-dispositivo, quota e fila de blobs |
| PWA/atualização | ✅ | 🟡 | Worker versionado e cache runtime de chunks; faltam rollback e suspensão iOS |
| Notificações | ✅ | 🟡 | Permissão por gesto, preferência sincronizada, teste e alerta local de descanso; faltam push remoto/FCM e lembretes fechados no iOS |
| Admin | ✅ | 🟡 | listagem, bloqueio e concessão/revogação v4; faltam claims e testes Emulator |
| Exclusão de conta | ✅ | 🟡 | fluxo modular completo no cliente; backend idempotente ainda recomendado |
| Import/export/reset | ✅ | 🟡 | JSON versionado, limite, validação, backup prévio, rollback lógico e CSV seguro; fotos binárias e reset seletivo ainda faltam |

Paridade global: **não atingida**. O baseline continua sendo a versão operacional.

## Progresso acompanhado por fase

Percentual estimado da migração funcional: **80%**. A estimativa pondera paridade de comportamento e validação, não apenas quantidade de arquivos.

| Fase | Progresso | Estado |
|---|---:|---|
| Fundação, contratos, qualidade e design system | 85% | TypeScript strict, ferramentas, i18n, erros e tokens ativos; falta ampliar componentes reutilizáveis |
| Auth, verificação, onboarding e conta | 70% | Fluxos principais implementados; faltam tour completo e E2E com Emulator |
| Treinos, rotinas, catálogo e histórico | 88% | Núcleo, templates, gerador, reorder, rascunhos, PR/e1RM, relatórios e conquistas implementados |
| Progresso, readiness e nutrição | 82% | Peso, gráfico, medidas, readiness, suplementos e consulta por barcode implementados |
| Fotos, compartilhamento e notificações | 60% | Fotos privadas, comparação, Web Share e alertas locais migrados; faltam EXIF e push remoto |
| Admin e segurança Firebase | 55% | UI, regras e bloqueio implementados; faltam claims/backend e testes Emulator |
| Offline, sincronização e PWA | 70% | IndexedDB, fila, cache e recuperação de treino ativos; faltam conflitos multi-dispositivo, quota e validação iOS prolongada |
| Import/export, acessibilidade e E2E | 65% | JSON/CSV validados e smoke tests configurados; faltam binários, reset seletivo e E2E completo |
