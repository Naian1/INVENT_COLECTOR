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
    "erros": [],
    "modo_gravacao": {
      "impressoras": true,
      "telemetria_impressoras": true,
      "leituras_paginas_impressoras": true,
      "suprimentos_impressoras": true,
      "inventario": false,
      "telemetria_pagecount": false,
      "suprimentos": false
    }
  }
}
```

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
