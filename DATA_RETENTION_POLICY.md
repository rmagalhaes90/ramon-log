# Política de retenção

- Conta ativa: dados enquanto necessários ao serviço e controláveis pelo titular.
- Fila offline: até sincronizar, ser descartada pelo titular ou excluir a conta.
- Fotos: até exclusão da foto/conta; arquivos órfãos devem ser reconciliados.
- Logs técnicos: minimizados, sem fotos/notas, com prazo definido antes do launch.
- Exclusão: Function idempotente remove Auth, Firestore e Storage; prova legal mínima somente quando houver obrigação documentada.

Prazos exatos, backups do provedor e retenção fiscal dependem da entidade/região e exigem revisão jurídica.
