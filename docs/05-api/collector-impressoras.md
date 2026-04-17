# API - collector-impressoras

Endpoint:

- GET /functions/v1/collector-impressoras

Autenticacao:

- Header obrigatorio: Authorization: Bearer <COLLECTOR_API_TOKEN>

Resposta padrao:

```json
{
  "sucesso": true,
  "dados": {
    "total": 2,
    "impressoras": [
      {
        "id": "uuid-ou-id-legado",
        "ip": "10.6.0.10",
        "patrimonio": "PAT123",
        "modelo": "M3250",
        "setor": "UTI",
        "ativa": true,
        "comunidade": "public"
      }
    ]
  }
}
```

Fonte de dados:

- Prioridade 1: tabela `impressoras` (schema novo)
- Prioridade 2: tabela `inventario` (fallback legado)
- Se nenhuma existir: retorna erro 422

Errors comuns:

- 401: token ausente ou invalido
- 405: metodo diferente de GET
- 422: nenhuma fonte de dados disponivel (`impressoras` ou `inventario`)
- 500: erro interno ao consultar banco
