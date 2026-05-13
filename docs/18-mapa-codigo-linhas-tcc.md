# 18 - Mapa de codigo por linhas (TCC)

## Objetivo

Guia rapido para localizar no codigo onde cada regra importante acontece.

## Coletor SNMP e envio

- Normalizacao do payload enviado pelo coletor:
  - `coletor-snmp/utils/telemetry_mapper.py:208` (`build_collector_payload`)
- Selecao de contador de paginas por familia/OID:
  - `coletor-snmp/utils/cache_manager.py:220` (`_resolve_page_counter`)
- Rastro local de eventos (jsonl para auditoria):
  - `coletor-snmp/utils/runtime_trace.py:37` (`append_backend_trace`)
- Leitura SNMP GET com trace:
  - `coletor-snmp/utils/snmp_client.py:127` (`snmp_get`)
- Leitura SNMP WALK com trace:
  - `coletor-snmp/utils/snmp_client.py:215` (`snmp_walk`)
- Envio do payload para API com retry e fila de falha:
  - `coletor-snmp/utils/api_client.py:712` (`send_telemetry_payload`)
- Painel "Backend ao vivo" no app desktop:
  - `coletor-snmp/scripts/collector_control_app.py:537` (`_format_payload_for_panel`)
  - `coletor-snmp/scripts/collector_control_app.py:609` (`build_backend_panel_snapshot`)

## API e agregacao diaria

- Endpoint do resumo diario (query params + auth):
  - `inventario-unificado-web/app/api/telemetria/resumo-diario/route.ts:6` (`GET`)
- Carregamento do consolidado diario (com fallback legado):
  - `inventario-unificado-web/services/telemetriaDiariaService.ts:437` (`loadDailyRows`)
- Delta de paginas por dia:
  - `inventario-unificado-web/services/telemetriaDiariaService.ts:275` (`dailyPages`)
- Regra de selecao de tarifas por competencia/empresa:
  - `inventario-unificado-web/services/telemetriaDiariaService.ts:325` (`chooseTarifasFromRows`)
- Busca de tarifas com fallback:
  - `inventario-unificado-web/services/telemetriaDiariaService.ts:386` (`loadTarifasBilhetagem`)
- Montagem final do resumo para frontend:
  - `inventario-unificado-web/services/telemetriaDiariaService.ts:727` (`buscarResumoTelemetriaDiaria`)

## Bilhetagem e utilitarios

- API de tarifas (GET/POST):
  - `inventario-unificado-web/app/api/bilhetagem/tarifas/route.ts:27` (`GET`)
  - `inventario-unificado-web/app/api/bilhetagem/tarifas/route.ts:59` (`POST`)
- Script de extracao da planilha de tarifas:
  - `inventario-unificado-web/scripts/extractTarifasBilhetagem.mjs:19` (`findTarifas`)
  - `inventario-unificado-web/scripts/extractTarifasBilhetagem.mjs:39` (`main`)

## Frontend do dashboard

- Construcao das coordenadas do grafico de paginas:
  - `inventario-unificado-web/components/ResumoTelemetriaDiaria.tsx:185` (`buildChart`)
- Calculo de tendencia do painel:
  - `inventario-unificado-web/components/ResumoTelemetriaDiaria.tsx:383` (`trendPaginasHoje`)

## Banco de dados (SQL consolidado)

- Tabela diaria consolidada:
  - `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:2731`
- Funcao de sincronizacao diaria:
  - `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:2833`
- Trigger de sincronizacao diaria:
  - `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:2918`
- Tabela de tarifas de bilhetagem:
  - `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:2964`
- Indice unico de competencia + empresa + tipo:
  - `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:3007`
