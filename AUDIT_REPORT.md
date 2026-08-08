# KYRO — Relatório de auditoria inicial

Data: 2026-08-02. Baseline: `2026-08-01-bulletproof-update-share-v14`.

## Escopo e método

Foram inspecionados todos os oito arquivos versionados do produto (`index.html`, `sw.js`, dois manifests, `version.json` e três imagens), além do histórico/estado Git. O baseline é uma aplicação sem pipeline de build: `index.html` possui 661.165 bytes e 11.068 linhas, reunindo marcação, estilos, dados estáticos e lógica. A análise estática contabilizou 371 funções, 47 declarações globais `let`, 203 `addEventListener`, 107 atribuições a `innerHTML`, 39 acessos a `localStorage`, 15 a `sessionStorage`, 35 `catch` vazios e 17 acessos explícitos a coleções Firestore.

## Inventário funcional

- Conta: email/senha, Google, recuperação, verificação de email, bloqueio administrativo, logout, onboarding guiado e exclusão integral com reautenticação.
- Treino: rotinas semanais, exercícios/abdominais, séries, aquecimento, carga, repetições, notas, reordenação, substituição, gerador automático, timer, descanso, placas, PR/e1RM e resumo compartilhável.
- Progresso: histórico, volume muscular, peso, medidas, gordura corporal, fotos e comparação, readiness, consistência, relatório semanal, streaks e conquistas.
- Nutrição: calorias, macros, água, refeições, código de barras/Open Food Facts, suplementos e horários.
- Plataforma: PT/EN, unidades métrica/imperial, exportação/importação JSON e CSV, instalação PWA, notificações, atualização consentida, cache offline e fila de sincronização.
- Administração: base compartilhada de exercícios, listagem/bloqueio de usuários e concessão de admin limitada ao super-admin.

## Achados prioritários

| Severidade | Área                 | Evidência e risco                                                                                                                                                                                                                                                      | Tratamento v4                                                                                                      |
| ---------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Alta       | Autorização admin    | `ADMIN_EMAILS` e decisões de UI vivem no cliente. Regras Firestore/Storage não estão no repositório; não é possível provar enforcement no servidor.                                                                                                                    | Regras e emulador devem entrar no repositório; custom claims ou documento protegido devem ser fonte de autoridade. |
| Alta       | Exclusão de conta    | Exclusão percorre uma lista conhecida de documentos/arquivos. Novas subcoleções ou uploads podem ficar órfãos; falha após apagar dados mas antes de apagar Auth deixa estado parcial.                                                                                  | Callable/backend idempotente com job auditável; UI apenas inicia e acompanha.                                      |
| Alta       | CSP/XSS              | CSP permite `'unsafe-inline'`; há 107 sinks `innerHTML`. Existe `escapeHtml`, mas a segurança depende de disciplina manual e `setHtml` injeta traduções como HTML.                                                                                                     | CSP sem inline, templates DOM tipados e sanitização central.                                                       |
| Alta       | Offline/durabilidade | Cache próprio em `localStorage`, fila própria e fila de fotos coexistem; Firestore persistence é explicitamente desativada. Quota/evicção e duas filas podem perder ordem ou ficar divergentes.                                                                        | IndexedDB transacional, esquema Zod, operações idempotentes e telemetria de conflitos.                             |
| Alta       | Firebase config      | Config pública e VAPID ficam no HTML (normal para identificadores Firebase), mas App Check usa modo configurável e regras não estão presentes.                                                                                                                         | Variáveis Vite, App Check obrigatório em produção, regras versionadas e testes de emulador.                        |
| Média      | Atualizações antigas | O SW guarda shell por versão e a página usa query única, `version.json`, recovery e cache cleanup. Entretanto versões estão duplicadas em três arquivos e uma publicação não atômica pode instalar HTML/SW incompatíveis; `version.json` não tem validação de esquema. | Manifest de build gerado uma vez, assets com hash, SW precache gerado e fluxo `waiting` testado.                   |
| Média      | Safari/iOS/iPadOS    | `navigator.share` é chamado preservando ativação do clique e tem fallback. Persistência pode ser expurgada pelo SO; `Notification`/Push, BroadcastChannel, câmera e instalação têm suporte desigual. `user-scalable=no` prejudica acessibilidade.                      | Testes WebKit/mobile, detecção por capacidade, instruções de instalação e zoom permitido.                          |
| Média      | Promises/listeners   | Há chamadas fire-and-forget (`retryPendingSync`, uploads, permissão de notificação) e 35 catches silenciosos. Renderizações registram listeners repetidamente em nós recriados; parte é segura, mas não há ownership/cleanup uniforme.                                 | `void` explícito + reporter global, AbortController por feature e lifecycle central.                               |
| Média      | Dependências         | Firebase compat 10.12.2 e ZXing vêm de CDN sem SRI; o app offline depende de o recurso já ter sido obtido.                                                                                                                                                             | Pacotes fixados no lockfile e SDK Firebase modular no bundle.                                                      |
| Baixa      | Encoding             | Saída do terminal revela mojibake em textos UTF-8 quando lidos pelo code page padrão; deve ser verificado no servidor/browser.                                                                                                                                         | UTF-8 explícito no pipeline e teste visual.                                                                        |

## Análises específicas

### Autenticação, email e onboarding

Contas password não verificadas são bloqueadas antes do boot; Google é tratado como verificado. Há cooldown de reenvio, reload do usuário e flags de onboarding em sessão. O `onAuthStateChanged` executa uma sequência assíncrona longa sem cancelamento: troca rápida de conta/aba pode concluir inicialização de um usuário anterior. A v4 precisa de token de sessão/AbortController e testes para transições.

### Firestore, Storage e perda de dados

Dados pessoais usam `users/{uid}/data/{key}` e perfil compartilhado usa `sharedUsers/{uid}`; exercícios globais usam `shared/exerciseDatabase`. Escritas possuem timeout, cache e retry, mas timeout não cancela a operação remota: uma escrita considerada falha pode concluir depois e ser repetida. Fotos são comprimidas, validadas e enviadas para `users/{uid}/photos/{id}.jpg`, com fila separada em localStorage. Importação substitutiva e reset são operações de alto impacto; preservar backup automático não garante restauração se o download falhar.

### Service Worker e offline

O SW usa network-first para navegação com timeout de 2,5 s e stale-while-revalidate para assets. `Promise.allSettled` permite instalação mesmo sem todos os assets; isso mantém disponibilidade online, mas não garante primeira execução offline. O cache ignora query em assets, potencialmente servindo conteúdo incompatível. O fallback de navegação é texto 503 quando o shell não foi previamente obtido. A v4 inicia com cache nomeado e atualização por `waiting`, mas ainda requer geração automática do precache e testes reais de upgrade/interrupção.

### Compartilhamento Web Share

O baseline gera imagem, verifica `navigator.canShare({files})`, chama `navigator.share` na cadeia do gesto e diferencia `AbortError`; fallback baixa o PNG. Isso deve ser preservado. Casos a testar: iOS sem file sharing, share cancelado, canvas grande/memória baixa e download bloqueado em standalone.

## Código duplicado/morto

- Detecção de idioma existe no `<head>` e novamente no script principal.
- Helpers de timeout e versão existem em escopos diferentes.
- Persistência/retry de documentos e fotos formam duas implementações paralelas.
- Handlers de atualização são ligados por `onclick`, enquanto o restante usa listeners.
- Não é seguro remover código apenas por análise estática: o monólito possui chamadas dinâmicas e IDs usados por renderização. Nenhum código legado foi apagado nesta fase.

## Limitações da auditoria

Não há regras Firebase, funções backend, configuração de hosting, projeto de emulador nem testes existentes no repositório. Logo, autorização, deleção completa e comportamento de produção não podem ser certificados apenas pelo cliente.

## Reauditoria do escopo premium — 2026-08-03

| Severidade  | Problema                                                           | Solução aplicada                                                                   | Estado/risco residual                                              |
| ----------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Critical    | Autoridade administrativa ainda tinha fallback de email no cliente | Frontend agora aceita somente custom claim; Functions e Rules aplicam a autoridade | Resolvido; bootstrap operacional permanece apenas no backend       |
| High        | Fotos preservavam EXIF e resolução original                        | Transcodificação JPEG local, orientação, resize e limite antes da fila/upload      | Resolvido; homologar memória em iPhones antigos                    |
| High        | Ausência de headers de Hosting                                     | CSP, frame protection, nosniff, referrer e permissions policy versionados          | Implementado; validar no staging real                              |
| High        | Sem CI reproduzível                                                | GitHub Actions com qualidade, E2E, Emulators e audit, sem deploy                   | Implementado; primeira execução remota ainda precisa ser observada |
| Medium      | Manifesto v4 sem ícones/shortcuts/iOS                              | Ícones locais, maskable, apple-touch-icon, categorias e shortcuts                  | Resolvido; screenshots de loja dependem de arte final              |
| Enhancement | Progressão inteligente ausente                                     | Motor determinístico com evidência, incremento, plateau e deload explicável        | Implementado; RIR/RPE ainda não fazem parte do schema de sessão    |
| Enhancement | Monetização sem autoridade                                         | Entitlements Free/Pro/Coach calculados por callable e validados no cliente         | Fundação pronta; billing depende de contas/secrets externos        |
