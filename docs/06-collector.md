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
- coletor-snmp/scripts/test_collector_push.py
- coletor-snmp/data/collector_pending.jsonl
- coletor-snmp/data/collector_pending_invalid.jsonl

## Operacao recomendada

- Rodar em intervalo estavel (ex.: 300s).
- Monitorar crescimento de fila pendente.
- Validar token e conectividade periodicamente.
- Em producao, preferir `COLLECTOR_PRINTERS_SOURCE=supabase` para reduzir dependencia/latencia do frontend (Vercel).
- Se usar source `supabase`, configurar:
  - `COLLECTOR_SUPABASE_URL`
  - `COLLECTOR_SUPABASE_KEY`
  - `COLLECTOR_SUPABASE_PRINTERS_TABLE` (`impressoras` ou `inventario`)

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
