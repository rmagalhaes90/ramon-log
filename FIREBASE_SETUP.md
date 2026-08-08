# Configuração Firebase

1. Copie `.env.example` para `.env.local` e preencha apenas identificadores web do ambiente.
2. Use projetos separados para staging e produção.
3. Para desenvolvimento, use `demo-kyro-v4` com `VITE_USE_FIREBASE_EMULATORS=true`.
4. Configure Auth (email/senha e Google), Firestore, Storage e Functions v2/Node 22.
5. Defina o primeiro custom claim administrativo por procedimento operacional seguro; depois use `setAdminRole`.

Secrets de Stripe, IA, webhooks ou service accounts pertencem ao Secret Manager/ambiente de Functions, nunca a `VITE_*`. App Check, Analytics, FCM, domínios autorizados e provedores sociais devem ser ativados separadamente por ambiente.

Os comandos e testes locais estão em [TESTING.md](TESTING.md). Não use `demo-*` para deploy.
