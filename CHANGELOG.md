# Changelog

- Fase alpha.42: corrige dois bugs reais reportados logo após publicar a alpha.41 e reproduzidos ao vivo no site — (1) o timer de descanso (barra fixa no topo da tela) nunca desaparecia de verdade: o CSS `.rest-timer` definia `display: flex` incondicional, que como regra do autor sempre vence o `display: none` padrão do navegador para o atributo `hidden`, então marcar o elemento como escondido não tinha efeito visual nenhum; (2) o aviso "nova versão disponível" também nunca sumia ao clicar em "Atualizar agora": o service worker chamava `skipWaiting()` mas nunca `clients.claim()`, então a aba já aberta nunca passava a ser controlada pelo novo worker, o evento que dispara o reload da página nunca acontecia, e o aviso ficava preso pra sempre.
- Fase alpha.41: o cronômetro da sessão de treino não começa mais sozinho ao abrir a tela de Treino — só inicia quando o usuário realmente age (aperta "▶ Iniciar treino" ou marca a primeira série/edita um campo), igual ao app antigo. Dias sem rotina configurada não mostram mais a lista de exercícios/cronômetro vazios: se a semana inteira está sem rotina, aparece uma tela de boas-vindas com três atalhos (gerar automático, usar template, criar manualmente); se só aquele dia está vazio, aparece um convite para criar a rotina daquele dia — em vez de uma tela de treino em branco contando tempo à toa.
- Fase alpha.40: gerador automático de treino — tela nova (`Gerar treino`, acessível pela Rotina) onde o usuário escolhe grupos musculares (peito, costas, pernas, ombros, braços, abdômen, push, pull, corpo inteiro), equipamento opcional (barra, halteres, máquina, cabo, peso do corpo) e intensidade (leve/médio/forte, cada uma com séries/reps/descanso próprios); gera uma prévia com exercícios diversificados do catálogo (sem repetir grupo muscular primário), com "sortear de novo" e "aplicar" — aplicar substitui a rotina do dia selecionado após confirmação. Porta a lógica de seleção diversificada por músculo primário (`pickDiverseExercises`) do gerador do app antigo.
- Fase alpha.39: corrige o sistema de unidades métrico/imperial — a escolha era salva no onboarding mas nunca lida em lugar nenhum, então todo peso corporal e medida ficava travado em kg/cm mesmo para quem escolhia imperial. Peso corporal e as cinco medidas (cintura/peito/braço/quadril/coxa) agora convertem de verdade, com rótulos, limites de campo e gráficos ajustados ao par de unidade escolhido; a preferência agora pode ser trocada a qualquer momento em Configurações, não só uma vez no onboarding. A carga levantada nos treinos continua sempre em kg, igual ao app antigo (anilhas são físicas).
- Fase alpha.38: separa a tela de Treino (execução ao vivo) da tela de Rotina (montar/editar exercícios), igual ao baseline — a edição de séries/reps/descanso introduzida na alpha.37 sai da tela de treino e vai para a nova tela de Rotina; vídeo de exercício passa a abrir num modal com player do YouTube embutido, em vez de um link externo; tela de celebração com confete e sequência de dias ao finalizar um treino, com opção de compartilhar.
- Fase alpha.37: porta os 170 links de vídeo do YouTube do app baseline (`main`) para o catálogo v4, que nunca tinham sido migrados; adiciona edição direta de séries/repetições/descanso por exercício na tela de treino (antes só dava pra reordenar ou remover); adiciona pausar/retomar o cronômetro da sessão (excluído do tempo final registrado) e um botão para cancelar o descanso em andamento.
- Fase alpha.36: corrige uma condição de corrida real onde o Firestore podia se reportar temporariamente offline logo após um login recém-verificado, derrubando o usuário de volta para a tela de login sem aviso (agora com novas tentativas); habilita detecção automática de long-polling no Firestore; adiciona E2E autenticado (Chromium/WebKit) cobrindo cadastro, verificação por link e compartilhamento do relatório semanal via fallback de clipboard, fechando o gap de `PARITY_MATRIX.md`.
- Fase alpha.35: tour guiado pós-onboarding (Train/Recover/Fuel/Sync) exibido uma vez por conta, com avançar/voltar/pular, fechando o gap "falta portar tour completo do produto" do `PARITY_MATRIX.md`.
- Fase alpha.34: corrige três queixas reais de uso — "Finalizar" não dava feedback quando nenhuma série estava marcada como concluída, o timer de descanso ficava fora da viewport em rotinas longas (sticky após a lista de exercícios) e sessões retomadas de um rascunho antigo não avisavam por que o cronômetro já começava com tempo decorrido.
- Fase alpha.33: drag-and-drop nativo (mouse/desktop) para reordenar exercícios do treino, complementando os botões ↑/↓ que continuam sendo o caminho acessível e o único funcional em touch (iOS/Android não disparam eventos HTML5 de drag).
- Fase alpha.32: backup completo em .zip (dados + fotos originais do Storage) com restauração de dados e reenvio das fotos; formato ZIP STORE implementado sem dependência externa.
- Fase alpha.31: Rules Firestore/Storage e quatro Functions v2 Node 22 publicadas em produção; Functions Framework/allowlist pnpm configurados, invoker Cloud Run reproduzível, domínio Pages validado e smoke autenticado de Auth/Firestore/Storage/entitlements/admin/exclusão aprovado.
- Fase alpha.30: dashboard web mobile compacto em grade 2×2, navegação por todos os cartões, descrições PT/EN, labels de Carga/Reps/RIR/RPE, contador de fila isolado por usuário e retry manual de sincronização.
- Fase alpha.29: retries recuperáveis da fila offline deixam de acionar o alerta global; itens continuam preservados, visíveis e sujeitos ao backoff até a sincronização ser confirmada.
- Fase alpha.28: campos de série inválidos deixam de acionar o erro global; carga, repetições, RIR e RPE são validados no próprio input antes de atualizar o rascunho ou concluir a série.
- Fase alpha.27: compatibilidade de treinos com dias de descanso legados gravados como `null`; falhas em histórico ou decisões de progressão não impedem mais a abertura da rotina, e o cache PWA foi versionado para distribuir a correção.

## Unreleased — KYRO v4 foundation

### Added

- Fase alpha.26: catálogo PT/EN tipado aplicado às telas mobile de dashboard, treinos, progresso, nutrição, suplementos, fotos, conta e admin.
- Fase alpha.25: admin mobile com auditoria server-side, error boundary/diagnóstico local e bundles Android+iOS obrigatórios no CI.
- Fase alpha.24: configurações mobile e exclusão integral de conta com reautenticação e confirmação em duas etapas.
- Fase alpha.23: provider i18n mobile PT/EN persistente, navegação e dashboard principal traduzíveis sem reload.
- Fase alpha.22: preferência offline e notificações locais de descanso por exercício no treino mobile.
- Fase alpha.21: seleção acessível, comparação lado a lado e compartilhamento nativo privado das fotos mobile.
- Fase alpha.20: check-in readiness mobile offline e cálculo idêntico centralizado no domínio web/native.
- Fase alpha.19: câmera/galeria mobile, sanitização JPEG, galeria privada e fila de upload confirmada com o índice Firestore.
- Fase alpha.18: treino ativo mobile com rascunho recuperável, séries, carga, repetições, volume e finalização offline.
- Fase alpha.17: registro mobile offline de água e adesão aos horários de suplementos, preservando campos legados.
- Fase alpha.16: escrita mobile transacional, fila offline por UID, proteção de revisão remota e registro de peso/cintura.
- Fase alpha.15: autenticação mobile completa, cache isolado por UID, dashboard conectado e navegação protegida para treinos, progresso, nutrição e suplementos.
- Fase alpha.14: workspace multiplataforma, domínio compartilhado e fundação Expo SDK 57 com login Firebase persistente, Router, tokens KYRO, EAS preparatório e bundle Android validado.
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
- Repositório de dados por usuário com cache IndexedDB, validação remota e escrita com fallback para fila offline.
- Primeira experiência de treino v4: seleção do dia, séries, carga, repetições, conclusão, volume e histórico de sessões.
- Progresso v4 com peso, delta, histórico de sessões e readiness usando a fórmula do baseline.
- Nutrição v4 com metas herdadas, refeições, calorias, macros e água.
- Regras Firestore/Storage versionadas e configuração local de emuladores.
- Exclusão modular de conta e dados com reautenticação e progresso por estágio.
- Administração modular com listagem, bloqueio e concessão/revogação de admin protegida pelas regras.
- Separação de chunks Firebase; nenhum chunk de produção excede 500 kB.
- Extração reproduzível de 170 exercícios e 50 suplementos do HTML legado para JSON validado.
- Editor de rotinas com renomear, pesquisar catálogo, adicionar e remover exercícios.
- Service Worker v4.0.0-alpha.2 com cache runtime dos chunks hash para uso offline real após o primeiro carregamento.
- Treinos com relógio de sessão, timer de descanso, notas por exercício, orientação de aquecimento e cálculo de anilhas.
- Histórico por exercício e recordes de carga/e1RM calculados exclusivamente a partir de séries concluídas.
- Suplementação v4 com catálogo legado completo, agenda de doses e registro diário persistido pela camada offline.
- Matriz de progresso ponderada por fase para acompanhamento contínuo da migração.
- Galeria privada de fotos de progresso com upload resumível, limite JPEG de 3 MB, comparação lado a lado e exclusão confirmada.
- Compartilhamento de fotos pelo Web Share API quando suportado, com fallback de texto para clipboard.
- Medidas corporais datadas para cintura, peito, braço, quadril e coxa, além de gráfico SVG acessível de evolução do peso.
- Exportação/importação JSON v4 com validação Zod estrita, limite de 5 MB, backup automático pré-importação e rollback lógico.
- Notificações locais de fim de descanso com permissão por gesto, preferência sincronizada, teste manual e retorno à PWA ao tocar no aviso.
- Service Worker e release paralela atualizados para `4.0.0-alpha.3`.
- Builder de rotinas com templates Full Body, Upper/Lower e Push/Pull/Legs gerados do catálogo legado, além de reordenação persistente.
- Rascunho de treino validado no IndexedDB para recuperar cargas, repetições e séries após reload/crash.
- Relatório semanal, sequência de treinos e seis conquistas progressivas.
- Exportação de sessões em CSV com neutralização de fórmulas de planilha.
- Consulta nutricional por GTIN usando a API v3 do Open Food Facts, com timeout, validação e tratamento offline.
- Leitura de barcode pela câmera via `BarcodeDetector`, com permissão por gesto, encerramento de tracks e fallback manual.
- IndexedDB v2 com fila limitada de fotos offline e retomada automática antes de atualizar o índice remoto.
- Release paralela atualizada para `4.0.0-alpha.4`.
- `main.ts` formatado e reduzido com extração das views de ajustes, portabilidade e fotos para módulos de feature.
- Sincronização offline segregada por usuário, envelopes de revisão compatíveis com filas antigas e proteção contra sobrescrita remota enquanto há mudança local pendente.
- Painel de quota/persistência do armazenamento e reset seletivo de treino, progresso ou nutrição sem afetar fotos e conta.
- Agenda editável de suplementos, links HTTPS de vídeos de exercícios e compartilhamento do relatório semanal.
- Smoke E2E real aprovado em Chromium desktop e WebKit mobile; release paralela atualizada para `4.0.0-alpha.5`.
- Firebase Auth Emulator opt-in, teste isolado de criação/login/exclusão e E2E de cadastro com bloqueio de email não verificado em Chromium/WebKit; release `4.0.0-alpha.6`.
- Regras Firestore/Storage aprovadas no Emulator com isolamento entre contas, controles administrativos, MIME e limite de upload; release `4.0.0-alpha.7`.
- Cloud Functions v2 para custom claims, bloqueio sincronizado e exclusão idempotente, integradas ao SDK modular e aprovadas no Emulator; marco final de implementação `4.0.0-alpha.8`.
- Configuração local fixa o projeto isolado `demo-kyro-v4`, evitando divergência entre o usuário exibido no Emulator UI e o projeto usado pelo SDK.
- Alpha.9: motor de progressão/plateau/deload, transcodificação de fotos sem EXIF, entitlements no servidor, PWA manifest completo, headers de segurança, CI e pacote documental de publicação.
- Alpha.10: esforço por série (RIR/RPE), override auditável do readiness, substituições contextuais de exercício e correção da política de builds do CI.
- Alpha.11: proteção contra conflitos multi-dispositivo, resolução local/nuvem, inspeção da fila offline e decisões persistidas de progressão.
- Alpha.12: fibra e meta diária, refeições favoritas, cópia entre datas e duplicação não destrutiva do dia alimentar.
- Alpha.13: gráficos de cinco medidas, tendências, volume muscular em 28 dias e correlação readiness × desempenho.

### Preserved

- Aplicação legada, Service Worker, manifests, versão e ícones permanecem sem alterações.

### Not yet migrated

- Features de produto permanecem no baseline até implementação e validação item a item na matriz de paridade.

# 4.0.0-alpha.32

- Added branded KYRO handlers for email verification, password reset and email recovery.
- Added localized, strict Firebase action-link processing for web and mobile.
- Prepared and audited the `thingsofthings.ie` sender-domain configuration, including SPF and DMARC.
