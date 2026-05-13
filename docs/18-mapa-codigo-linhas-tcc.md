# 18 - Mapa de codigo por linhas (TCC)

## Objetivo

Guia rapido para localizar no codigo onde cada regra importante acontece.

## Coletor SNMP e envio

- Normalizacao do payload enviado pelo coletor:
  - `coletor-snmp/utils/telemetry_mapper.py:260` (`build_collector_payload`)
- Selecao de contador de paginas por familia/OID:
  - `coletor-snmp/utils/cache_manager.py:227` (`_resolve_page_counter`)
- Rastro local de eventos (jsonl para auditoria):
  - `coletor-snmp/utils/runtime_trace.py:49` (`append_backend_trace`)
- Leitura SNMP GET com trace:
  - `coletor-snmp/utils/snmp_client.py:134` (`snmp_get`)
- Leitura SNMP WALK com trace:
  - `coletor-snmp/utils/snmp_client.py:222` (`snmp_walk`)
- Envio do payload para API com retry e fila de falha:
  - `coletor-snmp/utils/api_client.py:809` (`send_telemetry_payload`)
- Painel "Backend ao vivo" no app desktop:
  - `coletor-snmp/scripts/collector_control_app.py:674` (`_format_payload_for_panel`)
  - `coletor-snmp/scripts/collector_control_app.py:756` (`build_backend_panel_snapshot`)

## API e agregacao diaria

- Endpoint do resumo diario (query params + auth):
  - `inventario-unificado-web/app/api/telemetria/resumo-diario/route.ts:17` (`GET`)
- Carregamento do consolidado diario (com fallback legado):
  - `inventario-unificado-web/services/telemetriaDiariaService.ts:595` (`loadDailyRows`)
- Delta de paginas por dia:
  - `inventario-unificado-web/services/telemetriaDiariaService.ts:391` (`dailyPages`)
- Regra de selecao de tarifas por competencia/empresa:
  - `inventario-unificado-web/services/telemetriaDiariaService.ts:469` (`chooseTarifasFromRows`)
- Busca de tarifas com fallback:
  - `inventario-unificado-web/services/telemetriaDiariaService.ts:537` (`loadTarifasBilhetagem`)
- Montagem final do resumo para frontend:
  - `inventario-unificado-web/services/telemetriaDiariaService.ts:927` (`buscarResumoTelemetriaDiaria`)

## Bilhetagem e utilitarios

- API de tarifas (GET/POST):
  - `inventario-unificado-web/app/api/bilhetagem/tarifas/route.ts:52` (`GET`)
  - `inventario-unificado-web/app/api/bilhetagem/tarifas/route.ts:91` (`POST`)
- Script de extracao da planilha de tarifas:
  - `inventario-unificado-web/scripts/extractTarifasBilhetagem.mjs:44` (`findTarifas`)
  - `inventario-unificado-web/scripts/extractTarifasBilhetagem.mjs:78` (`main`)

## Frontend do dashboard

- Construcao das coordenadas do grafico de paginas:
  - `inventario-unificado-web/components/ResumoTelemetriaDiaria.tsx:252` (`buildChart`)
- Calculo de tendencia do painel:
  - `inventario-unificado-web/components/ResumoTelemetriaDiaria.tsx:323` (`buildTrend`)

## Banco de dados (SQL consolidado)

- Tabela diaria consolidada:
  - `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:2813`
- Funcao de sincronizacao diaria:
  - `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:2920`
- Trigger de sincronizacao diaria:
  - `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:3005`
- Tabela de tarifas de bilhetagem:
  - `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:3061`
- Indice unico de competencia + empresa + tipo:
  - `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:3104`
