# Monetização

Planos previstos: Free (treino/offline/progresso essencial), Pro (progressão, insights, relatórios e comparações) e Coach (clientes/permissões). Dados do titular e exportação nunca ficam bloqueados por cancelamento.

Entitlements devem ser emitidos pelo servidor a partir de webhooks assinados. Stripe/RevenueCat/App Store/Play Billing não estão ativados porque faltam conta comercial, produtos, preços, secrets e decisão fiscal. O paywall deve informar preço, período, trial, renovação e cancelamento, sem interromper treino ou usar dark patterns.

## Princípio de divisão Free vs. Pro

Nada que trave o **primeiro treino registrado** pode ficar atrás do paywall — o app precisa entregar valor de uso diário completo no plano grátis. A conversão deve acontecer depois que o titular já investiu semanas de dado (histórico, peso, medidas) e sente que perderia algo real ao não assinar, não antes. O paywall aparece nos pontos de maior valor percebido (geração automática, analytics, fotos, export), nunca no meio do fluxo de execução de um treino.

### Free — retenção e formação de hábito

- Loop diário completo de treino: séries, reps, carga, timer, descanso, aquecimento e notas.
- Até 2 rotinas ativas simultâneas.
- Histórico das últimas 4–8 semanas por exercício, incluindo PR/recorde atual.
- Substituição/alternativa básica de exercício.
- Lembretes/notificações locais.
- Nutrição básica: refeições, macros e água do dia; busca manual de alimento.
- Peso corporal e onboarding, PT/EN, tema — tudo que reduz fricção de adoção.
- Relatório semanal compartilhável limitado (ex.: 1 por mês).

### Pro — gatilhos de conversão

- Histórico completo/ilimitado por exercício e tendências de longo prazo.
- Gerador automático de treino e os templates prontos (Full Body, Upper/Lower, PPL etc.).
- Analytics avançado: volume muscular, correlação de desempenho, tendências de medidas, e1RM.
- Mais de 2 rotinas simultâneas.
- Fotos de progresso e comparação (custo real de Storage).
- Backup completo `.zip` com fotos e export CSV/JSON.
- Relatório semanal compartilhável ilimitado.
- Scanner de código de barras (GTIN) na nutrição — busca manual continua grátis.
- Suplementos com agenda editável.

### Coach — cobrança separada (B2B2C)

- Papel Coach, vínculo aluno↔treinador por código de convite e montagem de rotina para aluno.
- Não compete com o Pro individual: monetiza o profissional que gerencia múltiplos alunos, cobrança e limites de vagas definidos à parte.
