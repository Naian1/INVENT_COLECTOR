# Mapa de Uso Real das Rotas e Services Legados

Data do mapeamento: 2026-05-22

Escopo: verificar quais services/rotas que ainda consultam tabelas antigas sao chamados pelo frontend atual. Este arquivo e apenas auditoria. Nenhum codigo, banco, Edge Function ou nome de tabela foi alterado.

## Confirmacao do Schema Atual

Foi confirmado no schema atual do Supabase que as tabelas antigas abaixo nao existem mais:

- `public.impressoras`
- `public.telemetria_impressoras`
- `public.leituras_paginas_impressoras`
- `public.suprimentos_impressoras`
- `public.alertas_impressoras`

Tabelas atuais relevantes disponiveis:

- `public.inventario`
- `public.suprimentos`
- `public.telemetria_pagecount`
- `public.telemetria_pagecount_diaria`
- `public.telemetria_substituicao_pendente`
- `public.telemetria_substituicao_evento_retido`
- `public.tarifas_bilhetagem`

Leitura pratica: qualquer rota/service que ainda consulta as tabelas antigas tende a quebrar se for executado contra o banco atual. A pergunta principal deste mapa e: "o frontend atual ainda chama isso?".

## Resumo Executivo

| Service legado | Rota `app/api` que usa | Tela/componente chamando a rota | Classificacao | Recomendacao |
|---|---|---|---|---|
| `resumoDashboardService.ts` | `/api/dashboard/resumo` | Nenhuma chamada encontrada no frontend atual | Legado exposto | Migrar ou arquivar |
| `dashboardAnaliticoService.ts` | `/api/dashboard/analitico` | Nenhuma chamada encontrada no frontend atual | Legado exposto | Migrar ou arquivar |
| `metricasImpressorasService.ts` | `/api/impressoras/[id]/metricas` | Nenhuma chamada encontrada no frontend atual | Legado exposto | Arquivar ou migrar se houver tela futura de detalhe |
| `statusSuprimentosImpressorasService.ts` | `/api/impressoras/[id]/status-suprimentos` | Nenhuma chamada encontrada no frontend atual | Legado exposto | Arquivar ou migrar se houver tela futura de detalhe |
| `visaoGeralImpressorasService.ts` | `/api/impressoras/visao-geral` | Nenhuma chamada encontrada para a rota; tambem e importado diretamente por `/operacional` | Parcialmente ativo por pagina direta | Migrar antes de remover |
| `coletorScaResumoService.ts` | `/api/coletor/sca` | Nenhuma chamada encontrada no frontend atual | Legado exposto | Arquivar se nao houver consumidor externo |
| `importacaoInventarioService.ts` | Nenhuma rota atual encontrada usando esse service | Nenhuma chamada encontrada | Sem uso aparente | Arquivar apos confirmar que nao e usado manualmente |

Observacao importante: o frontend atual de `app/impressoras/page.tsx` e `components/PainelDashboard.tsx` chama a Edge Function `inventory-print` por `invokeAuthedEdgeAction`. Nao foi encontrada chamada dessas telas para `/api/dashboard/resumo`, `/api/dashboard/analitico`, `/api/impressoras/visao-geral`, `/api/impressoras/[id]/metricas` ou `/api/impressoras/[id]/status-suprimentos`.

## Mapa Detalhado

### `resumoDashboardService.ts`

Service:

- `inventario-unificado-web/services/resumoDashboardService.ts`

Rota que usa:

- `inventario-unificado-web/app/api/dashboard/resumo/route.ts`
- Caminho HTTP: `/api/dashboard/resumo`
- A rota importa `buscarResumoDashboard` e executa o service no `GET`.

Tela/componente que chama a rota:

- Nenhuma chamada encontrada no frontend atual.
- Busca realizada por termos como `dashboard/resumo`, `api/dashboard`, `fetch`, `invokeEdge` e equivalentes nao encontrou consumidor fora de `app/api`.

Uso aparente:

- Legado exposto.
- A rota existe e pode ser chamada manualmente ou por consumidor externo, mas nao parece participar da UI atual.
- O dashboard atual (`components/PainelDashboard.tsx`) usa a Edge Function `inventory-print`, nao este endpoint.

Risco de remover:

- Medio.
- Baixo para a UI atual, porque nao ha chamada encontrada.
- Medio se existir integracao externa, bookmark antigo, teste manual ou documentacao que ainda use `/api/dashboard/resumo`.

Recomendacao:

- Migrar ou arquivar.
- Se for manter, trocar internamente para `telemetria_pagecount_diaria`, `inventario` e `suprimentos`.
- Se nao houver consumidor externo, marcar como legado e remover em etapa controlada.

### `dashboardAnaliticoService.ts`

Service:

- `inventario-unificado-web/services/dashboardAnaliticoService.ts`

Rota que usa:

- `inventario-unificado-web/app/api/dashboard/analitico/route.ts`
- Caminho HTTP: `/api/dashboard/analitico`
- A rota importa `buscarDashboardAnalitico` e executa o service no `GET`.

Tela/componente que chama a rota:

- Nenhuma chamada encontrada no frontend atual.
- Nao foi encontrado `fetch` ou wrapper chamando `/api/dashboard/analitico`.

Uso aparente:

- Legado exposto.
- Tambem chama `listarVisaoGeralImpressoras`, que por sua vez ainda consulta tabelas antigas.
- Se executado hoje, tem alto risco de erro por consultar `leituras_paginas_impressoras` e depender da visao antiga.

Risco de remover:

- Medio.
- Baixo para a UI atual, mas medio porque a rota esta publica dentro do app e pode existir uso externo.

Recomendacao:

- Migrar ou arquivar.
- Se a analise ainda for desejada, reconstruir em cima de `telemetria_pagecount_diaria`, `telemetria_pagecount`, `inventario`, `suprimentos` e `tarifas_bilhetagem`.
- Nao usar como base para novas telas sem migrar.

### `metricasImpressorasService.ts`

Service:

- `inventario-unificado-web/services/metricasImpressorasService.ts`

Rota que usa:

- `inventario-unificado-web/app/api/impressoras/[id]/metricas/route.ts`
- Caminho HTTP: `/api/impressoras/[id]/metricas`
- A rota importa `buscarMetricasImpressoraPorPeriodo` e executa o service no `GET`.

Tela/componente que chama a rota:

- Nenhuma chamada encontrada no frontend atual.
- A tela atual de impressoras (`app/impressoras/page.tsx`) usa `inventory-print` e renderiza a tabela operacional diretamente pelos dados da Edge.

Uso aparente:

- Legado exposto.
- Parece ser endpoint de detalhe historico de impressora, mas nao foi encontrada tela ativa consumindo.
- Se executado hoje, tende a falhar porque consulta `leituras_paginas_impressoras`.

Risco de remover:

- Medio.
- Pode ser baixo para o frontend atual, mas medio se houver plano de tela futura de detalhe por impressora ou link externo.

Recomendacao:

- Arquivar se nao existir tela de detalhe.
- Migrar se a ideia for manter metricas por impressora: usar `telemetria_pagecount` para leituras brutas e `telemetria_pagecount_diaria` para agregados diarios.

### `statusSuprimentosImpressorasService.ts`

Service:

- `inventario-unificado-web/services/statusSuprimentosImpressorasService.ts`

Rota que usa:

- `inventario-unificado-web/app/api/impressoras/[id]/status-suprimentos/route.ts`
- Caminho HTTP: `/api/impressoras/[id]/status-suprimentos`
- A rota importa `buscarStatusSuprimentosImpressora` e executa o service no `GET`.

Tela/componente que chama a rota:

- Nenhuma chamada encontrada no frontend atual.
- A tela atual de impressoras ja recebe suprimentos agrupados pela Edge Function `inventory-print`.

Uso aparente:

- Legado exposto.
- Parece rota antiga de detalhe/status de uma impressora especifica.
- Se executado hoje, tende a falhar porque consulta `telemetria_impressoras`, `leituras_paginas_impressoras`, `suprimentos_impressoras` e `alertas_impressoras`.

Risco de remover:

- Medio.
- Baixo para a tela atual, medio se algum detalhe antigo ou integracao externa chamar esse endpoint.

Recomendacao:

- Arquivar se nao houver tela de detalhe.
- Migrar se for manter: `suprimentos` para suprimentos atuais, `telemetria_pagecount`/`telemetria_pagecount_diaria` para leitura, e alertas derivados calculados a partir de `suprimentos`.

### `visaoGeralImpressorasService.ts`

Service:

- `inventario-unificado-web/services/visaoGeralImpressorasService.ts`

Rotas/locais que usam:

- `inventario-unificado-web/app/api/impressoras/visao-geral/route.ts`
- Caminho HTTP: `/api/impressoras/visao-geral`
- `inventario-unificado-web/app/operacional/page.tsx`
- Tambem e usado internamente por:
- `resumoDashboardService.ts`
- `dashboardAnaliticoService.ts`

Tela/componente que chama a rota:

- Nenhuma chamada encontrada para `/api/impressoras/visao-geral` no frontend atual.
- Existe uso direto pela pagina server-side `app/operacional/page.tsx`.
- Nao foi encontrado link/menu atual apontando para `/operacional`; mesmo assim a pagina existe e pode ser acessada manualmente.

Uso aparente:

- Parcialmente ativo.
- A rota `/api/impressoras/visao-geral` parece legada e sem chamada direta.
- O service em si ainda esta conectado a uma pagina real (`/operacional`), mesmo que a pagina pareca fora do fluxo principal.
- A tela principal atual `app/impressoras/page.tsx` nao usa esse service; ela usa `inventory-print`.

Risco de remover:

- Alto se remover o service sem antes avaliar `/operacional`.
- Medio se remover apenas a rota `/api/impressoras/visao-geral`, pois nao ha chamada encontrada, mas pode existir consumidor externo.

Recomendacao:

- Migrar antes de remover.
- Se a pagina `/operacional` nao for mais necessaria, arquivar a pagina e o service juntos em uma etapa controlada.
- Se for manter `/operacional`, migrar o service para `inventario`, `telemetria_pagecount`, `telemetria_pagecount_diaria` e `suprimentos`.

### `coletorScaResumoService.ts`

Service:

- `inventario-unificado-web/services/coletorScaResumoService.ts`

Rota que usa:

- `inventario-unificado-web/app/api/coletor/sca/route.ts`
- Caminho HTTP: `/api/coletor/sca`
- A rota importa `listarResumoSca` e executa o service no `GET`.

Tela/componente que chama a rota:

- Nenhuma chamada encontrada no frontend atual.
- Nao foi encontrado `fetch` ou wrapper chamando `/api/coletor/sca`.

Uso aparente:

- Legado exposto.
- Pode ter sido painel/resumo antigo do coletor SCA.
- Se executado hoje, tende a falhar porque consulta `telemetria_impressoras`.

Risco de remover:

- Medio.
- Baixo para o frontend atual; medio se algum script externo, monitoramento ou teste manual ainda usa essa rota.

Recomendacao:

- Arquivar se nao houver consumidor externo.
- Se ainda quiser resumo de coletor, reconstruir a partir de `telemetria_pagecount`, `inventario` e logs/retencoes atuais.

### `importacaoInventarioService.ts`

Service:

- `inventario-unificado-web/services/importacaoInventarioService.ts`

Rota que usa:

- Nenhuma rota atual encontrada importando esse service.
- A rota atual `inventario-unificado-web/app/api/inventario/importacoes/route.ts` possui implementacao propria e usa diretamente `empresa`, `tipo_equipamento`, `equipamento`, `setor` e `inventario`; ela nao importa `importacaoInventarioService.ts`.

Tela/componente que chama a rota/service:

- Nenhuma chamada encontrada para este service.
- A tela de importacoes parece conversar com a rota atual `/api/inventario/importacoes`, nao com este service legado.

Uso aparente:

- Sem uso aparente.
- O arquivo exporta `gerarPreviewImportacao` e `executarImportacaoInventario`, mas nenhuma importacao desses exports foi encontrada no app/components/services/lib.
- Internamente ele ainda possui logica que tenta vincular itens com a tabela antiga `impressoras`.

Risco de remover:

- Baixo/Medio.
- Baixo pelo rastreio de imports.
- Medio porque pode existir uso manual ou historico nao rastreado por import estatico.

Recomendacao:

- Arquivar apos confirmacao final.
- Nao migrar primeiro, a menos que alguem ainda use esse service fora do fluxo atual.
- Manter a rota atual `app/api/inventario/importacoes/route.ts` fora desse descarte, porque ela nao depende desse service legado.

## Evidencias de Frontend Atual

### Tela de Impressoras

Arquivo:

- `inventario-unificado-web/app/impressoras/page.tsx`

Achado:

- Usa `invokeAuthedEdgeAction("inventory-print", ...)`.
- Nao foi encontrada chamada para `/api/impressoras/visao-geral`, `/api/impressoras/[id]/metricas` ou `/api/impressoras/[id]/status-suprimentos`.

Classificacao:

- Frontend atual ativo usa Edge Function atual, nao as rotas legadas.

### Painel Dashboard

Arquivo:

- `inventario-unificado-web/components/PainelDashboard.tsx`

Achado:

- Usa `invokeAuthedEdgeAction("inventory-print", ...)`.
- Nao foi encontrada chamada para `/api/dashboard/resumo` ou `/api/dashboard/analitico`.

Classificacao:

- Frontend atual ativo usa Edge Function atual, nao os services antigos de dashboard.

### Pagina `/operacional`

Arquivo:

- `inventario-unificado-web/app/operacional/page.tsx`

Achado:

- Importa diretamente `listarVisaoGeralImpressoras`.
- Nao foi encontrado link/menu atual apontando para `/operacional`, mas a rota de pagina existe.

Classificacao:

- Uso ativo se acessada manualmente.
- Fora do fluxo principal atual, mas nao pode ser removida sem decisao consciente.

## Ordem Recomendada Para Limpeza Futura

Nada foi alterado nesta etapa. Se for limpar depois, a ordem mais segura seria:

1. Confirmar se existe algum consumidor externo das rotas `/api/dashboard/resumo`, `/api/dashboard/analitico`, `/api/coletor/sca`, `/api/impressoras/visao-geral`, `/api/impressoras/[id]/metricas` e `/api/impressoras/[id]/status-suprimentos`.
2. Decidir se a pagina `/operacional` ainda deve existir.
3. Se `/operacional` nao for usada, arquivar `app/operacional/page.tsx` junto com `visaoGeralImpressorasService.ts`.
4. Se `/operacional` for mantida, migrar `visaoGeralImpressorasService.ts` para as tabelas atuais.
5. Arquivar `importacaoInventarioService.ts` se nao houver uso manual.
6. Migrar ou remover as rotas `app/api` legadas somente depois de confirmar ausencia de consumidores externos.

## Conclusao

Pelo rastreamento estatico, a UI principal atual nao depende desses endpoints antigos. A parte ativa de impressoras e painel esta concentrada na Edge Function `inventory-print`.

O maior cuidado e `visaoGeralImpressorasService.ts`, porque apesar da rota `/api/impressoras/visao-geral` parecer sem uso, o service ainda e usado diretamente pela pagina `/operacional`.
