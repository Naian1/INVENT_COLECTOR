# API - inventory-admin

Endpoint:

- POST /functions/v1/inventory-admin

Acoes:

- list
- create_empresa
- create_tipo
- create_setor
- create_equipamento

## Action: list

### Request

```json
{
  "action": "list",
  "payload": {}
}
```

### Response

```json
{
  "ok": true,
  "data": {
    "empresas": [],
    "tipos": [],
    "setores": [],
    "equipamentos": []
  }
}
```

## Action: create_equipamento

### Request

```json
{
  "action": "create_equipamento",
  "payload": {
    "cd_cgc": "00000000000100",
    "cd_tipo_equipamento": 2,
    "nm_equipamento": "Desktop TI",
    "nm_modelo": "OptiPlex",
    "tp_hierarquia": "AMBOS"
  }
}
```

### Response

```json
{
  "ok": true,
  "data": {
    "cd_equipamento": 123,
    "nm_equipamento": "Desktop TI",
    "tp_hierarquia": "AMBOS"
  }
}
```

### Errors comuns

- 400: cd_cgc, cd_tipo_equipamento, nm_equipamento e nm_modelo sao obrigatorios
- 400: tp_hierarquia invalido. Use RAIZ, FILHO ou AMBOS
- 500: erro de persistencia no banco
