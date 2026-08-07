# Relatório de testes

## Rodada 2026-08-07 — busca de exemplo retornando "nenhum resultado" alpha.55

Usuário reportou, logo após a alpha.54 ir ao ar, que a busca "Buscar exemplo" no Gerenciador de exercícios não achava nada pra nenhuma consulta. Diagnóstico via `firebase functions:log --only searchExerciseMedia`: `TypeError: Cannot convert argument to a ByteString because the character at index 0 has a value of 65279 which is greater than 255` — código de caractere 65279 é U+FEFF, o BOM (Byte Order Mark) do UTF-8. A causa: o segredo `RAPIDAPI_KEY` foi configurado originalmente com `"chave" | firebase functions:secrets:set ... --data-file -` no PowerShell, que adiciona um BOM ao codificar a string pro pipe — esse caractere ficou gravado como parte do valor do segredo, e o `fetch()` do Node rejeita cabeçalhos HTTP com esse byte inicial. Toda chamada à RapidAPI falhava antes mesmo de sair, e o catch do cliente mostrava o mesmo texto de "nenhum resultado" tanto pra busca vazia de verdade quanto pra qualquer erro — escondendo o problema real.

Corrigido em duas partes: (1) segredo recriado a partir de um arquivo temporário escrito via Bash (`printf` puro, sem BOM, verificado byte a byte com `xxd`) e as duas funções (`searchExerciseMedia`, `getExerciseMedia`) republicadas pra usar a nova versão; (2) cliente agora diferencia "nenhum resultado" de erro real, mostrando `mediaSearchFailed` só quando a busca de fato falha.

Bateria completa: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente), **33 arquivos/91 testes Vitest** e `build`, todos com código 0. Versão sincronizada para `4.0.0-alpha.55`.

## Rodada 2026-08-07 — exemplos em GIF via RapidAPI alpha.54

Usuário forneceu uma chave de uma API paga (RapidAPI, "ExerciseDB with GIFs and images") pra trazer exemplos visuais reais dos exercícios, fechando a lacuna já identificada na alpha.28 (nenhum repositório gratuito de vídeos de exemplo existe). A chave não pode ir pro frontend (bundle público) nem pro repositório — implementado como proxy: duas Cloud Functions novas, `searchExerciseMedia` (admin/coach) e `getExerciseMedia` (qualquer usuário logado, com cache em `sharedExerciseMedia` no Firestore pra não regastar a cota em exercícios populares), seguram a chave via Firebase Functions secret (`RAPIDAPI_KEY`).

Como os nomes do catálogo estão em português e a API busca em inglês, não dá pra casar automaticamente com confiança — decisão do usuário foi vincular manualmente: novo campo `exerciseDbId` no schema do exercício, populado via busca+seleção no Gerenciador de exercícios. Vídeo do YouTube (`videoUrl`/`videoUrlEn`) continua existindo em paralelo; GIF aparece a mais, não substitui.

Verificado diretamente contra a API real com a chave do usuário via curl (`/api/v1/exercisetypes`, `/api/v1/exercises/search`, `/api/v1/exercises/{id}` — confirmado `gifUrls`/`imageUrls` em múltiplas resoluções). O emulador local de Functions apresentou uma falha de carregamento pré-existente neste repositório, não relacionada ao código novo (o módulo importa sem erro em Node puro) — validação real feita fazendo deploy direto pra produção (`traincontrollog`): secret configurado, Functions e regras do Firestore publicadas com sucesso. Teste visual final (buscar exemplo, vincular, ver o GIF no treino) delegado ao usuário, que tem acesso à conta admin real.

Bateria completa: `typecheck`, `lint` (inclui `functions/`), `format:check` (só `mobile/expo-env.d.ts` pré-existente), **33 arquivos/91 testes Vitest**, `build` e `pnpm test:emulator:rules` (cobrindo as novas regras de `sharedExerciseMedia`), todos com código 0. Versão sincronizada para `4.0.0-alpha.54`.

## Rodada 2026-08-07 — adicionar/remover série durante o treino + tradução dos nomes padrão de dia alpha.53

Dois pedidos do usuário na mesma rodada:

1. "Adicionar ou remover mais séries on the fly, sem precisar editar, swipe para esquerda." Adicionado botão "+ Adicionar série" abaixo das séries de cada exercício na tela de Treino (ativa), e gesto de arrastar para a esquerda em cada série individual (Pointer Events — funciona em toque e mouse, diferente do reordenar de exercícios que só usa HTML5 drag-and-drop nativo, sem suporte em touch) revelando um botão vermelho "Remover" que apaga só aquela série. Ambos persistem a nova contagem de séries de volta no `exercise.sets` da rotina, não só no rascunho da sessão.

2. "Os nomes dos dias não estão sendo traduzidos quando vêm de nomes padrão (templates/gerador), só os editados manualmente não traduzem [o que é esperado]." Causa: `templates.ts` sempre copiava o mesmo texto em português para `titleEn`, e o gerador automático copiava o texto do idioma ativo no momento da geração para os dois campos. Corrigido com `messageFor()` (novo, em `i18n.ts`) que busca uma chave em um idioma específico independente do idioma ativo; o Bro Split ganhou títulos reais em inglês (Peito→Chest, Costas→Back, Pernas→Legs, Ombros→Shoulders, Braços→Arms) — os demais templates já usam termos em inglês idênticos nos dois idiomas, sem mudança necessária. `main.ts` agora lê o campo certo via `localizedDayTitle()` em vez de sempre mostrar `.title`; renomear um dia agora grava o mesmo texto em `title` e `titleEn` (nome customizado não pode ser autotraduzido, então fica igual nos dois idiomas, de propósito).

Verificado end-to-end no navegador logado contra o emulador (precisou reiniciar o emulador do Firestore, já com Java instalado): gerado treino "Push" em inglês, aplicado, trocado pra PT — título mudou corretamente para "Push (Peito+Ombro+Tríceps)"; adicionada uma série (persistiu após reload); preenchidas cargas distintas (10/20/30/40) em 4 séries, removida a 3ª via swipe simulado por Pointer Events — sobrou exatamente 10/20/40, na ordem certa, persistindo após reload.

Bateria completa: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente), **33 arquivos/90 testes Vitest** (3 novos: 2 de templates bilíngues, 1 de `messageFor`) e `build`, todos com código 0. Versão sincronizada para `4.0.0-alpha.53`.

## Rodada 2026-08-07 — botões sem estilo (padrão do navegador) alpha.52

Usuário reportou que os botões de "duplicar" e do "voucher" (código do treinador) estavam feios. Causa: `<button id="duplicate-day">` na tela de Nutrição e o botão de submit/desvincular do formulário de código do treinador em Configurações não tinham nenhuma `class`, então renderizavam com a aparência crua padrão do navegador em vez do visual customizado do resto do app — o `<input type="date">` ao lado do botão de duplicar também estava sem estilo. Corrigido reaproveitando as classes `.secondary`/`.primary` já usadas em todo o app e adicionando `.nutrition-copy input` ao CSS.

Verificado via `getComputedStyle` no navegador (sem precisar de login): `.secondary` produz borda, fundo e padding reais em vez dos valores padrão do navegador; `.nutrition-copy input` também.

Bateria completa: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente), **33 arquivos/87 testes Vitest** e `build`, todos com código 0. Versão sincronizada para `4.0.0-alpha.52`.

## Rodada 2026-08-07 — rótulos de módulo e "readiness" traduzidos alpha.51

Usuário reportou que trocar o idioma para português não traduzia "Fuel" nem "Readiness". Causa: os textos `TRAIN`/`RECOVER`/`FUEL`/`SYNC` nos cartões do dashboard, no tour inicial e nos cabeçalhos de Progresso/Nutrição estavam escritos direto no HTML gerado (`main.ts`), nunca passando por `copy()` — só o texto do botão/parágrafo abaixo era traduzido, não o rótulo do módulo. Além disso, o próprio dicionário em português tinha a palavra inglesa "Readiness" nas chaves `readiness`, `recoverModule` e `readinessCorrelation`, sem tradução real.

Corrigido com quatro chaves novas (`moduleTrainLabel`/`moduleRecoverLabel`/`moduleFuelLabel`/`moduleSyncLabel`, TREINO/RECUPERAÇÃO/NUTRIÇÃO/SINCRONIA em PT, TRAIN/RECOVER/FUEL/SYNC em EN) usadas em todos os lugares que antes tinham o literal em inglês, e trocando "Readiness"/"readiness" por "Prontidão"/"prontidão" nas três chaves do dicionário PT. Verificado diretamente no navegador importando o módulo `core/i18n.ts` e chamando `createI18n('pt').t(...)` para cada chave alterada, confirmando os valores traduzidos sem precisar de login.

Bateria completa: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente), **33 arquivos/87 testes Vitest** e `build`, todos com código 0. Versão sincronizada para `4.0.0-alpha.51`.

## Rodada 2026-08-07 — filtro de grupo muscular/equipamento ao adicionar exercício alpha.50

Usuário reportou que a tela de adicionar exercício durante a montagem da rotina só tinha busca por texto, sem filtro por área do corpo/aparelho, e pediu que o filtro fizesse sentido para o dia (ex.: dia "Peito" já mostrar exercícios de peito). Reaproveitados os mesmos chips de grupo muscular (`muscleGroupKeys`/`muscleGroupLabels`, antes só declarados dentro de `renderWorkoutGenerator`, agora hoisted para módulo) e equipamento já usados no gerador automático. Nova função `guessDayMuscleGroups` prioriza os músculos dos exercícios já cadastrados no dia (somando `exercise.muscles` e comparando contra `MUSCLE_GROUPS`); se o dia estiver vazio, cai para um match de palavra-chave no título (peito/chest, costas/back, perna/legs, ombro/shoulder, braço/arms, abdômen/abs, push, pull, corpo inteiro/full body).

Verificado manualmente no navegador (dev server + emulador de Auth/Firestore, exigiu instalar um JDK local para o emulador do Firestore funcionar): dia renomeado para "Peito" sem exercícios pré-seleciona o chip "Chest" pelo título; depois de adicionar "Leg Press" ao mesmo dia (ainda chamado "Peito"), reabrir o seletor pré-seleciona "Legs" — confirmando que o palpite por músculo real tem prioridade sobre o título desatualizado. Multi-seleção de grupos e combinação com filtro de equipamento (ex.: Legs + Machine) testados e filtrando corretamente.

Bateria completa: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente), **33 arquivos/87 testes Vitest** e `build`, todos com código 0. Versão sincronizada para `4.0.0-alpha.50`.

## Rodada 2026-08-07 — onboarding interativo (spotlight) alpha.49

Fecha o último item pendente do lote "wow factor": um walkthrough interativo, não apenas o tour estático de slides já existente (alpha.35). Novo `core/spotlight.ts` com `shouldShowRoutineSpotlight` (regra pura: mostra só se o tour já terminou, o usuário ainda não tem nenhuma rotina e nunca dispensou o aviso antes — testada isoladamente sem DOM) e `showSpotlight` (overlay com recorte via `box-shadow` ao redor do elemento alvo + tooltip, sem bloquear o clique no próprio elemento destacado). Aplicado no dashboard, destacando o card "Treinar" para convidar a criar a primeira rotina.

Bateria completa: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente), **33 arquivos/87 testes Vitest** e `build` sem avisos de tamanho de chunk, todos com código 0. Versão mantida em `4.0.0-alpha.49` (mesma rodada de release do restante do lote).

## Rodada 2026-08-07 — lote "wow factor" (10 itens) alpha.49

Lote grande pedido pelo usuário de uma vez ("faça todos, não precisa seguir ordem específica"), implementado item a item: acordeon de alternativas de exercício, catálogo de cardio, três templates novos com correção de repetição determinística entre dias, perfil (idade/sexo/altura/objetivo) em Configurações, sugestão de intensidade pelo objetivo no gerador, tema claro/escuro, vídeo próprio do coach por exercício, leitor de código de barras via ZXing, pesquisa de repositório de vídeos livre, e páginas legais (Termos/EULA/Privacidade/Direitos autorais) dentro do app. Os itens de #20 a #26 já tinham sido commitados em lotes anteriores nesta mesma sessão; esta rodada fecha #27 (barcode) e #29 (legal) e sincroniza a versão para todo o conjunto.

Ao trocar `BarcodeDetector` nativo (sem suporte no Safari/Firefox) pela biblioteca ZXing, o bundle principal cresceu de ~276 kB para 737 kB minificado (196 kB gzip), disparando o aviso de chunk grande do Rollup — a biblioteca inteira era importada estaticamente em `main.ts` mesmo para quem nunca abre a câmera de código de barras. Corrigido dividindo `features/nutrition/camera.ts` em duas partes: a checagem de suporte (`barcodeCameraSupported`, sem dependência do ZXing) continua estática, e o scanner de fato (`camera-scanner.ts`, com o ZXing) passa a ser importado dinamicamente só dentro de `startBarcodeCamera`, no momento em que a câmera é aberta. Resultado: bundle principal caiu para 285 kB (80 kB gzip) e o ZXing vira um chunk `camera-scanner-*.js` de 455 kB carregado sob demanda — aviso de chunk grande desapareceu.

Bateria completa: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente) e **32 arquivos/83 testes Vitest**, todos com código 0. `build` sem avisos de tamanho de chunk. Versão sincronizada para `4.0.0-alpha.49`.

## Rodada 2026-08-06 — mesmo bug de perda de dados em mais dois lugares alpha.48

Usuário reportou "ainda limpando as séries quando troco de exercício" mesmo após a correção da alpha.46 — a princípio parecia que o fix não tinha chegado (deploy travado pela instabilidade do GitHub), mas uma varredura por todos os usos de `clearWorkoutDraft(user, selectedDay)` em `main.ts` encontrou **duas outras ações na tela de Treino ativo** com exatamente o mesmo defeito da substituição de exercício: reordenar (arrastar-e-soltar e as setas ↑↓) e remover um exercício. As três ações salvavam a rotina atualizada e então chamavam `clearWorkoutDraft` + `renderWorkout`, apagando carga/reps/marcação de concluído de **todos** os exercícios da sessão, não só do afetado.

Corrigido com o mesmo padrão da alpha.46: reordenar agora aplica o mesmo `splice` usado em `reorderExercise`/`moveExercise` diretamente em `workoutEntries` (o array em memória da sessão), e remover tira só a entrada correspondente — ambos persistidos via `saveWorkoutDraft` em vez de `clearWorkoutDraft`. Verificado que os outros quatro lugares que ainda chamam `clearWorkoutDraft` são intencionais (edições feitas na tela de Rotina, fora de um treino ativo, onde não existe uma sessão em andamento pra preservar).

Bateria completa: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente) e **31 arquivos/78 testes Vitest**, todos com código 0. Versão sincronizada para `4.0.0-alpha.48`.

## Rodada 2026-08-06 — login com Apple alpha.47

Pedido direto: "adicione apple account pra logar também, como alternativa". Implementado `loginWithApple()` em `features/auth/index.ts` usando `OAuthProvider('apple.com')` (escopos `email`/`name`), espelhando exatamente `loginWithGoogle()`. Botão "Continuar com Apple" adicionado na tela de login, verificado visualmente no dev server sem erros de console.

**Importante, não é só código**: login com Apple só funciona depois de duas configurações externas que exigem acesso a contas do usuário e não podem ser feitas por aqui:
1. No Apple Developer Portal: criar um Services ID, gerar uma chave privada "Sign in with Apple", anotar Team ID e Key ID.
2. No Console do Firebase (Authentication → Sign-in method): habilitar o provedor Apple com esses dados, e registrar a URL de retorno OAuth do Firebase no Services ID da Apple.

Sem isso, o botão aparece mas o login falha com erro do provedor não configurado — o código está pronto, falta a configuração manual do lado do usuário.

Bateria completa: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente) e **31 arquivos/78 testes Vitest**, todos com código 0. Versão sincronizada para `4.0.0-alpha.47`.

## Rodada 2026-08-06 — perda de cargas ao trocar exercício alpha.46

Bug de perda de dados real reportado em uso: "quando estou no treino e troco de exercício ele apaga toda a lista de cargas que já coloquei durante o treinamento".

Causa raiz em `main.ts`, handler do botão "Buscar alternativa" dentro de `renderExerciseEntries`: ao confirmar a troca, o código salvava a rotina atualizada e então chamava `clearWorkoutDraft(user, selectedDay)` seguido de `renderWorkout(user)` — ou seja, apagava o rascunho da sessão **inteira** e recarregava a tela do zero. Como não havia mais rascunho, `renderWorkout` recriava todas as entradas via `createEntries`, zerando carga/reps/marcação de concluído de **todos os exercícios da sessão**, não só do que foi trocado.

Corrigido para não depender de um reload completo: o exercício substituído é atualizado diretamente em `workoutEntries[exerciseIndex]` (com séries zeradas, já que são de um exercício diferente), e o rascunho é salvo com `saveWorkoutDraft` preservando as entradas de todos os outros exercícios — só reabre a tela para refletir a mudança, sem perder nada que já estava em andamento.

Bateria completa: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente) e **31 arquivos/78 testes Vitest**, todos com código 0. Não foi possível reproduzir o fluxo completo (login → treino ativo → trocar exercício) num navegador nesta sessão por exigir conta autenticada; correção revisada por código e coberta pelos testes existentes de `workout-draft`. Versão sincronizada para `4.0.0-alpha.46`.

## Rodada 2026-08-05 — bootstrap admin não aparecia no cliente alpha.45

Depois da alpha.44, o usuário confirmou estar logado com `rmagalhaes90@gmail.com` (visível no novo indicador "Conectado como") e mesmo assim o botão "Admin" não aparecia. Investigação:

`firestore.rules` já tem `isSuperAdmin() { return ... request.auth.token.email == 'rmagalhaes90@gmail.com'; }` e `functions/index.js`'s `requireAdmin()` tem o mesmo bypass por e-mail — essa conta sempre teve acesso total no backend, independente de qualquer custom claim. Mas `ensureSharedProfile()` em `features/auth/index.ts` (que alimenta `AuthState.isAdmin`, usado só pra decidir se mostra o botão no cliente) calculava `isAdmin` unicamente a partir de `token.claims.admin === true` — e essa claim nunca tinha sido de fato atribuída à conta real de produção. Ou seja: a conta sempre teve admin no backend, mas o app nunca mostrava a UI porque só o backend tinha o atalho do bootstrap, não o cliente.

Corrigido replicando o mesmo bypass no cliente: `isBootstrapAdmin(user)` compara o e-mail, usado em `ensureSharedProfile` como `isBootstrapAdmin(user) || token.claims.admin === true`.

Bateria completa: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente) e **31 arquivos/78 testes Vitest**, todos com código 0. Versão sincronizada para `4.0.0-alpha.45`.

## Rodada 2026-08-05 — visibilidade de conta logada e seletor do Google alpha.44

Feedback direto após publicar a alpha.43: "não consigo ver qual conta está logada, não aparece em lugar algum... quando clico em Google ele loga direto... não vejo as edições de exercício pra mudar link". Dois bugs de UX confirmados e corrigidos:

- Não havia nenhum lugar no app mostrando o e-mail da conta logada — corrigido com uma linha "Conectado como: {e-mail}" logo abaixo do título do dashboard.
- `loginWithGoogle()` chamava `signInWithPopup` sem `prompt: 'select_account'`, então se o navegador já tinha uma sessão do Google ativa, o popup logava direto nela sem oferecer escolha — corrigido.

Hipótese em aberto para "não vejo as edições de exercício": o Firebase Auth pode ter criado uma conta (UID) diferente da original ao logar via Google, mesmo com o mesmo e-mail — nesse caso a claim de admin da conta original não vale para essa nova identidade. Só será possível confirmar depois que o usuário verificar qual e-mail aparece agora no dashboard; nenhuma mudança de permissão foi feita nesta rodada até essa confirmação.

Bateria completa: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente) e **31 arquivos/78 testes Vitest**, todos com código 0. Versão sincronizada para `4.0.0-alpha.44`.

## Rodada 2026-08-05 — papel Coach, vínculo aluno↔treinador e gerenciador de exercícios alpha.43

A pedido direto do usuário: "precisa colocar link em inglês quando o app tiver em inglês e em português quando tiver em português... eu preciso ter acesso a trocar os links... o que tem que implementar são perfis, admin, usuário normal, coach... no app antigo eu tinha acesso a bloquear outros usuários e dar acesso admin, precisa ter perfis". Bloquear/desbloquear e conceder/revogar admin já existiam (implementados antes nesta sessão); o restante é novo.

**Vídeo PT/EN por exercício.** `exerciseSchema` ganhou `videoUrlEn` (mesma validação de `videoUrl`, HTTPS YouTube apenas). `localizedVideoUrl(exercise)` em `main.ts` escolhe `videoUrlEn` quando `i18n.locale === 'en'`, com fallback para o outro campo se um dos dois estiver vazio (nunca esconde o botão de vídeo por falta de tradução).

**Catálogo de exercícios no Firestore.** O caminho `shared/exerciseDatabase` já existia nas regras de segurança desde antes (aparentemente preparado para isso, nunca consumido). Implementado `features/catalog/sharedCatalog.ts`: carrega o documento uma vez por sessão e substitui o conteúdo do array `exerciseCatalog` (mutação in-place via `splice`, preservando a referência que `generator.ts`/`templates.ts`/a busca do catálogo já importam), com fallback para o JSON empacotado no build se o Firestore ainda não tiver sido inicializado, e cache em IndexedDB para o cenário offline. `saveSharedExerciseCatalog` valida com Zod antes de gravar.

**Gerenciador de exercícios.** Tela nova (`renderExerciseManager`) com busca, edição (nome, equipamento, séries/reps/descanso, pesos por músculo em texto `chave:peso`, os dois links de vídeo, notas) e remoção — tudo persistido no Firestore compartilhado, refletido para todos os usuários sem deploy. Acessível pelo Admin e pelo painel do Coach.

**Papel Coach.** Custom claim `coach` (Firebase Auth), espelhando exatamente o padrão já existente do `admin`: função `setCoachRole` (admin-only), refletida em `sharedUsers/{uid}.isCoach` e na tela de Admin (botão tornar/remover coach por usuário). `AuthState` ganhou `isCoach`, lido em `ensureSharedProfile` a partir do ID token.

**Vínculo treinador↔aluno.** Por código de convite, não por busca de e-mail (evita expor a lista de usuários a um coach): `createCoachInvite` (coach gera um código de 6 caracteres, válido 7 dias) e `redeemCoachInvite` (aluno digita o código; a function grava `coaches/{coachUid}/students/{uid}` e `coachOf/{uid}` via Admin SDK, com o e-mail de cada lado denormalizado para exibição sem precisar de outra leitura). `leaveCoach` permite ao aluno desvincular a qualquer momento — tudo em Configurações.

**Escopo de acesso do coach aos dados do aluno — testado nos emuladores, não só assumido.** Regras novas em `firestore.rules`: um coach só enxerga um aluno depois que o vínculo existe (`isLinkedCoach`, checado via `exists()` na subcoleção `coaches/{coachUid}/students`), e mesmo assim só os documentos explicitamente listados: leitura de `bodyWeights`, `bodyMeasurements`, `sessionLog`, `readinessLog`, `exerciseHistory`, `exerciseRecords`, `progressionDecisions`, `profile`; escrita apenas em `workouts` (pra montar a rotina). Nutrição, suplementos, fotos e configurações do aluno permanecem inacessíveis ao coach. Os vínculos (`coaches/*/students/*`, `coachOf/*`) só podem ser escritos pelas Cloud Functions (Admin SDK bypassa regras); nenhum cliente pode se auto-vincular como coach de alguém diretamente. `scripts/firebase-rules-test.mjs` ganhou 10 novas asserções cobrindo exatamente esses limites (acesso negado antes do vínculo, permitido depois, negado para documentos fora do escopo, escrita direta na subcoleção sempre negada) — todas passando no emulador do Firestore.

**Painel do coach.** Lista alunos vinculados (e-mail, não UID cru), botão de gerar código de convite, "Montar rotina" (reabre a tela de Rotina já existente, operando sobre o UID do aluno via um objeto `User` sintético — só o `.uid` é usado por `loadUserData`/`saveUserData`, então isso é seguro; o botão "Voltar" da Rotina foi ajustado com um override pontual pra retornar ao painel do coach em vez de tentar abrir um "Treino" em nome do aluno) e "Ver progresso" (resumo somente-leitura novo, não reaproveita a tela de Progresso interativa — evita formulários de edição que dariam erro de permissão silencioso contra as regras).

Bateria completa: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente), **31 arquivos/78 testes Vitest + 5 testes do domínio** e `build`, todos com código 0. Testes de regras do Firestore/Storage nos emuladores (Java disponível nesta rodada) cobrindo o novo escopo do coach, todos passando. O teste de Cloud Functions nos emuladores (`setCoachRole`/`createCoachInvite`/`redeemCoachInvite`/`leaveCoach`) não pôde rodar localmente por incompatibilidade de versão do Node (ambiente local tem Node 24; as functions exigem Node 22) — o CI usa Node 22 corretamente e deve validar essa parte. Nenhuma function ou regra foi publicada em produção nesta rodada; isso requer aprovação explícita separada do deploy do site estático. Versão sincronizada para `4.0.0-alpha.43`.

## Rodada 2026-08-05 — barra de descanso presa e aviso de atualização travado alpha.42

Feedback direto do usuário logo após testar a alpha.41: "tem uma barra no topo que não sai... o rest tem que aparecer na tela e mostrar o carregamento... isso está com cara de website". Em vez de assumir, os dois problemas foram reproduzidos ao vivo no site publicado antes de qualquer correção.

**Bug 1 — timer de descanso nunca esconde de verdade.** `.rest-timer` (`app-v4/src/styles.css`) define `position: fixed; top: ...; display: flex` sem condição nenhuma. O atributo HTML `hidden` depende inteiramente do navegador aplicar `[hidden] { display: none }` pela folha de estilo de user-agent — mas regras de autor sempre vencem regras de user-agent na cascata do CSS, independente de especificidade. Ou seja, `target.hidden = true` em `startRestTimer()` nunca teve efeito visual: a barra ficava sempre visível, vazia antes do primeiro descanso e travada mostrando o último tempo depois de qualquer descanso terminar ou ser cancelado. O padrão correto já existia no projeto para outro componente (`.toast[hidden] { display: none }`) — só faltou aplicar o mesmo em `.rest-timer`. Confirmado via console do navegador: um elemento `<aside class="rest-timer" hidden>` isolado tinha `display: flex` computado antes da correção e `display: none` depois.

**Bug 2 — aviso "nova versão disponível" não some ao clicar em "Atualizar agora".** Reproduzido ao vivo em `rmagalhaes90.github.io/ramon-log`: clicar no botão manteve o aviso na tela sem qualquer mudança. Causa raiz em `app-v4/public/sw.js`: o handler `activate` nunca chamava `self.clients.claim()`. `skipWaiting()` (disparado pelo clique) faz o novo worker assumir o estado "activated", mas sem `clients.claim()` ele só passa a controlar abas *novas* — a aba já aberta continua sendo servida pelo worker antigo até navegar/recarregar por conta própria. Como `main.ts` só recarrega a página em resposta ao evento `controllerchange` (que só dispara quando o controlador de fato muda), o reload nunca acontecia e o aviso ficava preso pra sempre. Corrigido adicionando `clients.claim()` ao `activate`, mais uma trava (`swRefreshing`) no listener de `controllerchange` para evitar reload duplicado caso o evento dispare mais de uma vez.

Bateria completa: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente), **31 arquivos/78 testes Vitest** e `build`, todos com código 0. A correção do timer de descanso foi verificada diretamente no navegador (elemento isolado com `hidden`, antes/depois do CSS); a correção do service worker precisa de um ciclo real de deploy → nova aba → atualização disponível pra ser validada de ponta a ponta, já que dev server local não reproduz o cenário de duas versões de SW coexistindo. Versão sincronizada para `4.0.0-alpha.42`.

## Rodada 2026-08-05 — cronômetro sob demanda e onboarding de rotina vazia alpha.41

Feedback direto do usuário logo após testar o gerador (alpha.40): "quando vou em Train ele já começa a contar o tempo. Quero ter escolha... e quando for um novo usuário? Quero que ele use e aprenda e não clique e gere tempo quando não tem nada configurado. Isso está com cara de app?"

Confirmado no código: `renderDashboard`'s `openWorkout` fazia `workoutStartedAt = new Date().toISOString()` **antes mesmo de renderizar a tela de Treino** — ou seja, o cronômetro sempre começava a contar no instante do clique em "Treinar", mesmo sem nenhuma interação real. O app legado (`main`) nunca faz isso: `startWorkoutTimer()` só é chamado por um clique explícito no botão "▶ Iniciar treino" (`stButton`/`toggleWorkoutTimer`) ou, de forma lazy, na primeira série marcada como concluída (`if(setsDone[k] && !s.startedAt) await startWorkoutTimer()`); e `renderDay()` no legado esconde o cronômetro inteiro e mostra uma tela de onboarding quando não há rotina configurada.

Port fiel do padrão do legado:

- `workoutStartedAt` deixou de ser sempre uma string (setada no load do módulo) e virou `string | null`, começando `null`. `sessionElapsedMs` trata `null` como 0. Novo `startWorkoutSession()` só seta o valor se ainda não tiver começado.
- O botão único do cabeçalho do Treino (`#session-toggle`) agora tem três estados: "▶ Iniciar treino" (não começou) → "Pausar" (rodando) → "Retomar" (pausado) — substituindo o botão de pause que sempre existia.
- `persistDraft()` (disparado ao editar carga/reps/RIR/RPE ou marcar uma série feita) chama `startWorkoutSession()` antes de salvar — ou seja, qualquer interação real com o treino inicia o cronômetro (não apenas marcar série, um pouco mais generoso que o legado, mas mantém a regra central: nunca abrir a tela já contando).
- `renderWorkout` agora verifica `workouts[selectedDay]` antes de montar a tela de execução; se não existir, chama `renderWorkoutEmptyState`, que replica exatamente a lógica do legado (`isWeekEntirelyEmpty`): semana inteira vazia → cartão de boas-vindas com "🎲 Gerar treino automático" / "📋 Usar template pronto" / "✏️ Criar manualmente"; só aquele dia vazio → convite pontual "+ Criar rotina para {dia}". Nenhum dos dois casos mostra o cronômetro ou a lista de exercícios.
- Depois de finalizar um treino (`finishWorkout`), `workoutStartedAt` volta para `null` (antes ficava setado para o horário de término, o que deixava a tela parecendo "quase rodando de novo" ao reabrir o mesmo dia).

Bateria completa: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente), **31 arquivos/78 testes Vitest** e `build`, todos com código 0. Inspeção manual do shell sem login confirmou carregamento limpo, sem erros de console; o fluxo autenticado (abrir Treino sem rotina, cronômetro sob demanda) não pôde ser exercitado nesta sessão por exigir emuladores do Firebase (Java não está no PATH herdado pelo processo do preview) — segue o padrão já estabelecido de validar interativamente após o deploy, com o usuário testando no site publicado. Versão sincronizada para `4.0.0-alpha.41`.

## Rodada 2026-08-05 — gerador automático de treino alpha.40

Segundo item da lista de prioridade combinada com o usuário ("Seguir a ordem de impacto que você listou"), depois da correção de unidades. O baseline (`main`) tem um gerador que monta uma rotina do zero a partir de grupo muscular + intensidade, distribuindo exercícios entre os músculos primários pra evitar repetição — recurso que o v4 não tinha (só templates fixos de 3 dias/upper-lower/PPL).

Implementado em duas camadas: `app-v4/src/features/workouts/generator.ts` (lógica pura, testável sem DOM) com `MUSCLE_GROUPS` (9 grupos, incluindo combinações como push/pull/corpo inteiro), `INTENSITY_LEVELS` (leve/médio/forte com séries/reps/descanso fixos por nível) e `pickDiverseExercises` — que distribui a escolha entre baldes por músculo primário embaralhados, igual ao algoritmo do legado, evitando que o gerador sempre devolva os mesmos exercícios "óbvios". A tela (`renderWorkoutGenerator` em `main.ts`) fica atrás de um botão na Rotina, com chips de grupo/equipamento e cartões de intensidade, prévia dos exercícios gerados, "sortear de novo" (reroll sem reabrir a tela) e "aplicar" (com `confirm()` porque sobrescreve a rotina do dia).

Bug incidental encontrado e corrigido durante a pesquisa: `templates.ts` (o gerador de templates fixos, não o novo) usava a chave de músculo `'back'` nos grupos pull/upper/full, mas nenhum exercício no catálogo tem essa chave (só `upperback`/`lats` separados, confirmado varrendo `exercises.json`) — ou seja, esse termo nunca contribuiu pontuação nenhuma na seleção desde sempre. Corrigido para `'upperback'`.

Bateria completa: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente), **31 arquivos/78 testes Vitest** (73 web + 5 domínio, incluindo os 6 novos em `generator.test.ts`) e `build`, todos com código 0. Inspeção manual do shell sem login confirmou carregamento limpo, sem erros de console; o fluxo autenticado (Rotina → Gerar treino) não pôde ser exercitado nesta sessão por exigir login real — segue o padrão já estabelecido de validar interativamente após o deploy. Versão sincronizada para `4.0.0-alpha.40`.

## Rodada 2026-08-05 — auditoria completa legado-vs-v4 e correção de unidades alpha.39

A pedido do usuário, foi feita uma auditoria sistemática comparando o app legado (`main`, monólito de ~650KB/11.068 linhas) com o v4 módulo a módulo (agente dedicado, ~388 funções top-level mapeadas no legado), não mais reativa a queixas pontuais. Resultado completo arquivado na conversa; achados de maior confiança viraram a lista de prioridade combinada com o usuário: unidades (corrigido nesta rodada), gerador automático de treino, gerenciador de exercícios pelo admin, superset grouping, badge de PR/histórico por exercício, metas de nutrição editáveis, shuffle/repetir última sessão, calculadora de % de gordura — ainda pendentes.

**Bug real confirmado e corrigido**: `unitSystem` (métrico/imperial) era perguntado no onboarding e salvo via `cacheSet`, mas nenhuma tela do v4 jamais lia esse valor — todo peso/medida ficava fixo em kg/cm mesmo para quem escolhia imperial. Confirmado contra o legado que a conversão (`fmtWeight`/`fmtLength`/`kgToLb`/`cmToIn` em `main`) só se aplica a peso corporal e medidas — o peso levantado nos treinos e a calculadora de anilhas (`computePlates`) sempre usam kg em ambas as versões, então o escopo da correção ficou deliberadamente restrito à tela de Progresso.

Implementado `app-v4/src/core/units.ts` (conversão pura, testado) e conectado à tela de Progresso (peso corporal, 5 medidas, gráficos, limites de campo) e a um novo controle em Configurações para trocar a unidade a qualquer momento (o onboarding só perguntava uma vez, sem chance de mudar depois).

Bateria completa: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente), **30 arquivos/77 testes Vitest** (72 web + 5 domínio, incluindo o novo `units.test.ts`) e `build`, todos com código 0.

## Rodada 2026-08-05 — correção do flake de CI no teste de compartilhamento

Após o push de alpha.38, o CI passou a falhar de forma intermitente em `test:e2e:share` (webkit-mobile), na mesma corrida "client is offline" do Firestore corrigida em `52ab852`. Duas rodadas de aumento de margem fixa (1s/2s/4s → 1s/2s/4s/8s) não resolveram — inclusive com o mesmo commit passando no CI do Pull Request e falhando no CI do push, confirmando que era carga variável do runner, não determinístico.

A causa raiz: `retryEnsureSharedProfile` usava uma lista fixa de atrasos, então o orçamento total de espera era um número fixo escolhido às cegas. Substituído por um prazo (`deadline`) com backoff exponencial capado em 5s por tentativa, até 60s de orçamento total — se o ambiente está rápido, não gasta nada disso; se está lento, continua tentando até o prazo. Logging de diagnóstico temporário (`console.warn` por tentativa) confirmou, numa rodada que passou limpo, que **nenhuma tentativa extra foi necessária** — ou seja, o mecanismo só entra em ação quando realmente preciso, sem custo no caminho normal. O logging temporário foi substituído por `reportBackgroundError` (mesmo padrão já usado em `offline-queue.ts` para falhas transitórias não fatais) e mantido permanentemente para observabilidade real, não só depuração desta sessão.

Após a limpeza: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente), **73 testes Vitest** e `build`, todos com código 0.

## Rodada 2026-08-05 — separação Treino/Rotina, vídeo embutido e celebração alpha.38

Feedback direto do usuário sobre a alpha.37: "os vídeos eram carregados embeds" (não link externo), "no html tinha treino com animação no final" (o baseline tem uma tela "TREINO COMPLETO!" com confete/sequência) e "não quero ficar com as opções abertas no treino, tem que ser em outro lugar" (a edição de séries/reps/descanso adicionada na alpha.37 estava na tela errada). Todos os três confirmados diretamente no `main` legado antes de implementar:

- `buildExCard` (tela "Dia"/execução ao vivo do legado) mostra sets/reps/descanso como texto somente-leitura e não tem botão de editar; `buildRoutineExerciseItem` (tela "Rotinas", separada) é quem tem o botão "✎" que abre `openExerciseConfig`. O v4 tinha as duas coisas misturadas numa tela só. Criada `renderRoutine`/`renderRoutineExercises` como tela dedicada (`currentView = 'routine'`), acessada por um botão no cabeçalho do Treino; a edição de alvo saiu do card de execução.
- `openVideoPlayer` no legado cria um `<iframe>` para `youtube-nocookie.com/embed/{id}` dentro de um modal (`videoPlayerModal`); o v4 antes só abria um link externo. Implementado `openVideoModal`/`closeVideoModal` com o mesmo domínio `-nocookie`. `app-v4/index.html` não define CSP, então nada bloqueava o iframe.
- O legado tem um overlay de celebração (`#celebrateOverlay`, canvas de confete, sequência de dias, compartilhar) disparado ao finalizar o treino; o v4 só atualizava um texto discreto de status. Implementada `showCelebration`/`spawnConfetti` (CSS, sem canvas) reutilizando `trainingStreak` e `shareOrFallback` já existentes.

Bateria completa após as mudanças: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente), **73 testes Vitest** e `build`, todos com código 0. Inspeção manual do shell sem login confirmou carregamento limpo, sem erros de console; os fluxos autenticados (Treino, Rotina, celebração) não puderam ser exercitados nesta sessão por exigirem login real. Versão sincronizada para `4.0.0-alpha.38`.

## Rodada 2026-08-05 — paridade de vídeos e edição de treino alpha.37

Ao investigar queixas reais de uso ("não vejo como fazer os exercícios", "não consigo trocar séries/reps/descanso"), a branch `main` (o app "bulletproof" legado, servido como `index.html` monolítico de ~650 KB, referenciado pelo link "Open stable version"/baseline) foi inspecionada diretamente. Confirmou-se que:

- O legado tem um `GEN_VIDEO_MAP` com **170 vídeos reais do YouTube** por nome de exercício; o catálogo v4 (`app-v4/src/data/exercises.json`) tem o mesmo schema/campo `videoUrl` já validado (`videoUrlSchema`, HTTPS YouTube apenas) mas **nenhum exercício tinha o campo preenchido** — uma lacuna de migração de dados, não de código. Os 170 nomes bateram 1:1 com o catálogo v4 (mesma base de dados original); todos os vídeos foram portados.
- O legado tem um modal "✎ editar" por exercício (`openExerciseConfig`) que permite alterar séries/reps/descanso/notas depois de adicionado à rotina; o v4 só tinha reordenar (↑↓) e remover — uma regressão real da reescrita, não um recurso nunca planejado. Implementado como inputs diretamente editáveis na própria linha do exercício (consistente com o padrão já usado nos campos de série), sem modal.
- Pausar o cronômetro do treino e cancelar o descanso em andamento **não existem em nenhuma das duas versões** — são recursos novos, não regressões. Implementados: pausar exclui o tempo pausado do `durationSec` final registrado; o timer de descanso ganhou um botão de cancelar.
- Tipos de equipamento (kettlebell, corda, cardio) e o papel "Coach" **também não existem no legado** — confirmado como pedidos de recurso novo/roadmap comercial (`REQUIREMENTS_MATRIX.md`), não itens perdidos na migração. Não implementados nesta rodada; ficam para decisão de escopo.

Bateria completa após as mudanças: `typecheck`, `lint`, `format:check` (só `mobile/expo-env.d.ts` pré-existente), **73 testes Vitest** e `build` — todos com código 0. Inspeção manual do shell (sem login, que exige senha) confirmou carregamento limpo. Versão sincronizada para `4.0.0-alpha.37`.

## Rodada 2026-08-05 — tour de onboarding, correção de reconexão do Firestore e E2E de compartilhamento alpha.35/36

**alpha.35** — `PARITY_MATRIX.md` apontava falta de um tour completo do produto no onboarding. Foi adicionado um tour guiado de quatro passos (Train/Recover/Fuel/Sync) exibido uma vez por conta logo após a escolha de unidades, com avançar/voltar/pular, usando o mesmo mecanismo `cacheGet`/`cacheSet` por UID já usado pelo onboarding.

**alpha.36** — ao escrever um E2E autenticado real para compartilhamento (cadastro → verificação por link → login → onboarding → tour → compartilhar relatório), foi descoberto um bug real de robustez: logo após um login recém-verificado, o Firestore pode se reportar `client is offline` na primeiríssima leitura (antes de confirmar seu primeiro round-trip bem-sucedido), e `ensureSharedProfile` tratava **qualquer** falha nessa leitura como motivo para deslogar o usuário silenciosamente — sem tentativa adicional, sem qualquer aviso. Um usuário recém-verificado podia ser jogado de volta para a tela de login sem explicação nenhuma. A correção adiciona novas tentativas com backoff (1s/2s/4s) antes de desistir, e o Firestore passou a usar `experimentalAutoDetectLongPolling` para reduzir a chance de precisar delas.

O diagnóstico foi longo porque o sintoma variava por ambiente: testes manuais no navegador (mais lentos, com pausas naturais entre ações) nunca reproduziam a corrida; o Playwright, ao agir mais rápido e de forma mais mecânica, reproduzia de forma consistente. Também foram encontrados e eliminados, no caminho, dois processos Node/Java órfãos de execuções anteriores desta sessão que ocupavam as portas 5173/8080, o que inicialmente mascarou a causa real atrás de erros de conectividade genéricos.

Novo teste `app-v4/e2e/share-emulator.spec.ts` (script `pnpm test:e2e:share`, também adicionado ao CI) usa o REST de inspeção do Auth Emulator (`GET /emulator/v1/projects/{id}/oobCodes`) para aplicar a verificação de email sem depender de e-mail real, e intercepta `navigator.clipboard.writeText` diretamente (em vez de depender de permissão real de clipboard, que o WebKit não permite conceder via automação) para validar o fallback de compartilhamento sem `navigator.share`. Passou **2/2** (Chromium e WebKit mobile) de forma consistente em múltiplas execuções.

Bateria completa executada do zero após as mudanças: `typecheck`, `lint`, `format:check`, **73 testes Vitest**, `build`, `test:e2e` (smoke, 2/2), `test:emulator:auth`, `test:emulator:rules`, `test:emulator:functions` e `test:e2e:auth` (2/2) — todos com código 0. Versão sincronizada para `4.0.0-alpha.36` em `package.json`/`version.json`/`sw.js`.

Também foi adicionado `pnpm dev:emulator` (via `scripts/dev-emulator-server.mjs`) para subir o Vite já conectado aos Emulators manualmente, útil para reproduzir este tipo de problema interativamente no navegador.

## Rodada 2026-08-04 — backup .zip, drag-and-drop e emuladores completos alpha.32/33

Ambiente sem Node/npm/pnpm/Java no `PATH`; Node 24.19.0 LTS, pnpm 11.20.0 (via `corepack`/`npm install -g`) e Microsoft OpenJDK 21 foram instalados localmente via `winget` para viabilizar o toolchain completo, incluindo os Emulators que dependem de Java. Nenhum instalador foi commitado.

**alpha.32** — `PARITY_MATRIX.md` apontava que o backup exportava só o índice de fotos (metadados), não os JPEGs do Storage. Foi implementado um escritor/leitor ZIP (método STORE, sem dependência externa) e um fluxo de backup completo que baixa cada foto do Storage, empacota com `backup.json` e, na restauração, reenvia as fotos reportando falhas parciais. Teste novo cobre round-trip binário exato, arquivo vazio e arquivo corrompido.

**alpha.33** — a mesma matriz apontava falta de drag-and-drop na reordenação de exercícios (só havia botões ↑/↓). Foi adicionado `reorderExercise` (índice arbitrário) do qual `moveExercise` passou a derivar, com eventos HTML5 de drag como reforço apenas para mouse/desktop — os botões ↑/↓ permanecem o único caminho em touch (iOS/Android não disparam os eventos de HTML5 DnD) e continuam intactos.

Cada fase rodou isoladamente do zero: `pnpm typecheck` (web/domínio/mobile), `pnpm lint`, `pnpm test` e `pnpm build` com código 0. A suíte web fechou em **29 arquivos/68 testes**, domínio em **5 testes** (73 no total). A versão foi sincronizada duas vezes (`4.0.0-alpha.32` e depois `4.0.0-alpha.33`) em `package.json`, `version.json` e `sw.js`, confirmado pelo teste de alinhamento do PWA.

Com o Java disponível pela primeira vez nesta máquina, as três suítes de Emulator rodaram até o fim e passaram com código 0: `test:emulator:auth` (criação/login/exclusão), `test:emulator:rules` (ownership, admin e limites de upload em Firestore/Storage) e `test:emulator:functions` (`setAdminRole`, `setUserBlocked`, `getEntitlements`, `deleteOwnAccount`). O emulador de Functions avisou que a versão declarada de `firebase-functions` está desatualizada e que a runtime local (Node 24) diverge da declarada (Node 22); nenhuma falha funcional resultou disso e nada foi alterado para não reabrir o ajuste já feito em `fix: make Firebase functions deployable with pnpm`.

A config do Playwright usa a porta fixa `127.0.0.1:5173`, que estava ocupada por dois processos `node.exe` (PIDs 12076 e 14224) presentes antes desta sessão e não iniciados por ela — ambos respondiam com o próprio shell do KYRO, mas sem confirmação de que apontavam para o Emulator, e o teste autenticado cria uma conta de verdade. Com autorização explícita, os dois processos foram encerrados antes de rodar qualquer E2E. `pnpm test:e2e:auth` (Auth Emulator + `scripts/auth-e2e-runner.mjs`) passou **2/2** (Chromium e WebKit mobile): cadastro isolado e bloqueio por email não verificado, com o link de verificação confirmado apontando para `127.0.0.1:9099` (Emulator), nunca para produção. `pnpm test:e2e` (sem Emulator) passou **2/2** no smoke público e ignorou corretamente os 2 cenários autenticados. Nenhum dado de produção foi tocado. Esse E2E cobre cadastro/verificação, não o fluxo de compartilhamento em si — o item "falta E2E Chromium/WebKit autenticado" da linha de Compartilhamento em `PARITY_MATRIX.md` continua pendente de um cenário dedicado.

Verificação manual em navegador ficou limitada à tela de login/PWA (Service Worker registrado, manifest OK, sem erros de console): fluxos autenticados (clicar nos novos botões de backup/drag-and-drop) exigiriam login real, que não é executado por esta sessão.

Dois commits pequenos e reversíveis foram enviados a `origin/refactor/kyro-v4-vite-typescript`: `502b7da` (backup .zip) e `7bd36fe` (drag-and-drop).

## Rodada 2026-08-04 — Firebase de produção alpha.31

As duas execuções completas do CI de `alpha.30` passaram, incluindo Auth Emulator, E2E autenticado, Firestore/Storage Rules e Functions Emulator. Em produção, `firestore.rules` e `storage.rules` compilaram e foram publicadas no projeto confirmado `traincontrollog`. As callables `deleteOwnAccount`, `getEntitlements`, `setAdminRole` e `setUserBlocked` foram implantadas como Functions v2, Node 22, 256 MB, `us-central1`; o Artifact Registry recebeu política de limpeza de sete dias.

O builder pnpm exigiu allowlist explícita para `@firebase/util`/`protobufjs` e dependência direta `@google-cloud/functions-framework` 5.0.5. Após os ajustes, as quatro Functions foram listadas e o smoke sem autenticação retornou HTTP 401 `UNAUTHENTICATED` em todos os endpoints. Um teste isolado de produção criou uma conta `.invalid`, confirmou escrita/leitura privada no Firestore, upload JPEG privado no Storage, entitlement Free autenticado, negação `PERMISSION_DENIED` para autoelevação administrativa e exclusão integral pela callable. A conta e os dados técnicos foram removidos pela própria Function.

O app web registrado, App ID, bucket, API key, authDomain e sender ID coincidem com a configuração do código. `rmagalhaes90.github.io` já constava nos domínios autorizados do Firebase Auth.

## Rodada 2026-08-04 — experiência web mobile e sync alpha.30

O dashboard passa a usar quatro cartões compactos e navegáveis em telas pequenas, com descrições PT/EN e safe areas. A tela de treino identifica visualmente Carga, Reps, RIR e RPE. O contador considera apenas a fila do usuário autenticado, atualiza após flush e a área de ajustes oferece retry manual sem remover itens não confirmados.

Prettier dos arquivos da fase, typecheck strict web/domínio/mobile, ESLint, **62 testes web**, **5 testes de domínio** e build Vite passaram. A inspeção visual em viewport 390×844 confirmou grade 2×2, ausência de overflow horizontal e cartões de 169×188 px. O smoke Chromium passou; no WebKit móvel a página e todos os elementos esperados renderizaram, mas a execução excedeu o timeout global de 30 segundos e não foi marcada como aprovada. O `format:check` global local apontou somente `mobile/expo-env.d.ts`, modificado anteriormente pelo Expo e mantido fora desta fase.

O Firebase CLI local não estava autenticado (`Failed to authenticate`), portanto Rules, Storage e Functions de produção não foram publicados nem declarados como validados nesta rodada.

## Rodada 2026-08-04 — retry offline silencioso alpha.29

Um teste dedicado garante que falhas recuperáveis de sincronização em background sejam registradas sem notificar os listeners da interface, enquanto erros de ações explícitas continuam acionando o tratamento global. A fila, tentativas e backoff permanecem inalterados.

## Rodada 2026-08-04 — validação de séries alpha.28

Os campos da série agora respeitam as restrições HTML antes de alterar ou persistir o rascunho. A conclusão é cancelada e o navegador aponta o primeiro campo inválido, impedindo que RPE acima de 10 ou outros valores fora do contrato cheguem ao schema e gerem um alerta global.

## Rodada 2026-08-04 — compatibilidade de treinos alpha.27

Typecheck web, ESLint, **27 arquivos/61 testes Vitest web** e build Vite passaram. O novo teste de regressão confirma que dias de descanso legados gravados como `null` são ignorados sem remover rotinas válidas. Histórico de exercício ou decisões de progressão incompatíveis agora usam estado auxiliar vazio e não bloqueiam a abertura da tela de treino; nenhum documento remoto é alterado durante essa recuperação.

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
