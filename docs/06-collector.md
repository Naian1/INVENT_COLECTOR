# 06 - Collector

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
4. Envia para endpoint de coleta.
5. Se falhar, mantem fila local para reenvio.

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

## Check rapido

```powershell
cd coletor-snmp
.venv\Scripts\activate
python scripts\test_collector_push.py
```
