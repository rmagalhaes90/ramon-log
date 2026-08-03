# KYRO Mobile

## Requisitos

- Node 22.13 ou superior.
- pnpm 11.
- Expo Go compatível com SDK 57 ou um development build.
- Android Studio para emulador Android; Xcode em macOS para simulador iOS.

## Configuração

Copie os campos `EXPO_PUBLIC_FIREBASE_*` de `.env.example` para um `.env.local` não versionado. São identificadores públicos do aplicativo Firebase; nunca use service accounts ou segredos de backend.

```powershell
pnpm install
pnpm mobile:check
pnpm mobile:start
```

No terminal do Expo, use `a` para Android. iOS nativo exige macOS/Xcode. O QR code pode ser aberto em um dispositivo compatível com o SDK adotado.

## Estado funcional

- Expo Router e TypeScript strict.
- Tokens visuais KYRO e safe area.
- Tela inicial consumindo `@kyro/domain`.
- Login Firebase por e-mail/senha.
- Persistência de sessão com AsyncStorage.
- Bloqueio local imediato para e-mail não verificado.
- Configuração EAS apenas preparatória; nenhum projeto EAS, build remoto ou publicação foi criado.

Cadastro, recuperação, verificação, dashboard autenticado e repositórios de dados serão migrados nas próximas fases, sempre mantendo o web operacional.

## Verificações

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm mobile:bundle
```

`expo-doctor` possui verificações que chamam `npm` internamente. Nesta máquina essas verificações ambientais falham com `spawn npm ENOENT`; as verificações de schema e compatibilidade de versões devem ser avaliadas separadamente do aviso do executável ausente.
