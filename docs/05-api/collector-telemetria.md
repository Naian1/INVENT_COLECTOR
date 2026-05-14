# API - collector-telemetria

Endpoint:

- POST /functions/v1/collector-telemetria

Autenticacao:

- Header obrigatorio: Authorization: Bearer <COLLECTOR_API_TOKEN>

Contrato:

- Nao usa `action`.
- Aceita lote (`eventos`) ou evento unico no body.

## Payload em lote

```json
{
  "coletor_id": "collector-hgg-01",
  "coletado_em": "2026-04-17T10:00:00Z",
  "eventos": [
    {
      "ingestao_id": "evt-1",
      "coletado_em": "2026-04-17T10:00:00Z",
      "status": "online",
      "tempo_resposta_ms": 120,
      "contador_total_paginas": 150000,
      "impressora": {
        "ip": "10.6.0.10",
        "patrimonio": "PAT123",
        "numero_serie": "SER999",
        "setor": "UTI",
        "modelo": "M3250",
        "ativo": true
      },
      "suprimentos": [
        {
          "chave_suprimento": "toner_preto",
          "nome_suprimento": "Toner Preto",
          "nivel_percentual": 34,
          "status_suprimento": "ok",
          "paginas_restantes": 1200
        }
      ]
    }
  ]
}
```

## Payload evento unico

```json
{
  "coletor_id": "collector-hgg-01",
  "ingestao_id": "evt-1",
  "coletado_em": "2026-04-17T10:00:00Z",
  "status": "online",
  "contador_total_paginas": 150000,
  "impressora": {
    "ip": "10.6.0.10",
    "patrimonio": "PAT123"
  },
  "suprimentos": []
}
```

## Resposta de sucesso

```json
{
  "sucesso": true,
  "dados": {
    "coletor_id": "collector-hgg-01",
    "eventos_recebidos": 1,
    "eventos_processados": 1,
    "gravacoes_telemetria": 1,
    "gravacoes_leituras_paginas": 1,
    "gravacoes_suprimentos": 1,
    "alertas_substituicao_detectados": 0,
    "erros": [],
    "modo_gravacao": {
      "impressoras": true,
      "telemetria_impressoras": true,
      "leituras_paginas_impressoras": true,
      "suprimentos_impressoras": true,
      "inventario": false,
      "telemetria_pagecount": false,
      "suprimentos": false,
      "telemetria_substituicao_pendente": false
    }
  }
}
```

Observacao (2026-05-04):

- Em ambiente atualizado, o contador de paginas e gravado em `telemetria_pagecount` por upsert (`nr_inventario`).
- O historico diario (min/max/delta) e derivado por trigger em `telemetria_pagecount_diaria`.

Observacao (2026-05-06):

- Datas de leitura no banco usam `TIMESTAMPTZ` para evitar deslocamento de fuso no painel.
- No coletor SNMP, quando mais de um OID de contador responde no mesmo ciclo, o seletor prioriza valor valido mais consistente e evita preferir leitura `0` quando existe leitura positiva no mesmo evento.

Observacao (2026-05-14) - Substituicao assistida:

- Quando existir tabela `telemetria_substituicao_pendente`, o collector compara a identidade detectada no IP com a identidade esperada na vaga do inventario.
- Se detectar divergencia relevante (patrimonio/serie/mac), cria/atualiza pendencia para confirmacao manual no `inventory-core`.
- Nessa etapa o collector nao substitui item automaticamente.

## Fluxo de comparacao de identidade

1. Coleta recebe IP + identificadores da impressora (serie/mac/patrimonio).
2. Backend busca o item ativo do inventario para esse IP.
3. Compara esperado x detectado.
4. Se houver divergencia, registra em `telemetria_substituicao_pendente`.
5. Time resolve manualmente via action `resolver_substituicao_pendente`.

## Mapa de codigo (linhas)

- Montagem do payload padrao do coletor:
  - `coletor-snmp/utils/telemetry_mapper.py:208`
- Selecao de contador SNMP por OID/modelo:
  - `coletor-snmp/utils/cache_manager.py:220`
- Envio HTTP com retry e rastreio de tentativas:
  - `coletor-snmp/utils/api_client.py:712`
- Rastros jsonl locais para auditoria:
  - `coletor-snmp/utils/runtime_trace.py:37`
- Painel de execucao real no app desktop:
  - `coletor-snmp/scripts/collector_control_app.py:609`
- Deteccao de alerta de substituicao na ingestao:
  - `inventario-unificado-web/supabase/functions/collector-telemetria/index.ts:1097`
- Comparacao esperado x detectado:
  - `inventario-unificado-web/supabase/functions/collector-telemetria/index.ts:529`
- Registro da pendencia no banco:
  - `inventario-unificado-web/supabase/functions/collector-telemetria/index.ts:582`

## Resposta parcial

Quando parte do lote falha:

- status HTTP 207
- `sucesso: false`
- lista de erros por `ingestao_id`

## Errors comuns

- 400: JSON invalido ou payload invalido
- 401: token ausente ou invalido
- 405: metodo diferente de POST
- 422: nenhum evento processado
- 500: erro interno
