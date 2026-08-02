# Segurança

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
