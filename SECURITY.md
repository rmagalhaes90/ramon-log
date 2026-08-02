# Segurança

## Emuladores locais

Os SDKs somente conectam aos emuladores quando `VITE_USE_FIREBASE_EMULATORS=true`. O valor padrão é `false`. Os testes automatizados usam o projeto `demo-kyro-v4`, para o qual o Firebase CLI bloqueia tentativas de acesso a serviços não emulados. O runner também encerra imediatamente se `FIREBASE_AUTH_EMULATOR_HOST` não estiver presente, evitando criação acidental de contas reais.

As regras Firestore e Storage foram executadas no Emulator com Java 21. Os testes confirmam propriedade de documentos, negação anônima e entre contas, criação de perfil sem autoelevação, limites das operações administrativas e uploads privados restritos a JPEG de até 3 MB.

## Modelo de ameaça

Protegemos dados de saúde/treino, fotos, identidade, permissões administrativas e disponibilidade offline contra acesso entre usuários, XSS, adulteração de import, perda durante sincronização e exclusão incompleta.

## Controles da fundação v4

- TypeScript strict e validação Zod nas fronteiras.
- Firebase SDK modular e configuração via ambiente; `.env*` fica fora do Git.
- IndexedDB isolado e fila com operações limitadas, retry e backoff.
- Reporter global para exceções e promises rejeitadas.
- UI nova evita interpolar dados pessoais em HTML; novos componentes devem usar `textContent`/DOM seguro.
- Dependências registradas no lockfile e auditáveis.
- Firestore Rules e Storage Rules owner-only versionadas, com admin limitado e uploads JPEG até 3 MiB.
- Exclusão com reautenticação, Storage recursivo, Firestore paginado, perfil, Auth e limpeza local nessa ordem.
- Importação aceita somente o envelope `kyro-v4-backup` versão 1, limita o arquivo a 5 MiB, rejeita campos desconhecidos e valida cada feature antes da escrita.
- CSV neutraliza células iniciadas por `=`, `+`, `-` ou `@` para reduzir formula injection em planilhas.
- Consulta nutricional envia somente o GTIN digitado ao Open Food Facts, limita campos da resposta e valida os nutrientes antes de preencher o formulário.
- Câmera é iniciada somente por gesto, nunca grava vídeo e encerra todas as tracks ao detectar um código ou sair da tela.
- Fotos offline permanecem em uma store IndexedDB owner-scoped, limitada a dez JPEGs, e o índice só é publicado após upload confirmado.

## Requisitos antes de produção

- Executar os testes das regras já versionadas no Emulator, incluindo negação entre UIDs.
- Substituir autorização por email no cliente por claims/controle servidor.
- Implementar exclusão idempotente no backend e inventário de todas as subcoleções/objetos.
- Ativar App Check em produção e aplicar limites/monitoramento.
- Remover CSP `unsafe-inline`, restringir `connect-src` e evitar dependências CDN.
- Definir retenção, exportação, consentimento, incident response e revisão de privacidade.
- Não registrar tokens, email, conteúdo de treino, fotos ou payloads de import em logs.

## Reporte

Não abra issue pública contendo dados pessoais, credenciais ou caminhos exploráveis. Revogue credenciais expostas e comunique o mantenedor por canal privado.
