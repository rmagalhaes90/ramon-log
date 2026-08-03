# Relatório de testes

Atualizado em 2026-08-02.

## Baseline inicial

O repositório não continha `package.json`, suíte automatizada ou configuração de build. A inspeção estática do baseline foi concluída; nenhum arquivo legado foi alterado.

## Fundação v4

| Comando                                                                     | Resultado                                                                                                                                                                                       |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install`                                                               | Não executável: `npm` não existe no `PATH` nem no runtime fornecido.                                                                                                                            |
| `pnpm install` (fallback do workspace)                                      | **PASS**, código 0; 244 pacotes, lockfile e postinstalls permitidos de `@firebase/util`, `esbuild` e `protobufjs`. Foi necessário incluir o Node empacotado no `PATH`.                          |
| Typecheck (`tsc -b --pretty false`)                                         | **PASS**, código 0. Duas falhas iniciais de configuração foram corrigidas antes do resultado final.                                                                                             |
| Lint (`eslint app-v4/src app-v4/tests vite.config.ts playwright.config.ts`) | **PASS**, código 0. Uma promise IndexedDB não aguardada foi encontrada e corrigida.                                                                                                             |
| Unitários (`vitest run`)                                                    | **PASS**, 18 arquivos e 41 testes, código 0. Inclui capacidade de câmera sem prompt antecipado e limite da fila offline de fotos.                                                               |
| Build (`vite build --config vite.config.ts`)                                | **PASS**, 140 módulos; app JS 177,55 kB (49,33 kB gzip), Storage 33,05 kB (10,90 kB gzip), maior chunk Firestore 441,11 kB (130,90 kB gzip), CSS 15,69 kB (3,39 kB gzip), código 0 e sem aviso. |
| Playwright (`playwright test`)                                              | **PASS**, 2 testes: Chromium desktop e WebKit mobile. Os binários oficiais foram instalados pelo CLI usando o Node empacotado.                                                                  |

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

## Rodada 2026-08-02 — câmera e fila offline de fotos

Typecheck, lint, 41 testes unitários e build passaram. IndexedDB migrou de v1 para v2 adicionando uma store de blobs sem recriar as stores existentes. A fila aceita no máximo dez JPEGs já validados por usuário, envia em ordem e só cria o índice remoto após o Storage confirmar. A câmera de barcode exige clique, detecta capacidade antes de exibir a ação e encerra todas as tracks ao detectar ou navegar. Release alinhada em `4.0.0-alpha.4`.

## Rodada 2026-08-02 — primeira extração do composition root

Typecheck, lint, 41 testes unitários e build passaram após formatar `main.ts` e extrair ajustes/conta, import/export/CSV e fotos/Storage/Share para três módulos. O composition root caiu para cerca de 53,3 mil caracteres; o número de módulos transformados subiu para 140 sem mudança material no bundle.

## Rodada 2026-08-02 — sincronização, quota e E2E alpha.5

Typecheck strict, lint, **20 arquivos/45 testes unitários**, build e **2 smoke tests Playwright** passaram. O build transformou 142 módulos; app JS 183,05 kB (50,93 kB gzip), Storage 33,05 kB (10,90 kB gzip), Firestore 441,11 kB (130,90 kB gzip) e CSS 16,96 kB (3,54 kB gzip). O E2E encontrou um seletor obsoleto do grid provisório; o cenário foi corrigido para validar o shell de autenticação atual e passou em Chromium e WebKit mobile. Fluxos autenticados e regras continuam pendentes de Firebase Emulator, sem uso de dados reais.

## Rodada 2026-08-02 — Auth Emulator e E2E autenticado alpha.6

`firebase-tools` e `@firebase/rules-unit-testing` foram instalados como dependências de desenvolvimento. O Auth Emulator com projeto isolado `demo-kyro-v4` aprovou criação, login e exclusão; o Playwright aprovou cadastro e bloqueio por email não verificado em Chromium e WebKit mobile (**2/2**). A conexão local exige flag explícita e tem teste garantindo o padrão desativado. O Firestore Emulator não pôde iniciar porque Java não está instalado nesta máquina; nenhuma regra foi marcada como testada sem execução real.

## Rodada 2026-08-02 — regras Firebase alpha.7

Um Temurin OpenJDK 21 portátil foi usado localmente e mantido fora do Git. Firestore Emulator 1.22.0 e Storage Rules Runtime 1.1.3 executaram a suíte com código 0. Passaram: escrita do próprio documento, negação entre contas/anônima, perfil compartilhado sem autoelevação, concessão pelo super admin, listagem e bloqueio pelo admin concedido, negação de auto-revogação, upload JPEG privado, negação entre contas, MIME incorreto e arquivo acima de 3 MB.

## Rodada 2026-08-02 — backend confiável alpha.8

As Functions `setAdminRole`, `setUserBlocked` e `deleteOwnAccount` carregaram no Functions Emulator e passaram com código 0. A execução confirmou custom claim no Auth Emulator, bloqueio do usuário no Firebase Auth e exclusão definitiva idempotente. As regras foram repetidas após trocar a autorização administrativa do documento para `request.auth.token.admin` e passaram novamente. O host local usa Node 24 e emitiu aviso porque a runtime declarada/deploy é Node 22; não houve falha funcional.

A bateria final passou: typecheck strict, lint incluindo `functions/`, **21 arquivos/46 testes Vitest**, build de 144 módulos e Playwright público em Chromium/WebKit (**2/2**, com os dois cenários autenticados corretamente ignorados fora do Emulator). O app JS ficou em 191,16 kB (53,80 kB gzip), Firestore em 433,72 kB (128,61 kB gzip), Storage em 31,78 kB (10,51 kB gzip) e CSS em 16,96 kB (3,54 kB gzip). Nenhum deploy foi executado.

Na validação manual posterior, foi identificado que a flag local conectava os SDKs aos ports do Emulator, mas preservava o project ID de produção. A configuração foi corrigida para forçar `demo-kyro-v4` e seu bucket somente quando a flag estiver ativa, mantendo produção como padrão.

## Rodada 2026-08-03 — fundação premium alpha.9

A bateria final desta rodada passou com código 0: instalação/lockfile via pnpm 11.9.0, typecheck strict, ESLint, **24 arquivos/50 testes Vitest** e build Vite com 147 módulos. O bundle gerado contém app JS de 195,04 kB (55,15 kB gzip), Firestore de 433,72 kB (128,61 kB gzip), Auth de 108,00 kB (32,36 kB gzip), Storage de 31,78 kB (10,51 kB gzip) e CSS de 17,37 kB (3,65 kB gzip).

Playwright público passou em Chromium e WebKit mobile (**2/2**); os cenários autenticados foram ignorados nessa execução sem Emulator e depois passaram isoladamente no Auth Emulator em ambos os browsers (**2/2**), incluindo o bloqueio até verificação de email. O teste direto do Auth Emulator também aprovou criação, login e exclusão.

Firestore/Storage Emulator aprovou ownership, administração e limites de upload. Functions Emulator carregou `deleteOwnAccount`, `getEntitlements`, `setAdminRole` e `setUserBlocked`; claims, bloqueio, plano free padrão e exclusão idempotente passaram. Uma primeira tentativa falhou porque um Emulator antigo ocupava as portas e ainda mantinha a versão alpha.8 em memória; após reiniciar somente esse processo local, a execução limpa passou. O host emitiu avisos não bloqueantes por usar Node 24 enquanto a runtime declarada é Node 22 e por uma dependência transitiva antiga do Firebase CLI usar `url.parse()`.

Nenhum deploy ou publicação no GitHub Pages foi executado.

## Rodada 2026-08-03 — esforço, readiness e substituições alpha.10

O typecheck strict, ESLint, **25 arquivos/53 testes Vitest** e build passaram. Foram validados RIR/RPE limitado por série, bloqueio de progressão quando a última série atingiu falha, override persistido do plano de readiness e ranking de alternativas por músculo/equipamento. O build transformou 148 módulos; app JS 198,55 kB (56,30 kB gzip) e CSS 17,66 kB (3,72 kB gzip).

Os dois primeiros jobs do GitHub Actions falharam antes dos testes porque pnpm 11 recusou o build não declarado de `re2`, dependência transitiva do Firebase CLI. `re2` foi explicitamente incluído na allowlist de supply chain do workspace; o CI precisa ser repetido após o push desta rodada.

## Rodada 2026-08-03 — conflitos e decisões alpha.11

Formatação, typecheck strict, ESLint, **26 arquivos/56 testes Vitest**, build e Playwright público em Chromium/WebKit passaram. O build transformou 148 módulos; app JS 205,29 kB (58,24 kB gzip), CSS 18,02 kB (3,80 kB gzip) e o chunk Firestore permaneceu em 433,72 kB (128,61 kB gzip).

Os testes cobrem detecção de revisão remota divergente, ausência de falso conflito sem revisão-base, contratos das decisões de progressão e retrocompatibilidade dos schemas. Firestore/Storage Emulator repetiu ownership, isolamento entre contas, administração e limites de upload com código 0. Nenhum deploy foi executado.

## Rodada 2026-08-03 — nutrição reutilizável alpha.12

Formatação, typecheck strict, ESLint, **26 arquivos/57 testes Vitest**, build e Playwright público em Chromium/WebKit passaram. A suíte valida fibra do Open Food Facts, meta retrocompatível, cópia com IDs novos e duplicação que preserva refeições existentes. O build transformou 148 módulos; app JS 209,70 kB (59,34 kB gzip) e CSS 18,23 kB (3,84 kB gzip).

Favoritos são limitados a 100 e refeições a 200 por dia pelos schemas. A duplicação é uma mesclagem aditiva; nenhum dado do dia de destino é removido. Nenhum deploy foi executado.

## Rodada 2026-08-03 — analytics de progresso alpha.13

Formatação, typecheck strict, ESLint, **27 arquivos/60 testes Vitest**, build e Playwright público passaram. Os testes novos validam ordenação e delta das medidas, distribuição ponderada do volume por grupo muscular e correlação de Pearson entre readiness e volume apenas com pelo menos três datas comparáveis. O Playwright aprovou o smoke em Chromium e WebKit mobile (**2/2**); os dois cenários autenticados foram ignorados porque esta execução não iniciou o Auth Emulator.

O build transformou 149 módulos; app JS 213,37 kB (60,44 kB gzip), CSS 18,70 kB (3,96 kB gzip), Firestore 433,72 kB (128,61 kB gzip), Auth 108,00 kB (32,36 kB gzip) e Storage 31,78 kB (10,51 kB gzip). Nenhum deploy ou publicação no GitHub Pages foi executado.

## Rodada 2026-08-03 — fundação multiplataforma alpha.14

`pnpm install`, formatação, typecheck strict conjunto (web, domínio e mobile), ESLint e os testes passaram. O web manteve **27 arquivos/60 testes Vitest**; o novo `@kyro/domain` aprovou **1 arquivo/2 testes**. Playwright público passou em Chromium e WebKit mobile (**2/2**), com os dois testes autenticados corretamente ignorados sem Auth Emulator.

O build web passou com 152 módulos: app JS 213,37 kB (60,46 kB gzip), CSS 18,70 kB (3,96 kB gzip), Firestore 433,72 kB (128,61 kB gzip), Auth 108,00 kB (32,36 kB gzip) e Storage 31,78 kB (10,51 kB gzip). O Metro produziu um bundle Android Hermes real com 1.332 módulos e 3,5 MB em `mobile/dist/android`; o diretório gerado permanece ignorado.

O Expo Doctor aprovou 16 de 20 verificações e não encontrou mais incompatibilidades de schema ou versões. As quatro verificações restantes dependem de executar `npm` internamente e falharam com `spawn npm ENOENT` neste runtime pnpm-only. `pnpm peers check` passou sem qualquer problema depois de alinhar React Native, Screens, Safe Area, Worklets e React DOM ao SDK 57. Nenhum build EAS, deploy, publicação em loja ou GitHub Pages foi executado.

## Rodada 2026-08-03 — autenticação e leitura mobile alpha.15

Typecheck strict web/domínio/mobile, ESLint e testes passaram. O web manteve **27 arquivos/60 testes Vitest** e o domínio compartilhado avançou para **1 arquivo/3 testes**, incluindo o resumo determinístico do dashboard. O teste garante que peso mais recente, janela semanal, readiness e nutrição produzam o mesmo resultado em qualquer plataforma.

O Metro gerou novamente o bundle Android com sucesso: 1.355 módulos e bytecode Hermes de 4,8 MB. O bundle inclui Firebase Auth persistente, Firestore, cache AsyncStorage isolado por UID, Expo Router Tabs, cadastro, recuperação, verificação de e-mail, conta bloqueada, dashboard e telas de leitura para treinos, progresso, nutrição e suplementos. Nenhum dado de produção foi usado e nenhum deploy, build EAS ou publicação foi executado.

## Rodada 2026-08-03 — escrita e sincronização mobile alpha.16

Typecheck strict web/domínio/mobile, ESLint e testes passaram. O web manteve **27 arquivos/60 testes** e o domínio compartilhado passou **4 testes**, adicionando garantia contra overwrite quando a revisão remota é mais nova e o conteúdo diverge.

A escrita mobile usa transação Firestore, revisão-base, cache otimista e fila AsyncStorage separada por UID. Falhas de rede geram estado pendente; o login tenta flush automático e conflitos não são convertidos em overwrite. Peso e cintura já podem ser registrados pela tela de progresso. Nenhum dado real, deploy ou publicação foi executado.

## Rodada 2026-08-03 — nutrição e suplementos mobile alpha.17

Typecheck strict, ESLint, **60 testes web** e **4 testes de domínio** passaram. Água diária e adesão por horário de suplemento agora usam a escrita transacional/offline da alpha.16. Os schemas móveis preservam campos adicionais dos documentos existentes para impedir perda de metas, fibra, timestamps ou metadados durante uma atualização parcial.

O build Vite de produção passou com 154 módulos. O bundle Android passou com 1.356 módulos e bytecode Hermes de 4,9 MB. No Playwright, os smoke tests passaram em Chromium e WebKit móvel (**2 passed**); os **2 testes de autenticação foram ignorados**, conforme esperado, porque os Firebase Emulators não estavam ativos nesta rodada.

## Rodada 2026-08-03 — treino ativo mobile alpha.18

O mobile agora permite selecionar o dia, iniciar o treino, registrar carga e repetições, concluir séries e finalizar uma sessão com duração, volume e número de exercícios. O rascunho é persistido por usuário no AsyncStorage a cada alteração e permanece recuperável depois de fechar o aplicativo. A sessão final usa a fila transacional offline e não descarta o rascunho em falhas ou conflitos.

Typecheck strict, ESLint, Prettier, **60 testes web** e **4 testes de domínio** passaram. O build Vite passou com 154 módulos; o bundle Android passou com 1.356 módulos e Hermes de 4,9 MB. Playwright passou os smoke tests em Chromium e WebKit móvel (**2 passed**) e ignorou os 2 cenários que exigem Firebase Emulators, não iniciados nesta rodada.

## Rodada 2026-08-03 — fotos mobile alpha.19

O mobile recebeu captura por câmera, seleção da galeria, reprocessamento JPEG sem EXIF, limite local e remoto de 3 MB, armazenamento privado por UID, galeria autenticada e exclusão com confirmação. A fila preserva no diretório de documentos até o Storage e o índice Firestore serem confirmados; falhas e conflitos não descartam o arquivo recuperável. As permissões iOS/Android explicam explicitamente o uso de câmera e fotos, sem solicitar microfone.

Typecheck strict, ESLint, Prettier, **60 testes web** e **4 testes de domínio** passaram. O build Vite passou com 154 módulos. O bundle Android com Image Picker, Image Manipulator e File System passou com **1.387 módulos** e Hermes de **5 MB**. Playwright passou 2 smoke tests em Chromium/WebKit móvel e ignorou os 2 cenários dependentes dos Firebase Emulators, que não foram iniciados.

## Rodada 2026-08-03 — readiness mobile alpha.20

O dashboard mobile agora registra sono, energia, dor muscular e estresse em escala de 1 a 5, mostra score/classificação em tempo real e salva o check-in pela camada transacional offline. O cálculo duplicado foi removido do web e centralizado em `@kyro/domain`, com um novo teste que garante os mesmos extremos e limiares em ambas as plataformas. Typecheck, ESLint e **65 testes unitários** passaram nesta fase.

## Rodada 2026-08-03 — comparação e compartilhamento mobile alpha.21

A galeria permite selecionar até duas fotos para comparação lado a lado e usa estados acessíveis de checkbox. Uma foto selecionada pode ser compartilhada pela folha nativa do sistema: o aplicativo usa o JPEG persistido localmente ou baixa uma cópia temporária autenticada, sem compartilhar a URL privada do Storage. A disponibilidade do recurso é verificada antes de abrir a folha nativa.

Typecheck strict, ESLint, Prettier e **65 testes unitários** passaram. O build Vite passou com 155 módulos; o bundle Android passou com **1.392 módulos** e Hermes de **5,1 MB**. Playwright passou os 2 smoke tests em Chromium e WebKit móvel e ignorou os 2 cenários dependentes dos Firebase Emulators, não iniciados nesta rodada.

## Rodada 2026-08-03 — alertas de descanso mobile alpha.22

O treino mobile agora solicita permissão somente quando o atleta ativa o recurso, persiste a preferência pela fila offline e cria um canal Android de alta importância. Ao concluir uma série, agenda um alerta local usando o descanso específico do exercício; o handler também mostra o alerta com o aplicativo em primeiro plano.

## Rodada 2026-08-03 — i18n mobile alpha.23

Um provider de locale persistido em AsyncStorage agora alterna português/inglês sem reiniciar o aplicativo. A navegação principal, saudação, ações de sessão e check-in do dashboard foram migrados para chaves tipadas; novas telas podem consumir o mesmo catálogo sem criar globais ou listeners adicionais.

## Rodada 2026-08-03 — conta e exclusão mobile alpha.24

A nova área de conta oferece logout e exclusão integral. A ação exige a frase `EXCLUIR`, confirmação nativa destrutiva e, para contas password, reautenticação com a senha atual. A callable autenticada remove fotos do Storage, documentos Firestore, índice compartilhado e usuário Auth; o cache local só é apagado depois da confirmação server-side. Falhas mantêm os dados locais e mostram estado assertivo.

Na matriz final das três fases, Prettier, typecheck strict, ESLint e **65 testes unitários** passaram. O build Vite passou com 155 módulos; o bundle Android com Notifications e Functions passou com **1.459 módulos** e Hermes de **5,2 MB**. Playwright passou 2 smoke tests em Chromium/WebKit móvel e ignorou 2 cenários dependentes dos Firebase Emulators, não iniciados nesta rodada.

## Rodada 2026-08-03 — hardening até 90% alpha.25

O admin mobile lista no máximo 100 usuários, fica oculto sem claim e redireciona acesso direto não autorizado. Bloqueio e roles continuam validados pela callable e agora geram auditoria imutável com timestamp do servidor; a tela mostra os 50 eventos mais recentes. Um Error Boundary registra até 50 diagnósticos locais sem enviar PII a terceiros e oferece recuperação sem apagar dados. O CI passa a exigir exports Android e iOS além da matriz web.

Prettier, typecheck strict, ESLint e **65 testes unitários** passaram. O build Vite passou com 155 módulos. O Android exportou 1.463 módulos/5,2 MB e o iOS exportou 1.332 módulos/4,9 MB. Playwright passou 2 smoke tests em Chromium/WebKit móvel e ignorou os 2 cenários que requerem Emulators. Os testes locais de Rules/Functions não iniciaram porque não há Java instalado no PATH; o workflow instala Java 21 e permanece responsável por validar esses mesmos testes antes de aceitar a fase.

## Rodada 2026-08-03 — i18n mobile expandido alpha.26

O catálogo PT/EN persistente passou a cobrir títulos, navegação, estados vazios, carregamento e ações principais de dashboard, treinos, progresso, nutrição, suplementos, fotos, conta e admin. Todas as chamadas usam chaves inferidas pelo TypeScript; renomes ou ausências interrompem o typecheck. Valores do usuário e nomes de exercícios/suplementos permanecem inalterados.

Prettier, typecheck strict, ESLint e **65 testes unitários** passaram. O build Vite passou com 155 módulos. Android exportou 1.463 módulos/5,2 MB e iOS exportou 1.332 módulos/4,9 MB. Playwright passou 2 smoke tests em Chromium e WebKit móvel; 2 cenários dependentes dos Emulators ficaram ignorados localmente e permanecem cobertos pelo CI.

## Rodada 2026-08-03 — preparação do GitHub Pages

`pnpm install --frozen-lockfile`, typecheck strict conjunto (web, domínio e mobile), ESLint, **65 testes unitários** e build Vite de produção passaram. O web aprovou 27 arquivos/60 testes e o domínio compartilhado aprovou 1 arquivo/5 testes.

O build transformou 155 módulos; app JS 213,37 kB (60,46 kB gzip), CSS 18,70 kB (3,96 kB gzip), Firestore 433,72 kB (128,61 kB gzip), Auth 108,00 kB (32,36 kB gzip) e Storage 31,78 kB (10,51 kB gzip). O workflow do Pages repete typecheck web, ESLint, testes web e build antes de liberar o artefato `dist-v4` para publicação.
