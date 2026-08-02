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
| Unitários (`vitest run`) | **PASS**, 16 arquivos e 38 testes, código 0. Inclui templates, reorder, relatórios, conquistas, CSV, barcode e contratos de rascunho. |
| Build (`vite build --config vite.config.ts`) | **PASS**, 135 módulos; app JS 174,25 kB (48,11 kB gzip), Storage 33,05 kB (10,90 kB gzip), maior chunk Firestore 441,11 kB (130,90 kB gzip), CSS 15,50 kB (3,36 kB gzip), código 0 e sem aviso. |
| `npm run test:e2e` | Não executado: `npm` indisponível e browsers Playwright não foram instalados. Configuração e smoke test foram criados. |

## Verificação visual local

O shell foi servido com Vite e inspecionado no navegador interno em desktop: login renderizou corretamente, PT/EN alternou sem reload e não houve erro no console. Fluxos autenticados não foram exercitados para evitar criar ou alterar dados reais. As regras Firebase ainda não foram compiladas/testadas no Emulator porque `firebase-tools` não está instalado.

Vitest e Vite precisaram ser executados fora do sandbox porque o processo esbuild recebia `Access is denied` ao carregar `vite.config.ts`; fora do sandbox ambos concluíram normalmente.

Observação: tentativas iniciais de instalação falharam por ausência de `npm`, restrição de rede, timeout e depois ausência do Node no `PATH` dos postinstalls. Nenhuma foi considerada resultado final; a execução final acima concluiu com código 0.

## Rodada 2026-08-02 — treino avançado e suplementos

Typecheck, lint, 24 testes unitários e build foram repetidos após as alterações e passaram. Um teste inicialmente exigia uma decomposição não mínima de anilhas para 100 kg; a expectativa foi corrigida para `25 + 15` por lado, coerente com o algoritmo e com a menor quantidade de anilhas. Os timers também passaram a ser encerrados ao sair ou concluir o treino.

## Rodada 2026-08-02 — fotos e compartilhamento

Typecheck, lint, 28 testes unitários e build passaram. O shell público foi novamente inspecionado no navegador local e renderizou sem regressão. Upload, leitura e exclusão autenticados não foram executados contra dados reais; continuam pendentes de Firebase Emulator ou conta isolada de teste. A validação limita o cliente e as regras de Storage limitam o servidor a JPEG privado de até 3 MB.

## Rodada 2026-08-02 — medidas, gráficos e portabilidade

Typecheck, lint, 30 testes unitários e build passaram. O backup JSON tem envelope/versionamento explícito, limite de 5 MB e contratos por feature; a restauração baixa uma cópia de segurança antes da confirmação e tenta restaurar o estado anterior se uma escrita local falhar. O índice de fotos é exportado, mas os JPEGs privados permanecem no Storage e não fazem parte do JSON.

## Rodada 2026-08-02 — notificações locais e PWA alpha.3

Typecheck, lint, 32 testes unitários e build passaram. A permissão é solicitada exclusivamente após clique, a preferência é validada/sincronizada e o fim do descanso usa `ServiceWorkerRegistration.showNotification`. A release avançou para `4.0.0-alpha.3`, com package, manifesto de versão e worker conferidos por teste. Push remoto e entrega com o app totalmente encerrado não foram implementados.

## Rodada 2026-08-02 — batch de paridade funcional 80%

Typecheck, lint, 38 testes unitários e build passaram. Foram validados três templates semanais gerados do catálogo, reordenação sem mutação, relatório semanal, streak, conquistas, CSV protegido contra formula injection, consulta de barcode validada e rascunhos de treino que aceitam séries vazias sem relaxar os contratos do histórico. Uma primeira versão do schema de rascunho rejeitou corretamente séries ainda vazias durante os testes; o contrato foi separado e a rodada integral passou depois da correção.
