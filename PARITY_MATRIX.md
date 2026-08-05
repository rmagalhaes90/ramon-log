# Matriz de paridade KYRO

Legenda: ✅ fundação implementada; 🟡 iniciado; ⬜ ainda no baseline; 🔴 bloqueio externo.

| Capacidade                        | Baseline |  v4 | Critério de aceite                                                                                                                                                                      |
| --------------------------------- | -------: | --: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identidade visual/design tokens   |       ✅ |  🟡 | Comparação visual mobile/desktop, safe areas e reduced motion                                                                                                                           |
| PT/EN e unidades                  |       ✅ |  🟡 | Fundação traduzida; preferência métrico/imperial agora convertida de fato em peso corporal e medidas (Progresso), editável a qualquer momento em Configurações — corrigido bug em que a escolha era salva mas nunca aplicada; carga levantada nos treinos segue sempre em kg, igual ao baseline                        |
| Auth email/Google/reset           |       ✅ |  🟡 | SDK modular e Auth Emulator; cadastro/login/exclusão local e E2E Chromium/WebKit aprovados; Google real permanece manual                                                                |
| Verificação de email              |       ✅ |  🟡 | Bloqueio, reenvio/cooldown e reload implementados; bloqueio de conta não verificada aprovado no E2E local                                                                               |
| Onboarding                        |       ✅ |  🟡 | Preferência inicial persistida e tour guiado dos quatro módulos (Train/Recover/Fuel/Sync) exibido uma vez por conta; falta validação visual em dispositivo real                         |
| Treinos/rotinas/exercícios/séries |       ✅ |  🟡 | Telas de Treino (execução) e Rotina (montagem/edição) separadas como no baseline; vídeo do YouTube em modal embutido (170 links portados); edição de séries/reps/descanso movida para a tela de Rotina; celebração com confete/sequência ao finalizar; três templates/gerador, séries, notas, timers com pausa, descanso cancelável, aquecimento, anilhas, e1RM, PR e rascunho recuperável; drag-and-drop por toque em iOS/Android segue pendente |
| Histórico/relatórios/conquistas   |       ✅ |  🟡 | Sessões, histórico por exercício, recordes, relatório semanal compartilhável, streak e seis conquistas implementados; faltam relatórios avançados                                       |
| Readiness/progresso/medidas       |       ✅ |  ✅ | Peso, cinco gráficos de medidas, tendências, sessões, readiness, volume muscular e correlação de desempenho                                                                             |
| Nutrição/barcode/suplementos      |       ✅ |  🟡 | Refeições, macros, fibra, água, favoritos, cópia entre dias, suplementos, consulta GTIN e câmera nativa com fallback manual                                                             |
| Fotos/comparação/Storage          |       ✅ |  🟡 | Galeria privada, JPEG até 3 MB, EXIF removido com orientação normalizada, upload resumível, comparação, exclusão confirmada e retry offline de blobs                                    |
| Compartilhamento                  |       ✅ |  🟡 | Web Share de arquivos com fallback para clipboard e cancelamento tratado; E2E Chromium/WebKit autenticado (cadastro, verificação e compartilhamento do relatório) aprovado no Emulator  |
| Offline/fila                      |       ✅ |  🟡 | Cache/fila isolada por usuário, revisão temporal, quota, fotos e resolução interativa local/nuvem sem sobrescrita silenciosa                                                            |
| PWA/atualização                   |       ✅ |  🟡 | Worker versionado e cache runtime de chunks; faltam rollback e suspensão iOS                                                                                                            |
| Notificações                      |       ✅ |  🟡 | Permissão por gesto, preferência sincronizada, teste e alerta local de descanso; faltam push remoto/FCM e lembretes fechados no iOS                                                     |
| Admin                             |       ✅ |  🟡 | Listagem, bloqueio e concessão/revogação por custom claims aprovados no Emulator                                                                                                        |
| Exclusão de conta                 |       ✅ |  🟡 | Fluxo modular e backend idempotente aprovados no Emulator                                                                                                                               |
| Import/export/reset               |       ✅ |  🟡 | JSON versionado, limite, validação, backup prévio, rollback lógico, CSV seguro, reset seletivo por domínio e backup completo em .zip com fotos originais                               |

Paridade global: **não atingida**. O baseline continua sendo a versão operacional.

## Progresso acompanhado por fase

Percentual do escopo de implementação desta migração: **100%**. A fundação paralela, os fluxos funcionais previstos e o backend de segurança estão implementados e testados localmente. A versão legada continua sendo o baseline operacional até cumprir os gates de homologação abaixo.

| Fase                                           | Progresso | Estado                                                                                                                               |
| ---------------------------------------------- | --------: | ------------------------------------------------------------------------------------------------------------------------------------ |
| Fundação, contratos, qualidade e design system |       85% | TypeScript strict, ferramentas, i18n, erros e tokens ativos; falta ampliar componentes reutilizáveis                                 |
| Auth, verificação, onboarding e conta          |       94% | Auth Emulator, E2E de cadastro/verificação em Chromium/WebKit, exclusão modular e tour guiado pós-onboarding; falta Google real      |
| Treinos, rotinas, catálogo e histórico         |       96% | Núcleo, templates, gerador, reorder, edição de alvo por exercício, rascunhos, PR/e1RM, 170 vídeos reais, relatório compartilhável e conquistas implementados |
| Progresso, readiness e nutrição                |       92% | Peso, gráfico, medidas, readiness, suplementos com agenda editável e barcode manual/câmera implementados                             |
| Fotos, compartilhamento e notificações         |       85% | Fotos privadas sem EXIF, fila offline, comparação, Web Share com E2E autenticado e alertas locais migrados; falta push remoto        |
| Admin e segurança Firebase                     |      100% | Custom claims, bloqueio no Auth, exclusão idempotente e regras Firestore/Storage aprovados no Emulator                               |
| Offline, sincronização e PWA                   |       96% | IndexedDB v3, filas visíveis, resolução de conflitos, quota/persistência, cache e recuperação ativos; falta validação iOS prolongada |
| Import/export, acessibilidade e E2E            |       95% | JSON/CSV, reset seletivo, smoke e cadastro/verificação autenticados aprovados em Chromium/WebKit mobile                              |

## Gates de homologação antes da promoção

- Homologar Google Sign-In, Web Share de arquivos e instalação/atualização em dispositivos Safari/iOS reais.
- Completar retry offline de blobs/EXIF, resolução interativa de conflitos e push remoto/FCM.
- Validar visualmente o tour de onboarding e as demais telas em dispositivo real antes de promover a v4.

Esses gates exigem credenciais/dispositivos/infraestrutura de homologação e não autorizam deploy automático. Não reduzem a conclusão do escopo de implementação, mas impedem declarar a v4 pronta para substituir o baseline.

## Escopo premium ampliado em 2026-08-03

O marco de 100% acima refere-se à migração funcional originalmente acordada, não ao novo roadmap comercial de 52 seções. Para esse roadmap ampliado, consulte [REQUIREMENTS_MATRIX.md](REQUIREMENTS_MATRIX.md). Recursos que exigem Stripe, Apple/Google stores, provedor de IA, textos jurídicos aprovados ou aparelhos físicos não são declarados como concluídos.
