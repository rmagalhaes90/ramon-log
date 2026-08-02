# Matriz de paridade KYRO

Legenda: ✅ fundação implementada; 🟡 iniciado; ⬜ ainda no baseline; 🔴 bloqueio externo.

| Capacidade | Baseline | v4 | Critério de aceite |
|---|---:|---:|---|
| Identidade visual/design tokens | ✅ | 🟡 | Comparação visual mobile/desktop, safe areas e reduced motion |
| PT/EN e unidades | ✅ | 🟡 | 100% das strings, persistência e troca sem reload |
| Auth email/Google/reset | ✅ | 🟡 | Emulator + fluxos E2E e cancelamento de sessão |
| Verificação de email | ✅ | 🟡 | Bloqueio, reenvio/cooldown e retorno por deep link |
| Onboarding | ✅ | ⬜ | Novo usuário e usuário com dados, acessível e retomável |
| Treinos/rotinas/exercícios/séries | ✅ | ⬜ | CRUD, reorder, notas, timer, PR e dados equivalentes |
| Histórico/relatórios/conquistas | ✅ | ⬜ | Cálculos validados com fixtures do legado |
| Readiness/progresso/medidas | ✅ | ⬜ | Fórmulas e gráficos com tolerância definida |
| Nutrição/barcode/suplementos | ✅ | ⬜ | CRUD offline e integração abortável |
| Fotos/comparação/Storage | ✅ | ⬜ | EXIF, limites, upload retry e exclusão confirmada |
| Compartilhamento | ✅ | ⬜ | Web Share files + fallback em Chromium/WebKit |
| Offline/fila | ✅ | 🟡 | Reload offline, conflitos, quota e retry idempotente |
| PWA/atualização | ✅ | 🟡 | install/update/rollback e suspensão iOS |
| Notificações | ✅ | ⬜ | permissão por gesto, push e timer local |
| Admin | ✅ | 🔴 | regras/claims e emulador versionados |
| Exclusão de conta | ✅ | 🔴 | backend idempotente apaga Auth/Firestore/Storage |
| Import/export/reset | ✅ | ⬜ | round-trip, limites, backup e rollback |

Paridade global: **não atingida**. O baseline continua sendo a versão operacional.
