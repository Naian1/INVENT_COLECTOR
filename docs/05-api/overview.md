# 05 - API Overview

## Padrao de chamada

As Edge Functions usam envelope unico:

- Metodo: POST
- Endpoint: /functions/v1/<nome-da-funcao>
- Body:

```json
{
  "action": "nome_da_acao",
  "payload": {}
}
```

Resposta padrao:

```json
{
  "ok": true,
  "data": {}
}
```

Erro padrao:

```json
{
  "ok": false,
  "error": "mensagem"
}
```

## Excecao do coletor

As funcoes de coletor usam contrato direto (sem campo `action`):

- `collector-impressoras` (GET)
- `collector-telemetria` (POST)

Ambas exigem header `Authorization: Bearer <COLLECTOR_API_TOKEN>` e retornam envelope:

```json
{
  "sucesso": true,
  "dados": {}
}
```

## Funcoes documentadas

- [collector-impressoras](collector-impressoras.md)
- [collector-telemetria](collector-telemetria.md)
- [inventory-admin](inventory-admin.md)
- [inventory-core](inventory-core.md)
- [inventory-matrix](inventory-matrix.md)
- [inventory-print](inventory-print.md)

## Contratos transversais

- Requisicoes invalidas retornam 400.
- Metodo diferente de POST retorna 405.
- Erros internos retornam 500.
- CORS habilitado para consumo web.

## Compatibilidade legada

Rotas Next ainda existentes para coletor:

- GET /api/coletor/impressoras
- POST /api/coletor/telemetria

Essas rotas devem convergir para Edge conforme plano em [02-architecture](../02-architecture.md#migracao-de-legado-para-edge-functions).
