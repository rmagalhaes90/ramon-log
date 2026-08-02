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
| Unitários (`vitest run`) | **PASS**, 4 arquivos e 9 testes, código 0. Inclui contratos de domínio e política de senha. |
| Build (`vite build --config vite.config.ts`) | **PASS**, 112 módulos; JS 634,58 kB (188,61 kB gzip), CSS 4,92 kB, código 0. Há aviso de chunk acima de 500 kB após incluir Auth/Firestore modular. |
| `npm run test:e2e` | Não executado: `npm` indisponível e browsers Playwright não foram instalados. Configuração e smoke test foram criados. |

Vitest e Vite precisaram ser executados fora do sandbox porque o processo esbuild recebia `Access is denied` ao carregar `vite.config.ts`; fora do sandbox ambos concluíram normalmente.

Observação: tentativas iniciais de instalação falharam por ausência de `npm`, restrição de rede, timeout e depois ausência do Node no `PATH` dos postinstalls. Nenhuma foi considerada resultado final; a execução final acima concluiu com código 0.
