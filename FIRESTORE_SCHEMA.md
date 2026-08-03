# Esquema Firestore

## Atual

- `users/{uid}/data/{feature}`: documentos validados por feature (`workouts`, `sessionLog`, nutrição, progresso, readiness, fotos e preferências).
- `sharedUsers/{uid}`: email de apresentação, bloqueio e espelho não autoritativo de papel.
- `shared/exerciseDatabase`: catálogo global administrado.

Autoridade de admin vem de `request.auth.token.admin`, nunca de `sharedUsers.isAdmin`.

## Evolução versionada

Sessões, nutrição e medidas devem migrar gradualmente para subcoleções por entidade antes de exceder limites dos documentos atuais. A migração deve copiar, validar contagem/hash, marcar estado e somente depois retirar a leitura antiga. O baseline não é apagado durante essa janela.
