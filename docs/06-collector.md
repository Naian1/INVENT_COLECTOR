# 06 - Collector
> **Leitura guiada para estudo:** este documento foi organizado para explicar o papel do módulo, o fluxo prático que ele executa e onde conferir o comportamento no código. Para estudar, leia primeiro o objetivo, depois acompanhe os arquivos/comandos citados e compare a entrada, o processamento e a saída descritos.

## Objetivo

Coletar telemetria de impressoras via SNMP em ciclos, com envio autenticado ao backend.

## Stack

- Python
- pysnmp
- Scripts em coletor-snmp/scripts

## Fluxo de execucao

1. Carrega lista de impressoras alvo.
2. Executa consultas SNMP.
3. Normaliza payload de telemetria e suprimentos.
4. Envia para endpoint de coleta (upsert em `telemetria_pagecount`).
5. Se falhar, mantem fila local para reenvio.

## Por que o coletor pode mostrar menos impressoras que o inventario

- O inventario geral mostra todas as impressoras cadastradas, incluindo `BACKUP`.
- O coletor só deve varrer impressoras ativas e com IP, porque backup/devolução não deveriam estar em produção.
- Exemplo real: `116` impressoras cadastradas no inventario, sendo `1` em `BACKUP`, resultam em `115` impressoras coletaveis.
- A lista usada pela Edge `collector-impressoras` vem de `inventario` filtrando `ie_situacao = A` e `nr_ip` preenchido.

## Arquivos relevantes

- coletor-snmp/scripts/run_collector_loop.py
- coletor-snmp/scripts/collector_control_app.py
- coletor-snmp/scripts/test_collector_push.py
- coletor-snmp/utils/cache_manager.py
- coletor-snmp/utils/snmp_client.py
- coletor-snmp/utils/telemetry_mapper.py
- coletor-snmp/utils/api_client.py
- coletor-snmp/utils/runtime_trace.py
- coletor-snmp/data/collector_pending.jsonl
- coletor-snmp/data/collector_pending_invalid.jsonl

## Operacao recomendada

- Rodar em intervalo estavel (ex.: 300s).
- Monitorar crescimento de fila pendente.
- Validar token e conectividade periodicamente.
- Em producao, preferir `COLLECTOR_PRINTERS_SOURCE=api`, chamando a Edge `collector-impressoras`.
- A fonte oficial das impressoras e `public.inventario`; nao existe tabela operacional separada de impressoras no fluxo atual.
- Manter `COLLECTOR_ALLOW_API_FALLBACK=false` para evitar dobrar chamadas quando o Supabase estiver lento.
- Manter `COLLECTOR_SYNC_FAILURE_COOLDOWN=900` para abrir 15 minutos de respiro apos timeouts repetidos.

## Protecao contra sobrecarga

Quando o Supabase responde timeout, o coletor nao deve insistir sem parar. O comportamento seguro e:

1. tentar o sync remoto poucas vezes;
2. registrar erro claro no log;
3. abrir circuito de cooldown;
4. aguardar antes de chamar o backend novamente.

Esse cuidado evita que uma falha temporaria do PostgREST vire uma cascata de requisições em cima do projeto.

## Atualizacao 2026-05-04

- A cada ingestao o coletor grava estado atual em `telemetria_pagecount`.
- Consolidacao diaria (min/max/delta) e feita no banco por trigger.
- Resultado: menor volume de linhas sem perder bilhetagem diaria.

## Check rapido

```powershell
cd coletor-snmp
.venv\Scripts\activate
python scripts\test_collector_push.py
```
