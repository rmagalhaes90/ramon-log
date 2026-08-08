# Relatório de performance

Estado verificado: Vite/tree-shaking, chunks separados de Auth/Firestore/Storage, assets hash, cache PWA versionado e listas do catálogo limitadas. O build alpha.8 ficou abaixo de 500 kB por chunk.

Metas: Performance >90, Accessibility >95 e Best Practices >95 em staging. Lighthouse ainda deve ser executado na URL final, pois headers, compressão, rede e Firebase reais alteram o resultado. Gates: nenhum chunk >500 kB, nenhuma imagem corporal sem compressão e nenhuma regressão de build sem justificativa.
