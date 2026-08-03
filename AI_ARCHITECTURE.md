# Arquitetura de IA

IA é opcional e complementar. Cálculos de volume, PR, readiness, progressão, estagnação, permissões e assinatura permanecem determinísticos.

Uma ativação futura deve implementar `AIProvider`, `AIRecommendationService`, `AIUsageLimiter`, `AIPromptBuilder`, `AIResponseValidator` e `AIPrivacyGuard` exclusivamente em Functions. Requisitos: secret no backend, consentimento, minimização, rate/cost limit, timeout, schema de resposta, fallback e logs sem fotos/notas. Nenhuma recomendação pode alegar diagnóstico médico.

Integração permanece desativada até existir provedor, secret, política de dados e aprovação de custo.
