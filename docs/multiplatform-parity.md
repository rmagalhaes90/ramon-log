# Paridade multiplataforma e percentual geral

Atualizado em 2026-08-03 após `4.0.0-alpha.16`.

O percentual geral usa pesos estáveis para impedir que uma nova tela esconda lacunas de segurança ou publicação.

| Área                                   |     Peso | Conclusão |     Contribuição | Evidência principal                                                                                           |
| -------------------------------------- | -------: | --------: | ---------------: | ------------------------------------------------------------------------------------------------------------- |
| Web/PWA completo                       |      35% |       97% |           33,95% | Funcionalidades principais, offline, PWA, PT/EN, testes e baseline preservado.                                |
| Backend e segurança Firebase           |      20% |       92% |           18,40% | Rules, Storage, claims, bloqueio e exclusão testados em Emulator.                                             |
| Admin Web                              |      10% |       70% |            7,00% | Usuários e ações protegidas existem; auditoria/paginação avançada permanecem parciais.                        |
| Domínio e infraestrutura compartilhada |      10% |       60% |            6,00% | Workspace, cálculos, dashboard e proteção de revisão compartilhados; schemas completos seguem em extração.    |
| Mobile iOS/Android                     |      20% |       45% |            9,00% | Auth, dashboard, leitura funcional e escrita offline inicial; treinos ativos, fotos e notificações pendentes. |
| Release, lojas e observabilidade       |       5% |       35% |            1,75% | CI e EAS preparados; builds assinados, lojas, Crashlytics/App Check nativo pendentes.                         |
| **Total geral**                        | **100%** |           | **76,10% ≈ 76%** | Medição do escopo ampliado Web + Admin + Mobile + Firebase.                                                   |

O percentual da migração web original permanece em aproximadamente **97%**. O percentual geral é menor porque o novo prompt adicionou um aplicativo nativo completo e preparação para lojas ao escopo.
