# Arquitetura multiplataforma do KYRO

## Decisão

O KYRO seguirá uma evolução conservadora. O web Vite permanece em `app-v4`, o baseline legado permanece na raiz e o aplicativo nativo vive em `mobile`. Código independente da interface é extraído incrementalmente para `packages`; não haverá movimentação geral do web nem alteração silenciosa dos documentos Firebase.

```text
app-v4/             Web e PWA completos
mobile/             Expo + React Native + Expo Router
packages/domain/    Regras puras consumidas pelas duas plataformas
functions/          Operações privilegiadas no backend
```

## Fronteiras

- Compartilhável: cálculos, tipos, validações, normalização e contratos de repositório.
- Exclusivo web: DOM, CSS, IndexedDB, Service Worker, Web Share e painel administrativo.
- Exclusivo mobile: componentes React Native, AsyncStorage, câmera, notificações nativas e safe areas.
- Compartilhado por contrato: Firebase Auth, caminhos de dados, regras de autorização e schemas versionados.

O pacote `@kyro/domain` não importa React, Firebase, DOM ou APIs nativas. Nesta fase ele contém datas e cálculos de treino e progresso. O web reexporta essas funções pelos módulos anteriores para preservar todos os imports existentes.

## Segurança

O mobile usa os mesmos identificadores públicos Firebase por variáveis `EXPO_PUBLIC_*`. Autorização continua nas Rules, custom claims e Callable Functions. A sessão do Auth usa AsyncStorage compatível com Expo; credenciais e tokens nunca são gravados por código próprio. Usuários sem e-mail verificado são desconectados imediatamente.

## Rollback

A remoção de `mobile`, `packages/domain` e das referências de workspace restaura o estado anterior. Como nenhum schema, Rule, Function ou dado remoto foi alterado nesta fase, o rollback não exige migração de dados.
