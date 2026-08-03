# Matriz do roadmap premium

Legenda: **Pronto** = implementado/testado; **Parcial** = base funcional, expansão pendente; **Externo** = depende de conta, credencial, dispositivo ou revisão fora do código.

| Área                                           | Estado  | Evidência / próximo gate                                                     |
| ---------------------------------------------- | ------- | ---------------------------------------------------------------------------- |
| Vite, TypeScript strict, Firebase modular, Zod | Pronto  | `app-v4`, typecheck e build                                                  |
| Auth, verificação, reset, Google               | Parcial | Email e Emulator E2E prontos; Google real exige projeto homologado           |
| Custom claims, admin, bloqueio e exclusão      | Pronto  | Functions/Rules Emulator                                                     |
| Treinos, rotinas, séries, drafts e timers      | Pronto  | Fluxo v4 e testes unitários                                                  |
| Progressão, plateau e deload determinísticos   | Pronto  | Motor, RIR/RPE e aceite/recusa persistidos com aplicação da carga            |
| Readiness                                      | Pronto  | Score, plano automático e override com motivo persistido                     |
| Gym Occupied/substituições                     | Pronto  | Ranking muscular/equipamento e troca segura na rotina                        |
| Nutrição e barcode                             | Parcial | Macros/água/refeições/câmera prontos; fibra/favoritos/cópia pendentes        |
| Fotos privadas e comparação                    | Pronto  | Storage privado, fila, EXIF removido e resize local                          |
| Offline e sync                                 | Pronto  | IndexedDB v3, fila visível e resolução explícita local/nuvem sem overwrite   |
| PWA e atualização                              | Pronto  | Worker, manifesto, ícones e update consentido; gate iOS real                 |
| Compartilhamento                               | Parcial | Web Share/fallback prontos; templates sociais avançados pendentes            |
| Relatório e conquistas                         | Parcial | Semanal/streak/conquistas prontos; analytics muscular avançado pendente      |
| Entitlements Free/Pro/Coach                    | Parcial | Autoridade callable pronta; webhooks e produtos externos pendentes           |
| Stripe/RevenueCat/lojas                        | Externo | Requer contas, produtos, secrets, fiscalidade e aprovação                    |
| IA                                             | Externo | Arquitetura e guardrails documentados; provedor/consentimento/custo ausentes |
| FCM/Push remoto                                | Externo | Notificações locais prontas; APNs/VAPID/consentimento pendentes              |
| GDPR e documentos legais                       | Parcial | Fluxos técnicos e rascunhos prontos; revisão jurídica obrigatória            |
| CI/CD                                          | Parcial | CI completo sem deploy; staging/production exigem environments/secrets       |
| WCAG e performance                             | Parcial | Base e relatórios prontos; Lighthouse/VoiceOver/aparelhos reais pendentes    |

O produto permanece em alpha e o baseline continua operacional. Esta matriz substitui percentuais genéricos para o roadmap comercial ampliado.
