# 17 - Bilhetagem com tarifas por competencia (Supabase)

## Objetivo

Persistir as tarifas mensais enviadas pela locadora e usar essas tarifas no dashboard de bilhetagem.

## Tabela

`public.tarifas_bilhetagem`

Campos principais:
- `competencia_mes`
- `competencia_ano`
- `empresa_locadora`
- `tipo_impressao` (`pb` | `colorida`)
- `valor_pagina`
- `fonte_arquivo`
- `ativo`
- `created_at` (`timestamptz`)
- `updated_at` (`timestamptz`)

## Fonte de schema (2026-05-06)

- O bloco de `tarifas_bilhetagem` foi consolidado no arquivo unico:
  - `inventario-unificado-web/supabase/migrations/SQL Sistema.sql`
- O arquivo avulso `20260505_tarifas_bilhetagem.sql` foi removido.

## API interna

Rota:
- `GET /api/bilhetagem/tarifas?mes=4&ano=2026&empresa=ARKLOK`
- `POST /api/bilhetagem/tarifas`

Payload exemplo (`POST`):

```json
{
  "competencia_mes": 4,
  "competencia_ano": 2026,
  "empresa_locadora": "ARKLOK",
  "fonte_arquivo": "04_2026 - BILHETAGEM.xlsx",
  "substituir_ativos": true,
  "tarifas": {
    "pb": 0.04,
    "colorida": 0.35
  }
}
```

## Dashboard

Formulas:
- `custo_pb = paginas_pb * tarifa_pb`
- `custo_colorida = paginas_coloridas * tarifa_colorida`
- `custo_total = custo_pb + custo_colorida`

Mensagem exibida no frontend:
- `Valores calculados conforme bilhetagem enviada pela locadora.`

## Observacao de dados

No coletor atual, o evento enviado prioriza `contador_total_paginas` (sem separacao nativa de P&B e colorida por contador SNMP dedicado), entao:
- `paginas_pb` usa o total consolidado do periodo.
- `paginas_coloridas` depende da classificacao por modelo no painel.

## Mapa de codigo (linhas)

- Tabela `tarifas_bilhetagem`:
  - `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:2964`
- Indice unico por competencia/empresa/tipo:
  - `inventario-unificado-web/supabase/migrations/SQL Sistema.sql:3007`
- API de consulta e escrita de tarifas:
  - `inventario-unificado-web/app/api/bilhetagem/tarifas/route.ts:27`
  - `inventario-unificado-web/app/api/bilhetagem/tarifas/route.ts:59`
- Regra de selecao de tarifa usada no dashboard:
  - `inventario-unificado-web/services/telemetriaDiariaService.ts:325`
  - `inventario-unificado-web/services/telemetriaDiariaService.ts:386`
- Script para extrair valores da planilha:
  - `inventario-unificado-web/scripts/extractTarifasBilhetagem.mjs:19`
