# Relatório de testes

Atualizado em 2026-08-02.

## Baseline inicial

O repositório não continha `package.json`, suíte automatizada ou configuração de build. A inspeção estática do baseline foi concluída; nenhum arquivo legado foi alterado.

## Fundação v4

| Comando | Resultado |
|---|---|
| `npm install` | Não executável: `npm` não existe no `PATH` nem no runtime fornecido. |
| `pnpm install` (fallback do workspace) | **PASS**, código 0; 244 pacotes, lockfile e postinstalls permitidos de `@firebase/util`, `esbuild` e `protobufjs`. Foi necessário incluir o Node empacotado no `PATH`. |
| Typecheck (`tsc -b --pretty false`) | **PASS**, código 0. Duas falhas iniciais de configuração foram corrigidas antes do resultado final. |
| Lint (`eslint app-v4/src app-v4/tests vite.config.ts playwright.config.ts`) | **PASS**, código 0. Uma promise IndexedDB não aguardada foi encontrada e corrigida. |
| Unitários (`vitest run`) | **PASS**, 6 arquivos e 16 testes, código 0. Inclui contratos, autenticação, treino, readiness, peso e nutrição. |
| Build (`vite build --config vite.config.ts`) | **PASS**, 118 módulos; JS 652,76 kB (194,23 kB gzip), CSS 8,35 kB, código 0. Permanece aviso de chunk acima de 500 kB. |
| `npm run test:e2e` | Não executado: `npm` indisponível e browsers Playwright não foram instalados. Configuração e smoke test foram criados. |

Vitest e Vite precisaram ser executados fora do sandbox porque o processo esbuild recebia `Access is denied` ao carregar `vite.config.ts`; fora do sandbox ambos concluíram normalmente.

Observação: tentativas iniciais de instalação falharam por ausência de `npm`, restrição de rede, timeout e depois ausência do Node no `PATH` dos postinstalls. Nenhuma foi considerada resultado final; a execução final acima concluiu com código 0.
