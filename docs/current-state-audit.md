# Auditoria de estado multiplataforma

Atualizado em 2026-08-03.

## Resumo executivo

O web é uma aplicação Vite + TypeScript strict modular em migração paralela ao baseline HTML. Possui Firebase modular, PWA versionada, i18n PT/EN, IndexedDB, fila offline, Rules e Functions testadas em Emulator, Vitest, Playwright e CI. O maior risco arquitetural permanece o composition root `app-v4/src/main.ts`; ele não será reutilizado no mobile.

A recomendação é manter o web e adicionar Expo em paralelo. Domínio puro será extraído em lotes pequenos; serviços Firebase terão implementações específicas por plataforma e o modelo remoto permanecerá compatível.

## Prioridades

| Prioridade | Estado       | Ação                                                                                              |
| ---------- | ------------ | ------------------------------------------------------------------------------------------------- |
| P0         | Coberto      | Isolamento entre usuários, claims administrativas e exclusão via backend possuem testes Emulator. |
| P1         | Em andamento | Extrair contratos e schemas compartilháveis sem dependências de interface.                        |
| P1         | Coberto      | Autenticação, verificação, bloqueio e limpeza de cache por UID no mobile.                         |
| P1         | Parcial      | Completar Admin Web sem expor dados pessoais.                                                     |
| P2         | Planejado    | Paridade mobile por dashboard, treino, progresso, nutrição, suplementos e fotos.                  |
| P2         | Planejado    | Testes de componente e E2E mobile em ambiente com Android/iOS.                                    |
| P3         | Futuro       | Builds EAS preview, App Check nativo, observabilidade e preparação de lojas.                      |

## Mapa web e mobile

| Módulo       | Web atual        | Mobile                | Compartilhamento                 |
| ------------ | ---------------- | --------------------- | -------------------------------- |
| Autenticação | Funcional        | Fluxo completo        | Contratos e políticas            |
| Treinos      | Funcional        | Leitura do plano      | Cálculos e schemas               |
| Progresso    | Funcional        | Peso e medidas        | Analytics puros                  |
| Nutrição     | Funcional        | Resumo e refeições    | Schemas e cálculos               |
| Fotos        | Funcional        | Planejado             | Metadados e contratos            |
| Offline      | IndexedDB + fila | AsyncStorage inicial  | Estados e resolução de conflitos |
| Admin        | Web parcial      | Fora do escopo mobile | Backend seguro                   |
| PWA          | Funcional        | Não aplicável         | Identidade visual apenas         |

## Riscos e mitigação

| Risco                                   | Probabilidade | Impacto | Mitigação                                                                         |
| --------------------------------------- | ------------- | ------- | --------------------------------------------------------------------------------- |
| Divergência de regras entre plataformas | Média         | Alto    | Um pacote de domínio e testes de contrato.                                        |
| Cache cruzado entre contas              | Média         | Alto    | Namespaces por UID e limpeza explícita no logout antes da migração de dados.      |
| Regressão web por extração              | Baixa         | Alto    | Reexports compatíveis e suíte web integral a cada lote.                           |
| SDK nativo incompatível                 | Média         | Médio   | Expo Doctor, versões alinhadas ao SDK e development builds antes de APIs nativas. |
| Mudança de schema remoto                | Baixa         | Alto    | Leitura retrocompatível, schemaVersion e migração documentada.                    |
