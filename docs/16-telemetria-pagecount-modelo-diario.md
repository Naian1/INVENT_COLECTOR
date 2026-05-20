# 16 - Telemetria Pagecount (Modelo Diario)
> **Leitura guiada para estudo:** este documento foi organizado para explicar o papel do módulo, o fluxo prático que ele executa e onde conferir o comportamento no código. Para estudar, leia primeiro o objetivo, depois acompanhe os arquivos/comandos citados e compare a entrada, o processamento e a saída descritos.

## Atualizado em 2026-05-19

## Objetivo

Reduzir crescimento de linhas no banco sem perder a leitura diaria por impressora.

## Modelo adotado

1. `telemetria_pagecount`
- Estado atual por inventario.
- 1 linha por `nr_inventario` (upsert).
- Campos-chave: `nr_paginas_total`, `dt_leitura`, `ds_status_impressora`.

2. `telemetria_pagecount_diaria`
- Historico diario por inventario e data.
- 1 linha por (`nr_inventario`, `dt_referencia`).
- Campos-chave: `nr_paginas_inicio_dia`, `nr_paginas_fim_dia`, `nr_paginas_dia`, `nr_ciclos_coleta`.

## Logica de consolidacao

- O coletor atualiza `telemetria_pagecount` via upsert.
- Trigger `trg_sync_telemetria_pagecount_diaria` roda em cada insert/update de pagecount.
- A trigger atualiza o consolidado diario:
  - `inicio_dia = primeira leitura valida do dia`
  - `fim_dia = ultimo contador aceito no dia`
  - `nr_paginas_dia` e acumulado por incremento valido entre ciclos (delta por ciclo)
  - `nr_ciclos_coleta` incrementa a cada ciclo
  - Queda abrupta de contador (ex.: reset) nao subtrai paginas do dia.
  - Salto abrupto para cima (ex.: troca de impressora com historico alto) nao soma o historico inteiro no dia.
  - Leituras fora de ordem temporal nao sobrescrevem consolidado mais recente.
- O estado atual (`telemetria_pagecount`) tambem tem trigger de protecao para nao sobrescrever contador alto com leitura espuria baixa.

## Substituicao assistida e ciclos retidos

- Quando o collector detecta que o IP respondeu com patrimonio/serie/MAC diferente do esperado, ele bloqueia a gravacao direta em `telemetria_pagecount`.
- Cada ciclo bloqueado atualiza um resumo diario em `telemetria_substituicao_evento_retido`.
- A tabela de retencao guarda uma linha por pendencia/dia, com inicio/fim/delta/ciclos.
- Na primeira linha do dia, se a identidade detectada apontar para uma impressora ja conhecida, o collector usa o ultimo contador oficial dessa impressora como base.
- Ao resolver a pendencia, o `inventory-core` soma esse resumo no inventario correto em `telemetria_pagecount_diaria`.
- O `telemetria_pagecount` segue leve como estado atual e sera atualizado na proxima coleta normal.
- Exemplo didatico:
  - ultimo contador conhecido da impressora substituta: 100;
  - primeira coleta divergente: contador total 150;
  - ciclo seguinte: contador total 170;
  - resultado no dia: soma 70 paginas, porque a base inicial foi 100 e o fim do dia chegou a 170.
- Exemplo de impressora nunca coletada:
  - contador fisico da substituta: 50000;
  - sem ultimo contador confiavel no sistema;
  - resultado inicial: `inicio_dia = 50000`, `fim_dia = 50000`, `paginas_dia = 0`.
  - proximas coletas somam apenas o delta real a partir desse baseline.
- Isso evita dois problemas ao mesmo tempo:
  - nao perde paginas impressas enquanto a pendencia aguardava confirmacao;
  - nao soma o historico inteiro de uma impressora reserva que ja chegou com contador alto.
  - nao grava uma linha por ciclo de coleta enquanto a pendencia estiver aberta.

## Fuso horario

- `dt_referencia` e calculada em `America/Sao_Paulo`.
- Janela diaria: 00:00 ate 23:59 (fuso local da operacao).
- `dt_leitura`, `dt_primeira_leitura`, `dt_ultima_leitura` e `dt_atualizacao` usam `TIMESTAMPTZ`.
- Conversao de legado: valores antigos `TIMESTAMP` foram tratados como UTC na migracao de tipo.

## Retencao

- Funcao: `limpar_telemetria_pagecount_diaria_antiga(p_dias integer default 365)`.
- Piso minimo de seguranca: 90 dias.
- Funcao legado `limpar_telemetria_antiga()` preservada para compatibilidade.

## Vantagens praticas

- Queda drastica do volume de linhas.
- Bilhetagem diaria mais simples.
- Vinculo por patrimonio/inventario (nao depende de IP fixo).
- Mantem historico suficiente para analise mensal e auditoria operacional.

## Risco conhecido e mitigacao

Risco:
- Ambientes antigos sem constraint unica em `telemetria_pagecount.nr_inventario`.

Mitigacao:
- Migration cria `UNIQUE (nr_inventario)`.
- Coletor e API mantem fallback de insert legado para nao interromper ingestao em ambiente desatualizado.

## Mapa de codigo (linhas)

- Funcao SQL de consolidacao diaria:
  - `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:2920`
- Trigger que dispara a consolidacao:
  - `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:3029`
- Fila de ciclos retidos em substituicao:
  - `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:3205`
- Replay do resumo retido no diario:
  - `inventario-unificado-web/supabase/functions/inventory-core/index.ts:763`
- Leitura da tabela consolidada no backend do dashboard:
  - `inventario-unificado-web/services/telemetriaDiariaService.ts:437`
- Delta diario usado nos cards/ranking:
  - `inventario-unificado-web/services/telemetriaDiariaService.ts:275`
- Referencia completa (coletor + API + frontend):
  - `docs/18-mapa-codigo-linhas-tcc.md`
