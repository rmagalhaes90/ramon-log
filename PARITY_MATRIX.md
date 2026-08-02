# Matriz de paridade KYRO

Legenda: ✅ fundação implementada; 🟡 iniciado; ⬜ ainda no baseline; 🔴 bloqueio externo.

| Capacidade                        | Baseline |  v4 | Critério de aceite                                                                                                                                                                                                      |
| --------------------------------- | -------: | --: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identidade visual/design tokens   |       ✅ |  🟡 | Comparação visual mobile/desktop, safe areas e reduced motion                                                                                                                                                           |
| PT/EN e unidades                  |       ✅ |  🟡 | Fundação traduzida e unidade persistida; faltam strings das features                                                                                                                                                    |
| Auth email/Google/reset           |       ✅ |  🟡 | SDK modular e Auth Emulator; cadastro/login/exclusão local e E2E Chromium/WebKit aprovados; Google real permanece manual                                                                                                |
| Verificação de email              |       ✅ |  🟡 | Bloqueio, reenvio/cooldown e reload implementados; bloqueio de conta não verificada aprovado no E2E local                                                                                                               |
| Onboarding                        |       ✅ |  🟡 | Preferência inicial persistida; falta portar tour completo do produto                                                                                                                                                   |
| Treinos/rotinas/exercícios/séries |       ✅ |  🟡 | Catálogo completo, edição, reordenação, três templates/gerador, séries, notas, timers, aquecimento, anilhas, e1RM, PR, rascunho recuperável e links de vídeo HTTPS; falta drag-and-drop                                 |
| Histórico/relatórios/conquistas   |       ✅ |  🟡 | Sessões, histórico por exercício, recordes, relatório semanal compartilhável, streak e seis conquistas implementados; faltam relatórios avançados                                                                       |
| Readiness/progresso/medidas       |       ✅ |  🟡 | Peso, gráfico SVG, cinco medidas, sessões e readiness implementados; faltam gráficos por medida e tendências avançadas                                                                                                  |
| Nutrição/barcode/suplementos      |       ✅ |  🟡 | Refeições, macros, água, suplementos com inclusão/remoção de horários, consulta GTIN e câmera nativa com fallback manual                                                                                                |
| Fotos/comparação/Storage          |       ✅ |  🟡 | Galeria privada, JPEG até 3 MB, upload resumível, comparação e exclusão confirmada; faltam EXIF/orientação e retry offline de blobs                                                                                     |
| Compartilhamento                  |       ✅ |  🟡 | Web Share de arquivos com fallback para clipboard e cancelamento tratado; falta E2E Chromium/WebKit autenticado                                                                                                         |
| Offline/fila                      |       ✅ |  🟡 | Cache/fila isolada por usuário, prioridade para mudanças locais pendentes, revisão temporal, quota/persistência, rascunho de treino e fila limitada de JPEGs; falta resolução interativa de conflitos multi-dispositivo |
| PWA/atualização                   |       ✅ |  🟡 | Worker versionado e cache runtime de chunks; faltam rollback e suspensão iOS                                                                                                                                            |
| Notificações                      |       ✅ |  🟡 | Permissão por gesto, preferência sincronizada, teste e alerta local de descanso; faltam push remoto/FCM e lembretes fechados no iOS                                                                                     |
| Admin                             |       ✅ |  🟡 | listagem, bloqueio e concessão/revogação v4; faltam claims e testes Emulator                                                                                                                                            |
| Exclusão de conta                 |       ✅ |  🟡 | fluxo modular completo no cliente; backend idempotente ainda recomendado                                                                                                                                                |
| Import/export/reset               |       ✅ |  🟡 | JSON versionado, limite, validação, backup prévio, rollback lógico, CSV seguro e reset seletivo por domínio; fotos binárias ainda não entram no backup                                                                  |

Paridade global: **não atingida**. O baseline continua sendo a versão operacional.

## Progresso acompanhado por fase

Percentual estimado da migração funcional: **97%**. A estimativa pondera implementação e validação de comportamento, não apenas quantidade de arquivos. A versão legada continua sendo o baseline operacional até a homologação completa.

| Fase                                           | Progresso | Estado                                                                                                                                                    |
| ---------------------------------------------- | --------: | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fundação, contratos, qualidade e design system |       85% | TypeScript strict, ferramentas, i18n, erros e tokens ativos; falta ampliar componentes reutilizáveis                                                      |
| Auth, verificação, onboarding e conta          |       92% | Auth Emulator, E2E de cadastro/verificação em Chromium/WebKit e exclusão modular; faltam Google real e tour completo                                      |
| Treinos, rotinas, catálogo e histórico         |       94% | Núcleo, templates, gerador, reorder, rascunhos, PR/e1RM, vídeos, relatório compartilhável e conquistas implementados                                      |
| Progresso, readiness e nutrição                |       92% | Peso, gráfico, medidas, readiness, suplementos com agenda editável e barcode manual/câmera implementados                                                  |
| Fotos, compartilhamento e notificações         |       60% | Fotos privadas, comparação, Web Share e alertas locais migrados; faltam EXIF e push remoto                                                                |
| Admin e segurança Firebase                     |       85% | UI, bloqueio e regras Firestore/Storage aprovadas no Emulator com cenários positivos/negativos; faltam custom claims/backend                              |
| Offline, sincronização e PWA                   |       90% | IndexedDB v2, filas segregadas, prioridade local, quota/persistência, cache e recuperação ativos; faltam conflitos interativos e validação iOS prolongada |
| Import/export, acessibilidade e E2E            |       95% | JSON/CSV, reset seletivo, smoke e cadastro/verificação autenticados aprovados em Chromium/WebKit mobile                                                   |

## 3% finais

- Substituir a concessão administrativa baseada em documento/email por custom claims emitidas por backend confiável.
- Homologar Google Sign-In, Web Share de arquivos e instalação/atualização em dispositivos Safari/iOS reais.
- Completar retry offline de blobs/EXIF, resolução interativa de conflitos e push remoto/FCM.
- Finalizar o tour completo de onboarding e a validação visual de todas as telas antes de promover a v4.
