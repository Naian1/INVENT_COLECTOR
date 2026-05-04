# 16 - Telemetria Pagecount (Modelo Diario)

## Atualizado em 2026-05-04

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
  - `inicio_dia = menor contador visto no dia`
  - `fim_dia = maior contador visto no dia`
  - `nr_paginas_dia = fim_dia - inicio_dia`
  - `nr_ciclos_coleta` incrementa a cada ciclo

## Fuso horario

- `dt_referencia` e calculada em `America/Sao_Paulo`.
- Janela diaria: 00:00 ate 23:59 (fuso local da operacao).

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
