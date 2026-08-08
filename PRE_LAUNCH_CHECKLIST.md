# Checklist de pré-lançamento — KYRO v4

Data desta versão: 2026-08-08 (base: alpha.65, branch `refactor/kyro-v4-vite-typescript`).

Este documento consolida, num único lugar, **tudo que falta antes de publicar** o KYRO v4 para usuários reais — web/PWA, Android e iOS. Ele não substitui os documentos específicos já existentes ([SECURITY.md](SECURITY.md), [MONETIZATION.md](MONETIZATION.md), [GDPR_CHECKLIST.md](GDPR_CHECKLIST.md), [REQUIREMENTS_MATRIX.md](REQUIREMENTS_MATRIX.md), [PARITY_MATRIX.md](PARITY_MATRIX.md)); ele cita e agrega o que já está escrito neles, com foco em decisões e contas externas que só você pode resolver (pagamentos, domínio, jurídico, lojas), separando isso do que é trabalho de engenharia que pode ser feito aqui.

Legenda: 🔴 bloqueado por conta/decisão externa (eu não posso fazer por você) · 🟡 trabalho de engenharia pendente (posso implementar) · 🔵 requer dispositivo físico/homologação manual.

---

## 1. Pagamentos (Stripe + lojas de app)

**Estado real hoje**: existe apenas o *desenho* do sistema de entitlements (Free/Pro/Coach) e uma leitura de assinatura no cliente. Não existe nenhuma integração de cobrança funcionando. Citação direta de [MONETIZATION.md](MONETIZATION.md): *"Stripe/RevenueCat/App Store/Play Billing não estão ativados porque faltam conta comercial, produtos, preços, secrets e decisão fiscal."*

### Web/PWA (Stripe)
- [ ] 🔴 Ativar a conta Stripe para cobrança real (você já tem conta criada — falta ativação completa: dados bancários, verificação de identidade/empresa).
- [ ] 🔴 Decisão fiscal: pessoa física ou empresa emitindo a cobrança; se há obrigação de emissão de nota fiscal/recibo; em quais países/moedas vai vender (Stripe Tax ligado ou cálculo manual).
- [ ] 🔴 Criar os produtos e preços no Stripe Dashboard (Pro mensal/anual, Coach se aplicável) e decidir moeda(s), trial gratuito e política de reembolso.
- [ ] 🟡 Cloud Function para criar `Checkout Session` (server-side, nunca no cliente) e redirecionar o usuário ao Stripe Checkout.
- [ ] 🟡 Webhook assinado (`checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed`) que atualiza `subscriptions/{uid}` no Firestore — hoje esse documento não é escrito por nada real, só lido.
- [ ] 🟡 Customer Portal do Stripe (ou tela própria) para o usuário cancelar/trocar de plano/atualizar cartão sem abrir chamado.
- [ ] 🟡 Tratar downgrade/expiração: o que acontece com dados/recursos de um usuário que deixa de pagar (grace period, soft-lock, nunca apagar dados).
- [ ] 🔴 Segredos do Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) precisam ir para o Secret Manager do Firebase Functions, nunca em `VITE_*`/`.env` do cliente (já documentado em [FIREBASE_SETUP.md](FIREBASE_SETUP.md)).

### Nuance crítica — lojas de app exigem compra nativa
- [ ] 🔴 **Apple App Store e Google Play Play exigem StoreKit/Play Billing (in-app purchase nativo) para qualquer assinatura vendida dentro do app instalado pela loja.** O Stripe sozinho **não é aceito** pelas políticas da Apple/Google para desbloquear conteúdo digital dentro do app nativo — só é válido para compras feitas fora do app (web/PWA). Usar Stripe diretamente dentro do app Android/iOS pode causar rejeição na revisão ou remoção da loja.
- [ ] 🔴 Decisão: usar RevenueCat (unifica StoreKit + Play Billing + reconciliação de entitlements) ou implementar StoreKit/Play Billing nativamente. RevenueCat é o caminho mais rápido e é o que os documentos do projeto já assumem como referência.
- [ ] 🔴 Se usar RevenueCat: criar conta, configurar produtos espelhados no App Store Connect e Play Console, e decidir se o Firestore `subscriptions/{uid}` passa a ser escrito também pelo webhook do RevenueCat (não só pelo do Stripe).
- [ ] 🟡 Decidir e documentar a estratégia de preço entre canais (Apple/Google cobram até 30% de comissão; Stripe web é mais barato — táticas comuns: preço igual em todos os canais, ou incentivar assinatura via web).

---

## 2. E-mails transacionais (verificação, reset de senha)

**Estado real e bloqueio ativo hoje** (fonte: seção "Authentication email delivery" em [SECURITY.md](SECURITY.md)):

- [x] Links de verificação/reset (web e mobile) já apontam para o action handler de marca da KYRO.
- [x] `thingsofthings.ie` já tem os registros SPF do Firebase e uma política DMARC de monitoramento configurados na Hosting Ireland.
- [ ] 🔴 **Bloqueio ativo**: o Firebase exige dois registros CNAME de DKIM. O DNS Manager da Hosting Ireland está **rejeitando os valores `_domainkey` válidos fornecidos pelo Firebase como "Invalid Domain"**. Isso precisa de um chamado ao suporte do registrador (Hosting Ireland) pedindo para inserirem manualmente esses CNAMEs — é um bug/limitação da ferramenta deles, não um erro de configuração nossa.
- [ ] 🔴 Enquanto o DKIM não for verificado, o Firebase reporta *"Email template updates are currently unavailable for this project"* — ou seja, **não dá para nem customizar o remetente/template até isso ser resolvido**. Depende de: (1) chamado ao suporte da Hosting Ireland ser atendido, (2) Firebase confirmar verificação do domínio depois disso.
- [ ] 🟡 Depois do DKIM resolvido: configurar remetente customizado (ex.: `no-reply@thingsofthings.ie` ou subdomínio dedicado) em vez do remetente genérico `noreply@<project>.firebaseapp.com`.
- [ ] 🟡 Traduzir/personalizar os templates de e-mail (verificação, reset de senha, mudança de e-mail) em PT e EN com a marca KYRO — hoje usam o template padrão do Firebase.
- [ ] 🔴 Avaliar o **limite de cota padrão de e-mails do Firebase Auth** (baixo, pensado para desenvolvimento) — em escala real de usuários pode ser necessário configurar um provedor SMTP próprio (SendGrid, Postmark, SES) via Firebase Auth custom SMTP, o que também depende do domínio verificado acima.
- [ ] 🔵 Testar a chegada real desses e-mails (não caírem em spam) depois do DKIM resolvido, em pelo menos Gmail, Outlook/Hotmail e iCloud Mail.

---

## 3. Segurança

Lista textual de "Requisitos antes de produção" já registrada em [SECURITY.md](SECURITY.md), ainda pendente:

- [ ] 🟡 Executar os testes das regras já versionadas no Emulator, incluindo negação entre UIDs.
- [ ] 🟡 Substituir qualquer autorização por email no cliente por claims/controle servidor (a auditoria de 2026-08-03 já corrigiu o caso crítico do admin — confirmar que não sobrou nenhum outro ponto).
- [ ] 🟡 Implementar exclusão idempotente no backend com inventário completo de todas as subcoleções/objetos (garantir que nenhuma subcoleção nova fique órfã).
- [ ] 🔴 Ativar **App Check** em produção (reCAPTCHA Enterprise/App Attest/Play Integrity) e aplicar limites/monitoramento — depende de registrar o app nos consoles corretos.
- [ ] 🟡 Remover `unsafe-inline` da CSP, restringir `connect-src` e evitar dependências CDN.
- [ ] 🔴 Definir retenção, exportação, consentimento, incident response e revisão de privacidade (junto com a seção jurídica abaixo).
- [ ] 🟡 Confirmar que nenhum log registra tokens, e-mail, conteúdo de treino, fotos ou payloads de import.

Achados adicionais desta sessão (não bloqueantes, mas registrados):
- [ ] 🟡 `/security-review` completo do branch não encontrou nenhuma vulnerabilidade de alta confiança. Dois pontos de atenção abaixo do limiar de confiança valem revisão manual futura: possível TOCTOU no convite de Coach (janela entre validação e uso do código) e escopo de escrita do Coach no catálogo compartilhado (mais amplo do que o estritamente necessário).
- [ ] 🔴 **Todo o desenvolvimento/teste desta sessão rodou contra o projeto Firebase de produção único (`traincontrollog`)** — não há separação staging/produção em uso real hoje, apesar de documentada em [FIREBASE_SETUP.md](FIREBASE_SETUP.md). Recomendo criar um segundo projeto Firebase dedicado a staging antes de convidar usuários externos, para nunca testar mudanças de regra/dado diretamente em cima de contas reais.

---

## 4. Jurídico / GDPR / privacidade

Itens ainda não marcados em [GDPR_CHECKLIST.md](GDPR_CHECKLIST.md):

- [ ] 🔴 Identificar o controlador de dados, o DPO/contato responsável e as bases legais de tratamento.
- [ ] 🔴 Firmar DPAs (acordos de processamento de dados) com os subprocessadores usados (Firebase/Google Cloud, Stripe, qualquer provedor de e-mail/IA) e listá-los com as regiões onde os dados ficam.
- [ ] 🟡 Implementar registro/revogação de consentimento de analytics/marketing (hoje não existe nenhuma coleta de analytics — se for adicionar, o consentimento precisa vir antes).
- [ ] 🔴 Definir prazos finais de retenção e o processo de atendimento a solicitações do titular (acesso, exclusão, portabilidade) — ver base técnica em [DATA_RETENTION_POLICY.md](DATA_RETENTION_POLICY.md), que já deixa claro que prazos exatos "dependem da entidade/região e exigem revisão jurídica".
- [ ] 🔴 Revisão jurídica formal de [TERMS_OF_SERVICE.md](TERMS_OF_SERVICE.md), [PRIVACY_POLICY.md](PRIVACY_POLICY.md), [EULA.md](EULA.md) e [COPYRIGHT.md](COPYRIGHT.md) — hoje são rascunhos técnicos, não documentos validados por advogado.
- [ ] 🔴 DPIA (avaliação de impacto) para o tratamento de fotos corporais/readiness e qualquer recurso futuro de IA, dado que são dados sensíveis relacionados à saúde/imagem corporal.

---

## 5. Lojas de aplicativo (Android e iOS)

O app mobile em `mobile/` (Expo) existe, mas sua conclusão/paridade **não foi verificada nesta sessão** — todo o trabalho recente foi no `app-v4` (web/PWA). Antes de publicar nas lojas, valide separadamente o estado real do app mobile.

### Android (Google Play)
- [ ] 🔴 Criar/ativar conta de desenvolvedor no Google Play Console (taxa única).
- [ ] 🟡 Gerar keystore de assinatura de produção e configurar build de release (EAS Build já está referenciado em `mobile/eas.json` — confirmar se está configurado para release, não só dev).
- [ ] 🔴 Preencher ficha da loja: descrição, screenshots, ícone, categoria, classificação etária.
- [ ] 🔴 Preencher o formulário de segurança de dados (Data Safety) da Play Store, refletindo com precisão os dados coletados (conta, fotos, saúde/fitness, pagamento).
- [ ] 🔴 Se vender assinatura dentro do app: configurar Play Billing (ou RevenueCat) — ver seção 1.

### iOS (App Store)
- [ ] 🔴 Assinar o Apple Developer Program (US$ 99/ano).
- [ ] 🔴 Configurar App Store Connect: ficha da loja, screenshots por tamanho de tela, categoria, classificação etária, "nutrition label" de privacidade (quais dados são coletados e para quê).
- [ ] 🟡 Configurar StoreKit (ou RevenueCat) para assinatura — Stripe sozinho não passa na revisão da Apple para conteúdo digital (ver seção 1).
- [ ] 🟡 Configurar APNs (push notifications nativas) se for usar notificações remotas no iOS.
- [ ] 🔵 Rodar pelo menos um ciclo de TestFlight com testadores reais antes de submeter para revisão pública.
- [ ] 🔵 Testar em iPhone/iPad físicos — esta sessão já mostrou que bugs de Safari/WKWebView (auth, persistência) só aparecem em dispositivo real, não em emulador/desktop.

---

## 6. Lacunas funcionais registradas em REQUIREMENTS_MATRIX.md / PARITY_MATRIX.md

- [ ] 🔴 **Push remoto (FCM/APNs)**: hoje só existem notificações locais (lembretes de treino). Push remoto real exige VAPID key configurada, consentimento explícito e, no iOS, os certificados APNs da seção 5.
- [ ] 🔴 **Recursos de IA**: arquitetura documentada em [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md), mas sem provedor contratado, sem decisão de custo/consentimento de uso de dados do usuário por terceiros.
- [ ] 🟡 **CI/CD**: pipeline de qualidade (typecheck/lint/test/build/E2E) já roda no GitHub Actions, mas não há deploy automatizado — cada publicação ainda é manual.
- [ ] 🔵 **Acessibilidade**: fundação implementada (landmarks, labels, foco visível, `prefers-reduced-motion`, Playwright em Chromium/WebKit mobile), mas falta auditoria WCAG 2.2 AA formal com axe/Lighthouse, teste real com VoiceOver/TalkBack, zoom 200% e alto contraste em todas as telas antes de declarar conformidade AA.
- [ ] 🔵 **Performance**: metas definidas (Lighthouse Performance >90, Accessibility >95, Best Practices >95) mas ainda não medidas na URL final de produção — resultado muda com headers/compressão/rede reais.
- [ ] 🔵 Homologar em dispositivo real: Google Sign-In, Web Share de arquivos, instalação/atualização PWA em Safari/iOS, drag-and-drop por toque em iOS/Android (ainda pendente conforme [PARITY_MATRIX.md](PARITY_MATRIX.md)).
- [ ] 🟡 Retry offline de blobs/EXIF e resolução interativa de conflitos: fundação pronta, falta validação prolongada em iOS real.

---

## 7. Infraestrutura de publicação

- [ ] 🔴 **Decisão de hospedagem**: hoje o app está publicado via **GitHub Pages**, mas [DEPLOYMENT.md](DEPLOYMENT.md) recomenda explicitamente não usar GitHub Pages como destino definitivo durante a migração. Além disso, o hostname do GitHub Pages (`rmagalhaes90.github.io`) é diferente do `authDomain` do Firebase (`traincontrollog.firebaseapp.com`) — essa diferença foi a causa raiz de boa parte dos bugs de login no iPad/iPhone corrigidos nesta sessão (precisou de estratégia popup/redirect por hostname e troca de persistência). **Recomendação**: migrar para Firebase Hosting com domínio próprio antes do lançamento público — resolve o problema estruturalmente e passa uma imagem mais profissional do que um link `github.io`.
- [ ] 🔴 Se migrar de domínio: atualizar authorized domains no Firebase Auth, DNS do domínio próprio, e revalidar todo o fluxo OAuth novamente em dispositivo real.
- [ ] 🟡 Primeira execução do pipeline de CI remoto ainda precisa ser observada de ponta a ponta (worktree local já valida tudo, mas o ambiente do GitHub Actions nunca rodou o conjunto completo até o fim, conforme [AUDIT_REPORT.md](AUDIT_REPORT.md)).

---

## Resumo — o que trava o lançamento agora

**Só você pode resolver (contas, decisões, jurídico):**
1. Abrir chamado com o suporte da Hosting Ireland para os CNAMEs de DKIM de `thingsofthings.ie` (bloqueia e-mail de marca).
2. Ativar plenamente a conta Stripe + decisão fiscal + criar produtos/preços.
3. Decidir RevenueCat vs. StoreKit/Play Billing nativo para as lojas.
4. Contas Apple Developer Program e Google Play Console.
5. Revisão jurídica de Termos/Privacidade/EULA e definição de DPO/retenção/DPAs.
6. Decisão sobre domínio próprio + Firebase Hosting em vez de GitHub Pages.

**Eu posso implementar diretamente, quando você der sinal verde:**
- Cloud Function de Checkout Stripe + webhook assinado atualizando `subscriptions/{uid}`.
- Ativação de App Check e remoção do `unsafe-inline` da CSP.
- Templates de e-mail PT/EN (assim que o DKIM permitir customização).
- Segundo projeto Firebase de staging, separado de produção.
- Testes de regras no Emulator com negação entre UIDs.

**Precisa de dispositivo físico/homologação manual:**
- Auditoria WCAG completa, Lighthouse na URL final, testes reais em iPhone/iPad/Android, TestFlight.

Nenhum destes itens é urgente isoladamente, mas **pagamentos, DKIM e as contas de loja têm o maior lead time** (dependem de terceiros/aprovações) — vale iniciar esses primeiro mesmo que o resto do app ainda esteja em polimento.
