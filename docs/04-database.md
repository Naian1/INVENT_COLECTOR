# 04 - Database
> **Leitura guiada para estudo:** este documento foi organizado para explicar o papel do módulo, o fluxo prático que ele executa e onde conferir o comportamento no código. Para estudar, leia primeiro o objetivo, depois acompanhe os arquivos/comandos citados e compare a entrada, o processamento e a saída descritos.

## Banco principal

- Plataforma: Supabase PostgreSQL
- Modelo: relacional
- Foco: integridade referencial + historico operacional

## Entidades centrais

- piso
- empresa
- tipo_equipamento
- equipamento
- setor
- inventario
- movimentacao
- suprimentos
- telemetria_pagecount
- telemetria_pagecount_diaria
- telemetria_substituicao_pendente
- telemetria_substituicao_evento_retido
- tarifas_bilhetagem

## Entidades Matrix

- inventario_consolidado_carga
- inventario_consolidado_linha

## Relacoes principais

- setor -> piso
- equipamento -> empresa
- equipamento -> tipo_equipamento
- inventario -> equipamento
- inventario -> setor
- inventario -> inventario (nr_invent_sup)
- movimentacao -> inventario
- movimentacao -> setor (origem/destino)
- suprimentos -> inventario
- telemetria_pagecount -> inventario
- telemetria_pagecount_diaria -> inventario
- telemetria_substituicao_pendente -> inventario (referencia/substituto) e setor
- telemetria_substituicao_evento_retido -> telemetria_substituicao_pendente e inventario
- tarifas_bilhetagem -> tabela parametrica (sem FK obrigatoria)
- inventario_consolidado_linha -> inventario_consolidado_carga

## Compatibilidade de auditoria (inventario x movimentacao)

- Ambientes legados podem nao ter `movimentacao.cd_usuario`.
- Nesses casos, a auditoria do inventario usa `movimentacao.nm_usuario` com match por `usuario.nm_usuario`.
- Campos de auditoria em inventario:
  - `cd_usuario_criacao`
  - `cd_usuario_ultima_alteracao`
- Trigger de touch:
  - `fn_inventario_touch_dt_atualizacao` so atualiza `dt_atualizacao` quando a coluna existe no schema do ambiente.

## Regras criticas

1. Hierarquia de inventario
- Equipamento RAIZ nao aceita nr_invent_sup.
- Equipamento FILHO em status ATIVO exige nr_invent_sup.
- Filho e superior devem estar no mesmo setor.
- Hostname (`inventario.nm_hostname`) e usado para equipamentos RAIZ/AMBOS.
- Equipamentos FILHO nao persistem hostname.

2. Status operacional padrao
- ATIVO
- MANUTENCAO
- BACKUP
- DEVOLUCAO

3. Estrutura de setor (hospital)
- `piso`: entidade propria para andares/blocos (`cd_piso`, `nm_piso`, `ds_piso`).
- `setor.cd_piso`: vinculacao obrigatoria do setor a um piso.
- `setor.nm_setor`: unidade funcional (SAME, UTI, Recepcao etc.).
- `setor.nm_localizacao`: detalhamento opcional (sala/corredor/local).
- Unicidade composta em setor: (`cd_piso`, `nm_setor`, `nm_localizacao`).
- Modelo alvo: manter `nm_piso` apenas em `piso` (evitar redundancia em `setor`).
- Exibicao padronizada: usar `public.vw_setor` para retorno de setor com `nm_piso` via join.
- `setor.nm_piso` removida para evitar divergencia de dados.

4. Matrix por competencia
- Competencia no formato MM/AAAA.
- Reimportacao substitui apenas a competencia alvo.

## Boas praticas de evolucao

- Mudanca de schema deve ser refletida no `SQL Sistema.sql`.
- Mudanca de regra de negocio deve atualizar docs de API e ADR quando aplicavel.
- Operacoes destrutivas devem ter estrategia de rollback.

## Atualizacao 2026-05-04 - Pagecount diario

1. `telemetria_pagecount`
- Estado atual por `nr_inventario`.
- Constraint unica em `nr_inventario` para upsert.
- `dt_leitura` em `TIMESTAMPTZ`.

2. `telemetria_pagecount_diaria`
- Historico diario por (`nr_inventario`, `dt_referencia`).
- Guarda inicio/fim/delta do dia.
- `dt_primeira_leitura`, `dt_ultima_leitura`, `dt_atualizacao` em `TIMESTAMPTZ`.

3. Trigger
- `fn_sync_telemetria_pagecount_diaria` + `trg_sync_telemetria_pagecount_diaria`.
- Atualiza consolidado diario a cada escrita em `telemetria_pagecount`.
- Blindagem anti-ruido para queda abrupta (ex.: leitura espuria `0`).

4. Retencao
- `limpar_telemetria_pagecount_diaria_antiga(p_dias default 365)`.
- Piso minimo de seguranca: 90 dias.

Detalhes: [16-telemetria-pagecount-modelo-diario](16-telemetria-pagecount-modelo-diario.md).

## Atualizacao 2026-05-06 - Tarifas de bilhetagem

- `public.tarifas_bilhetagem` consolidada em:
  - `inventario-unificado-web/supabase/migrations/SQL Sistema.sql`
- Migration avulsa `20260505_tarifas_bilhetagem.sql` removida.

## Atualizacao 2026-05-14 - Substituicao assistida por telemetria

1. `telemetria_substituicao_pendente`
- Guarda alertas de divergencia de identidade por IP (esperado x detectado).
- Campos principais:
  - `ie_status` (`PENDENTE`, `CONFIRMADO`, `DESCARTADO`)
  - `nr_inventario_referencia`
  - `nr_inventario_substituto`
  - `nr_ip_detectado`
  - `nr_patrimonio_*`, `nr_serie_*`, `nr_mac_*`
  - `payload_evento`
- Unicidade: (`nr_inventario_referencia`, `nr_ip_detectado`) para acumular ocorrencias da mesma vaga.

2. Fluxo operacional
- Collector detecta divergencia e grava pendencia.
- Inventory-core lista e resolve manualmente (confirmar troca ou descartar alerta).
- Confirmacao move o item detectado para ativo no IP e deixa o item antigo em backup.

3. Migration
- `inventario-unificado-web/supabase/migrations/20260514_telemetria_substituicao_pendente.sql`

## Atualizacao 2026-05-18 - Resolucao de pendencia (troca x correcao cadastral)

1. Nova acao de resolucao
- `resolver_substituicao_pendente` agora aceita:
  - `CONFIRMAR_TROCA`
  - `DESCARTAR_ALERTA`
  - `CORRIGIR_DADOS`

2. Quando usar `CORRIGIR_DADOS`
- Caso de cadastro divergente com patrimonio igual e divergencia isolada em apenas um identificador:
  - serie diferente com MAC igual, ou
  - MAC diferente com serie igual.
- Atualiza dados do item de referencia sem troca fisica de inventario.

3. Melhoria no `CONFIRMAR_TROCA`
- Busca de substituto por patrimonio/serie/mac nao depende mais de `ie_situacao = A`, permitindo achar item que estava em `BACKUP`.

## Atualizacao 2026-05-19 - Fila de leituras retidas na substituicao

1. `telemetria_substituicao_evento_retido`
- Guarda um resumo diario SNMP bloqueado enquanto uma pendencia fica em aberto.
- Campos principais:
  - `id_pendencia`
  - `dt_referencia`
  - `nr_paginas_inicio_dia`
  - `nr_paginas_fim_dia`
  - `nr_paginas_dia`
  - `nr_ciclos_coleta`
  - `payload_ultimo_evento`
  - `dt_replay`
  - `nr_inventario_destino`
- Unicidade: (`id_pendencia`, `dt_referencia`) para manter no maximo uma linha por pendencia/dia.

2. Como a contagem nao duplica
- O collector atualiza a mesma linha diaria via upsert/logica equivalente.
- Quando a impressora substituta ja existe no inventario, a primeira coleta retida tenta usar o ultimo `telemetria_pagecount` dela como base.
- Exemplo: ultimo contador conhecido 100, primeira coleta retida 150, coleta seguinte 170; o resumo diario fica 70 paginas, nao 150 nem 320.
- Se nao existir base confiavel, a primeira coleta retida vira base e somente as proximas coletas somam delta.
- Exemplo de seguranca: uma reserva nunca coletada com contador fisico 50000 grava `inicio=50000`, `fim=50000`, `nr_paginas_dia=0` na primeira leitura; portanto nao vira 50000 paginas no dashboard.
- Na resolucao, o `inventory-core` soma o resumo diario no inventario correto.
- Esse desenho evita perder impressao feita durante a espera e evita criar uma linha por ciclo de coleta no Supabase.

## Referencia de estudo (linhas de codigo)

- Funcao de consolidacao diaria: `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:2920`
- Trigger diaria: `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:3029`
- Fila de coletas retidas: `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:3205`
- Tabela de tarifas: `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:3085`
- Deteccao de divergencia na ingestao: `inventario-unificado-web/supabase/functions/collector-telemetria/index.ts:1329`
- Registro da pendencia: `inventario-unificado-web/supabase/functions/collector-telemetria/index.ts:758`
- Retencao diaria compactada: `inventario-unificado-web/supabase/functions/collector-telemetria/index.ts:870`
- Resolucao assistida da pendencia: `inventario-unificado-web/supabase/functions/inventory-core/index.ts:2554`
- Correcao cadastral da pendencia: `inventario-unificado-web/supabase/functions/inventory-core/index.ts:2655`
- Replay do resumo diario retido: `inventario-unificado-web/supabase/functions/inventory-core/index.ts:1002`
- Mapa completo: `docs/18-mapa-codigo-linhas-tcc.md`
