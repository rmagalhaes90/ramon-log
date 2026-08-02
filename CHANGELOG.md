# Changelog

## Unreleased — KYRO v4 foundation

### Added

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

### Preserved

- Aplicação legada, Service Worker, manifests, versão e ícones permanecem sem alterações.

### Not yet migrated

- Features de produto permanecem no baseline até implementação e validação item a item na matriz de paridade.
