# Matriz de paridade KYRO

Legenda: ✅ fundação implementada; 🟡 iniciado; ⬜ ainda no baseline; 🔴 bloqueio externo.

| Capacidade | Baseline | v4 | Critério de aceite |
|---|---:|---:|---|
| Identidade visual/design tokens | ✅ | 🟡 | Comparação visual mobile/desktop, safe areas e reduced motion |
| PT/EN e unidades | ✅ | 🟡 | Fundação traduzida e unidade persistida; faltam strings das features |
| Auth email/Google/reset | ✅ | 🟡 | Implementado com SDK modular; falta Emulator/E2E conectado |
| Verificação de email | ✅ | 🟡 | Bloqueio, reenvio/cooldown e reload implementados; falta E2E |
| Onboarding | ✅ | 🟡 | Preferência inicial persistida; falta portar tour completo do produto |
| Treinos/rotinas/exercícios/séries | ✅ | 🟡 | Catálogo completo, rename/add/remove, séries e conclusão; faltam reorder/timers/PR |
| Histórico/relatórios/conquistas | ✅ | 🟡 | Sessões são gravadas com cache/fila; faltam relatórios e conquistas |
| Readiness/progresso/medidas | ✅ | 🟡 | Peso, delta, sessões e readiness equivalentes; faltam medidas/gráficos |
| Nutrição/barcode/suplementos | ✅ | 🟡 | Refeições, macros e água offline; faltam barcode e suplementos |
| Fotos/comparação/Storage | ✅ | ⬜ | EXIF, limites, upload retry e exclusão confirmada |
| Compartilhamento | ✅ | ⬜ | Web Share files + fallback em Chromium/WebKit |
| Offline/fila | ✅ | 🟡 | Cache e fila de documentos integrados; faltam conflitos, quota e testes de reload |
| PWA/atualização | ✅ | 🟡 | Worker versionado e cache runtime de chunks; faltam rollback e suspensão iOS |
| Notificações | ✅ | ⬜ | permissão por gesto, push e timer local |
| Admin | ✅ | 🟡 | listagem, bloqueio e concessão/revogação v4; faltam claims e testes Emulator |
| Exclusão de conta | ✅ | 🟡 | fluxo modular completo no cliente; backend idempotente ainda recomendado |
| Import/export/reset | ✅ | ⬜ | round-trip, limites, backup e rollback |

Paridade global: **não atingida**. O baseline continua sendo a versão operacional.
