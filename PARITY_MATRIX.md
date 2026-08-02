# Matriz de paridade KYRO

Legenda: ✅ fundação implementada; 🟡 iniciado; ⬜ ainda no baseline; 🔴 bloqueio externo.

| Capacidade | Baseline | v4 | Critério de aceite |
|---|---:|---:|---|
| Identidade visual/design tokens | ✅ | 🟡 | Comparação visual mobile/desktop, safe areas e reduced motion |
| PT/EN e unidades | ✅ | 🟡 | Fundação traduzida e unidade persistida; faltam strings das features |
| Auth email/Google/reset | ✅ | 🟡 | Implementado com SDK modular; falta Emulator/E2E conectado |
| Verificação de email | ✅ | 🟡 | Bloqueio, reenvio/cooldown e reload implementados; falta E2E |
| Onboarding | ✅ | 🟡 | Preferência inicial persistida; falta portar tour completo do produto |
| Treinos/rotinas/exercícios/séries | ✅ | 🟡 | Leitura validada, séries, carga/reps, volume e conclusão; faltam CRUD/reorder/timers/PR |
| Histórico/relatórios/conquistas | ✅ | 🟡 | Sessões são gravadas com cache/fila; faltam relatórios e conquistas |
| Readiness/progresso/medidas | ✅ | 🟡 | Peso, delta, sessões e readiness equivalentes; faltam medidas/gráficos |
| Nutrição/barcode/suplementos | ✅ | 🟡 | Refeições, macros e água offline; faltam barcode e suplementos |
| Fotos/comparação/Storage | ✅ | ⬜ | EXIF, limites, upload retry e exclusão confirmada |
| Compartilhamento | ✅ | ⬜ | Web Share files + fallback em Chromium/WebKit |
| Offline/fila | ✅ | 🟡 | Cache e fila de documentos integrados; faltam conflitos, quota e testes de reload |
| PWA/atualização | ✅ | 🟡 | install/update/rollback e suspensão iOS |
| Notificações | ✅ | ⬜ | permissão por gesto, push e timer local |
| Admin | ✅ | 🔴 | regras/claims e emulador versionados |
| Exclusão de conta | ✅ | 🔴 | backend idempotente apaga Auth/Firestore/Storage |
| Import/export/reset | ✅ | ⬜ | round-trip, limites, backup e rollback |

Paridade global: **não atingida**. O baseline continua sendo a versão operacional.
