# Paridade multiplataforma e percentual geral

Atualizado em 2026-08-03 após `4.0.0-alpha.26`.

O percentual geral usa pesos estáveis para impedir que uma nova tela esconda lacunas de segurança ou publicação.

| Área                                   |     Peso | Conclusão |     Contribuição | Evidência principal                                                                                                   |
| -------------------------------------- | -------: | --------: | ---------------: | --------------------------------------------------------------------------------------------------------------------- |
| Web/PWA completo                       |      35% |       97% |           33,95% | Funcionalidades principais, offline, PWA, PT/EN, testes e baseline preservado.                                        |
| Backend e segurança Firebase           |      20% |       94% |           18,80% | Rules, Storage, claims, bloqueio, exclusão e auditoria server-side protegida.                                         |
| Admin Web + Mobile                     |      10% |       90% |            9,00% | Listagem limitada, claims, ações callable e últimos 50 eventos de auditoria imutável.                                 |
| Domínio e infraestrutura compartilhada |      10% |       65% |            6,50% | Workspace, dashboard, readiness, cálculos e proteção de revisão compartilhados; schemas completos seguem em extração. |
| Mobile iOS/Android                     |      20% |       94% |           18,80% | Fluxos centrais, admin protegido, offline, mídia, alertas, PT/EN expandido, conta e recuperação de erro.              |
| Release, lojas e observabilidade       |       5% |       65% |            3,25% | CI exige bundles Android/iOS e diagnóstico local; assinatura, lojas e Crashlytics/App Check nativo pendentes.         |
| **Total geral**                        | **100%** |           | **90,30% ≈ 90%** | Medição do escopo ampliado Web + Admin + Mobile + Firebase.                                                           |

O percentual da migração web original permanece em aproximadamente **97%**. O percentual geral é menor porque o novo prompt adicionou um aplicativo nativo completo e preparação para lojas ao escopo.
