# API - inventory-matrix

Endpoint:

- POST /functions/v1/inventory-matrix

Acoes:

- start
- append
- finish

## Fluxo recomendado

1. start
2. append (uma ou mais chamadas)
3. finish

## Action: start

### Request

```json
{
  "action": "start",
  "competencia": "03/2026",
  "arquivo_nome": "matrix-marco.xlsx",
  "total_linhas": 2400
}
```

### Response

```json
{
  "ok": true,
  "data": {
    "nr_carga": 77
  }
}
```

### Errors comuns

- 400: Competencia invalida. Use MM/AAAA

## Action: append

### Request

```json
{
  "action": "append",
  "nr_carga": 77,
  "rows": [
    {
      "nr_linha": 1,
      "nr_patrimonio": "PAT123",
      "nr_serie": "SER999",
      "tp_status": "ATIVO"
    }
  ]
}
```

### Response

```json
{
  "ok": true,
  "data": {
    "inserted": 1
  }
}
```

### Errors comuns

- 400: nr_carga invalido
- 400: rows vazio
- 400: Nenhuma linha valida para inserir

## Action: finish

### Request

```json
{
  "action": "finish",
  "nr_carga": 77
}
```

### Response

```json
{
  "ok": true,
  "data": {
    "nr_carga": 77,
    "total_linhas_inseridas": 2400
  }
}
```
