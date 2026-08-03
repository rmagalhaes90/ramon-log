# Deploy e rollback

Deploy é deliberadamente manual e separado por ambiente. Antes de staging: pipeline verde, projeto Firebase correto, secrets configurados, Rules revisadas, backup e checklist GDPR. Produção requer aprovação humana e homologação em aparelhos reais.

Ordem recomendada: Functions compatíveis → Rules → Hosting versionado. Nunca publique o projeto `demo-kyro-v4`. GitHub Pages não deve ser usado durante a migração.

Rollback: manter artefato e tag anteriores, reverter Hosting para a release anterior e preservar Functions/Rules compatíveis com ambos os schemas. Não reverta dados destrutivamente; execute migração compensatória validada.
