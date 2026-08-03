# Sincronização offline

IndexedDB mantém cache, fila de documentos, rascunhos e blobs de foto. Operações têm IDs estáveis, tentativas, timestamps e backoff exponencial; filas são segregadas por UID. Mudança local pendente prevalece sobre leitura remota para evitar sobrescrita silenciosa.

Preferências usam last-write-wins com `updatedAt`. Sessões concluídas e fotos usam IDs idempotentes. Estatísticas/conquistas são recalculadas das fontes. Conflitos de planos que não possam ser mesclados automaticamente devem permanecer pendentes e nunca descartar o valor local.

Recuperação ocorre ao abrir, voltar online e após operações críticas. Falha preserva item para retry; conta diferente não processa a fila anterior.

## Conflitos multi-dispositivo

O IndexedDB v3 mantém uma store `conflicts`. Antes de uma escrita online, o cliente compara a revisão remota com a última revisão conhecida localmente. Uma versão remota mais nova e divergente nunca é sobrescrita silenciosamente: ambas as versões são preservadas e a alteração local deixa a fila normal.

Em Ajustes, o usuário vê a fila, tentativas, próxima execução e conflitos. “Manter local” exige conexão e grava uma nova revisão; “Usar nuvem” valida o payload remoto, atualiza o cache e descarta somente a operação local correspondente.
