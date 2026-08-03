# Paridade multiplataforma e percentual geral

Atualizado em 2026-08-03 após `4.0.0-alpha.15`.

O percentual geral usa pesos estáveis para impedir que uma nova tela esconda lacunas de segurança ou publicação.

| Área                                   |     Peso | Conclusão |     Contribuição | Evidência principal                                                                                 |
| -------------------------------------- | -------: | --------: | ---------------: | --------------------------------------------------------------------------------------------------- |
| Web/PWA completo                       |      35% |       97% |           33,95% | Funcionalidades principais, offline, PWA, PT/EN, testes e baseline preservado.                      |
| Backend e segurança Firebase           |      20% |       92% |           18,40% | Rules, Storage, claims, bloqueio e exclusão testados em Emulator.                                   |
| Admin Web                              |      10% |       70% |            7,00% | Usuários e ações protegidas existem; auditoria/paginação avançada permanecem parciais.              |
| Domínio e infraestrutura compartilhada |      10% |       55% |            5,50% | Workspace e cálculos compartilhados; schemas/repositórios completos ainda estão em extração.        |
| Mobile iOS/Android                     |      20% |       35% |            7,00% | Auth, sessão, dashboard e cinco áreas de leitura; escrita, fotos, offline e notificações pendentes. |
| Release, lojas e observabilidade       |       5% |       35% |            1,75% | CI e EAS preparados; builds assinados, lojas, Crashlytics/App Check nativo pendentes.               |
| **Total geral**                        | **100%** |           | **73,60% ≈ 74%** | Medição do escopo ampliado Web + Admin + Mobile + Firebase.                                         |

O percentual da migração web original permanece em aproximadamente **97%**. O percentual geral é menor porque o novo prompt adicionou um aplicativo nativo completo e preparação para lojas ao escopo.
