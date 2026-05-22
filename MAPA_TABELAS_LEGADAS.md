# Mapa de Tabelas Legadas de Impressoras

Data do mapeamento: 2026-05-22

Escopo solicitado: mapear referencias a tabelas antigas/inexistentes, sem refatorar codigo, sem alterar banco, sem mexer em Edge Functions e sem trocar nomes de tabela.

Tabelas procuradas:

- `impressoras`
- `telemetria_impressoras`
- `leituras_paginas_impressoras`
- `suprimentos_impressoras`
- `alertas_impressoras`

## Leitura Geral

O banco atual nao usa uma tabela separada `public.impressoras` como fonte oficial. Pelo sistema atual, impressoras sao itens dentro de `public.inventario`, normalmente filtradas pelo tipo de equipamento/categoria de impressora.

Substitutos provaveis por tabela antiga:

| Tabela antiga | Substituto atual provavel | Observacao |
|---|---|---|
| `impressoras` | `public.inventario` + `public.equipamento` + `public.setor` | A impressora hoje e um item do inventario, nao uma tabela propria. |
| `telemetria_impressoras` | `public.telemetria_pagecount`, `public.telemetria_pagecount_diaria`, `public.inventario` | O status/identidade da coleta ficou acoplado ao fluxo atual de telemetria/pagecount e ao inventario. |
| `leituras_paginas_impressoras` | `public.telemetria_pagecount` e `public.telemetria_pagecount_diaria` | Leituras brutas ficam em `telemetria_pagecount`; consolidado diario fica em `telemetria_pagecount_diaria`. |
| `suprimentos_impressoras` | `public.suprimentos` | A tabela atual de suprimentos concentra os niveis coletados por impressora/inventario. |
| `alertas_impressoras` | Sem substituto 1:1; alertas de suprimento sao derivados de `public.suprimentos`; alertas de troca usam `public.telemetria_substituicao_pendente` | Nao confundir alerta de suprimento com pendencia de substituicao. |

## Ocorrencias em Codigo de Runtime

Estas ocorrencias estao em services ou rotas que ainda podem ser chamadas pelo sistema. Sao as mais importantes para saneamento futuro.

| Arquivo | Linha aprox. | Funcao/bloco | Referencia | Uso real ou legado | Substituto provavel | Risco |
|---|---:|---|---|---|---|---|
| `inventario-unificado-web/services/coletorScaResumoService.ts` | 94 | `listarResumoSca` | `.from("telemetria_impressoras")` | Uso real possivel via rota `app/api/coletor/sca/route.ts`; parece legado do resumo SCA. | `telemetria_pagecount`, `telemetria_pagecount_diaria` e/ou `inventario`, dependendo do resumo desejado. | Medio |
| `inventario-unificado-web/services/dashboardAnaliticoService.ts` | 144 | `buscarLeiturasHistoricas` | `.from("leituras_paginas_impressoras")` | Uso real possivel via rota `app/api/dashboard/analitico/route.ts`; tabela antiga nao existe no banco atual. | `telemetria_pagecount` para historico bruto ou `telemetria_pagecount_diaria` para graficos diarios. | Alto |
| `inventario-unificado-web/services/dashboardAnaliticoService.ts` | 179 e 185 | `buscarFaixaHistoricaGlobal` | `.from("leituras_paginas_impressoras")` | Uso real possivel via rota `app/api/dashboard/analitico/route.ts`; consulta faixa historica antiga. | `telemetria_pagecount` ou `telemetria_pagecount_diaria`. | Alto |
| `inventario-unificado-web/services/metricasImpressorasService.ts` | 26 | `buscarMetricasImpressoraPorPeriodo` | `.from("leituras_paginas_impressoras")` | Uso real possivel via rota `app/api/impressoras/[id]/metricas/route.ts`. | `telemetria_pagecount` ou `telemetria_pagecount_diaria`. | Alto |
| `inventario-unificado-web/services/metricasImpressorasService.ts` | 43 | `buscarMetricasImpressoraPorPeriodo` | `.from("leituras_paginas_impressoras")` | Uso real possivel; conta resets antigos por periodo. | `telemetria_pagecount` se o reset/inconsistencia existir nele; senao precisa regra nova. | Alto |
| `inventario-unificado-web/services/resumoDashboardService.ts` | 32 | `calcularPaginasMesAtual` | `.from("leituras_paginas_impressoras")` | Uso real possivel via rota `app/api/dashboard/resumo/route.ts`; calcula paginas mes no modelo antigo. | `telemetria_pagecount_diaria` para soma mensal otimizada. | Alto |
| `inventario-unificado-web/services/resumoDashboardService.ts` | 110 e 111 | `buscarResumoDashboard` | `.from("impressoras")` | Uso real possivel via rota `app/api/dashboard/resumo/route.ts`; conta total/ativas em tabela antiga. | `inventario` filtrado por tipo impressora/status ativo. | Alto |
| `inventario-unificado-web/services/statusSuprimentosImpressorasService.ts` | 82 | `buscarStatusSuprimentosImpressora` | `.from("telemetria_impressoras")` | Uso real possivel via rota `app/api/impressoras/[id]/status-suprimentos/route.ts`. | `telemetria_pagecount` para ultima leitura/status e `inventario` para identidade. | Alto |
| `inventario-unificado-web/services/statusSuprimentosImpressorasService.ts` | 88 | `buscarStatusSuprimentosImpressora` | `.from("leituras_paginas_impressoras")` | Uso real possivel; busca ultima leitura valida. | `telemetria_pagecount` ou `telemetria_pagecount_diaria`. | Alto |
| `inventario-unificado-web/services/statusSuprimentosImpressorasService.ts` | 95 | `buscarStatusSuprimentosImpressora` | `.from("suprimentos_impressoras")` | Uso real possivel; busca suprimentos pelo modelo antigo. | `suprimentos`. | Alto |
| `inventario-unificado-web/services/statusSuprimentosImpressorasService.ts` | 102 | `buscarStatusSuprimentosImpressora` | `.from("alertas_impressoras")` | Uso real possivel; busca alertas antigos de impressora. | Alertas de suprimento derivados de `suprimentos`; pendencias de troca em `telemetria_substituicao_pendente`. | Alto |
| `inventario-unificado-web/services/visaoGeralImpressorasService.ts` | 506 | `listarVisaoGeralImpressoras` | `.from("impressoras")` | Uso real possivel via rota `app/api/impressoras/visao-geral/route.ts` e imports de services antigos. | `inventario` filtrado por impressoras. | Alto |
| `inventario-unificado-web/services/visaoGeralImpressorasService.ts` | 536 e 684 | `listarVisaoGeralImpressoras` | `.from("telemetria_impressoras")` | Uso real possivel; monta status atual/fallback pelo modelo antigo. | `telemetria_pagecount`, `telemetria_pagecount_diaria` e dados ja consolidados pela Edge `inventory-print`. | Alto |
| `inventario-unificado-web/services/visaoGeralImpressorasService.ts` | 544 e 692 | `listarVisaoGeralImpressoras` | `.from("leituras_paginas_impressoras")` | Uso real possivel; monta ultima leitura/pagecount pelo modelo antigo. | `telemetria_pagecount` e `telemetria_pagecount_diaria`. | Alto |
| `inventario-unificado-web/services/visaoGeralImpressorasService.ts` | 553 e 701 | `listarVisaoGeralImpressoras` | `.from("suprimentos_impressoras")` | Uso real possivel; monta snapshot de suprimentos pelo modelo antigo. | `suprimentos`. | Alto |
| `inventario-unificado-web/services/importacaoInventarioService.ts` | 696, 709 e 721 | `encontrarImpressoraPorChaves` | `.from("impressoras")` | Uso real possivel se o fluxo antigo de importacao ainda estiver exposto; parece legado de importacao/vinculo. | `inventario` filtrado por patrimonio, IP ou serie. | Medio/Alto |

## Ocorrencias em Edge Function

Estas referencias estao em `inventory-print`, que hoje e uma Edge Function importante. Mesmo quando parecer fallback legado, o risco de alterar sem teste e alto porque a tela de impressoras/dashboard depende dessa API.

| Arquivo | Linha aprox. | Funcao/bloco | Referencia | Uso real ou legado | Substituto provavel | Risco |
|---|---:|---|---|---|---|---|
| `inventario-unificado-web/supabase/functions/inventory-print/index.ts` | 649 | bloco de enriquecimento/fallback de status | `tableExists(supabase, "telemetria_impressoras")` | Legado/fallback protegido por existencia de tabela. | `telemetria_pagecount` / `telemetria_pagecount_diaria` / `inventario`. | Alto |
| `inventario-unificado-web/supabase/functions/inventory-print/index.ts` | 670 e 681 | bloco de enriquecimento/fallback de status | `.from("telemetria_impressoras")` | Legado/fallback; so roda se a tabela existir. | `telemetria_pagecount` e status derivado da ultima coleta atual. | Alto |
| `inventario-unificado-web/supabase/functions/inventory-print/index.ts` | 1126 | `buscarLeiturasHistoricas` | `tableExists(supabase, "leituras_paginas_impressoras")` | Legado/fallback protegido por existencia de tabela. | `telemetria_pagecount` ou `telemetria_pagecount_diaria`. | Alto |
| `inventario-unificado-web/supabase/functions/inventory-print/index.ts` | 1139 | `buscarLeiturasHistoricas` | `.from("leituras_paginas_impressoras")` | Legado/fallback; usado para historico antigo se tabela existir. | `telemetria_pagecount` ou `telemetria_pagecount_diaria`. | Alto |
| `inventario-unificado-web/supabase/functions/inventory-print/index.ts` | 1174 | `buscarFaixaHistoricaGlobal` | `tableExists(supabase, "leituras_paginas_impressoras")` | Legado/fallback protegido por existencia de tabela. | `telemetria_pagecount` ou `telemetria_pagecount_diaria`. | Alto |
| `inventario-unificado-web/supabase/functions/inventory-print/index.ts` | 1181 e 1187 | `buscarFaixaHistoricaGlobal` | `.from("leituras_paginas_impressoras")` | Legado/fallback; calcula faixa historica antiga se tabela existir. | `telemetria_pagecount` ou `telemetria_pagecount_diaria`. | Alto |

## Ocorrencias em Scripts Manuais ou Legados

Estas referencias nao parecem rodar no frontend automaticamente. Ainda assim, se alguem executar o script hoje, pode falhar porque a tabela antiga nao existe.

| Arquivo | Linha aprox. | Funcao/bloco | Referencia | Uso real ou legado | Substituto provavel | Risco |
|---|---:|---|---|---|---|---|
| `inventario-unificado-web/scripts/importAbaImpressoras.mjs` | 318 | `upsertOperacional` | `.from("impressoras").upsert(...)` | Script manual legado de importacao da aba de impressoras. | `inventario` + `equipamento` + `setor`. | Medio |
| `inventario-unificado-web/scripts/importAbaImpressoras.mjs` | 322 | `upsertOperacional` | `.from("impressoras").select("id")` | Script manual legado, fallback por patrimonio. | `inventario`. | Medio |
| `inventario-unificado-web/scripts/importAbaImpressoras.mjs` | 330 | `upsertOperacional` | `.from("impressoras").update(...)` | Script manual legado, atualizacao por patrimonio. | `inventario`. | Medio |

## Ocorrencias em SQL / Historico de Migracao

O arquivo `SQL Sistema.sql` contem trechos historicos: cria tabelas antigas e depois tambem possui um bloco que derruba tabelas antigas. Isso nao significa necessariamente que essas tabelas existem hoje, mas deixa o arquivo confuso para manutencao.

| Arquivo | Linha aprox. | Funcao/bloco | Referencia | Uso real ou legado | Substituto provavel | Risco |
|---|---:|---|---|---|---|---|
| `inventario-unificado-web/supabase/migrations/SQL Sistema.sql` | 85 a 118 | bloco `OPERACIONAL DE IMPRESSORAS` | `create table public.impressoras`, indices e trigger | Historico/legado no SQL monolitico. | `inventario`. | Alto para remover sem separar historico; baixo como runtime se nao for reaplicado. |
| `inventario-unificado-web/supabase/migrations/SQL Sistema.sql` | 121 a 147 | criacao de telemetria antiga | `create table public.telemetria_impressoras` e indices | Historico/legado no SQL monolitico. | `telemetria_pagecount`, `telemetria_pagecount_diaria`. | Alto para remover sem revisar ordem do SQL. |
| `inventario-unificado-web/supabase/migrations/SQL Sistema.sql` | 149 a 182 | criacao de leituras antigas | `create table public.leituras_paginas_impressoras` e indices | Historico/legado no SQL monolitico. | `telemetria_pagecount`, `telemetria_pagecount_diaria`. | Alto para remover sem revisar ordem do SQL. |
| `inventario-unificado-web/supabase/migrations/SQL Sistema.sql` | 184 a 224 | criacao de suprimentos antigos | `create table public.suprimentos_impressoras`, indices e trigger | Historico/legado no SQL monolitico. | `suprimentos`. | Alto para remover sem revisar ordem do SQL. |
| `inventario-unificado-web/supabase/migrations/SQL Sistema.sql` | 227 a 259 | criacao de alertas antigos | `create table public.alertas_impressoras` e indices | Historico/legado no SQL monolitico. | Sem 1:1; `suprimentos` para alertas derivados, `telemetria_substituicao_pendente` para troca. | Alto para remover sem revisar ordem do SQL. |
| `inventario-unificado-web/supabase/migrations/SQL Sistema.sql` | 283 | funcao de retencao antiga | `delete from public.leituras_paginas_impressoras` | Historico/legado; depende da tabela antiga. | Regras atuais de retencao deveriam mirar `telemetria_pagecount` / diaria se necessario. | Medio/Alto |
| `inventario-unificado-web/supabase/migrations/SQL Sistema.sql` | 546 a 548 | `vinculos_itens_impressoras` | FK para `public.impressoras(id)` | Legado de vinculo item x tabela antiga. | Relacao direta por `inventario.nr_inventario` ou tabela de vinculo atual, se existir regra equivalente. | Alto |
| `inventario-unificado-web/supabase/migrations/SQL Sistema.sql` | 878 a 891 | limpeza de schema antigo | `DROP TABLE IF EXISTS public.suprimentos_impressoras`, `impressoras`, `alertas_impressoras`, `leituras_paginas_impressoras`, `telemetria_impressoras` | Bloco de limpeza, nao e uso funcional. | Nao substituir; apenas documentar/organizar. | Baixo para manter; alto para mexer sem testar migracao completa. |

## Ocorrencias em Documentacao

| Arquivo | Linha aprox. | Funcao/bloco | Referencia | Uso real ou legado | Substituto provavel | Risco |
|---|---:|---|---|---|---|---|
| `docs/05-api/collector-telemetria.md` | 85 a 87 | exemplo de resposta `modo_gravacao` | `telemetria_impressoras`, `leituras_paginas_impressoras`, `suprimentos_impressoras` | Documentacao possivelmente desatualizada; nao executa codigo. | Atualizar texto para `telemetria_pagecount`, `telemetria_pagecount_diaria`, `suprimentos` e substituicao. | Baixo |
| `RELATORIO_SANITIZACAO.md` | 127 | observacao do relatorio anterior | lista as tabelas antigas | Apenas documentacao de auditoria. | Nao se aplica. | Baixo |

## Referencias que Nao Devem Ser Tratadas Como Tabela Legada

Durante a busca, `impressoras` apareceu tambem como palavra normal do dominio, rota, menu, categoria ou slug. Essas ocorrencias nao sao necessariamente problema.

Exemplos:

- Rotas como `app/impressoras/page.tsx` e `/api/impressoras/...`.
- Textos de tela com "impressoras".
- Categoria/aba chamada `impressoras` em `abas_inventario` no SQL, por exemplo linhas aproximadas 682 a 705 do `SQL Sistema.sql`.
- Tabela `vinculos_itens_impressoras` nao foi pedida como alvo, mas ela referencia a tabela antiga `public.impressoras`; por isso entrou no mapa SQL.

## Ordem Recomendada para Refatoracao Futura

Nada foi alterado neste mapeamento. Se for corrigir depois, a ordem mais segura seria:

1. Confirmar quais rotas `app/api/...` ainda sao chamadas pelo frontend atual e quais viraram legado.
2. Priorizar services expostos por rotas reais que consultam tabelas inexistentes: `resumoDashboardService`, `dashboardAnaliticoService`, `metricasImpressorasService`, `statusSuprimentosImpressorasService` e `visaoGeralImpressorasService`.
3. Trocar consultas antigas por `inventario`, `telemetria_pagecount`, `telemetria_pagecount_diaria` e `suprimentos`, mantendo o mesmo contrato de resposta.
4. So depois revisar `inventory-print/index.ts`, porque e Edge Function critica e qualquer mudanca deve passar por teste de build, deploy e comparacao da tela de impressoras.
5. Separar o `SQL Sistema.sql` em "schema atual" e "historico/legado", para evitar que alguem rode um bloco antigo achando que e o modelo atual.
6. Marcar scripts antigos de importacao como legado ou atualizar para gravar em `inventario`, nunca em `impressoras`.
