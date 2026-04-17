# API - inventory-admin

Endpoint:

- POST /functions/v1/inventory-admin

Acoes:

- list
- create_empresa
- update_empresa
- create_tipo
- update_tipo
- create_setor
- update_setor
- create_equipamento
- update_equipamento

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

## Action: create_setor

### Request

```json
{
  "action": "create_setor",
  "payload": {
    "nm_piso": "1o Andar",
    "nm_setor": "SAME",
    "nm_localizacao": "Arquivo",
    "ds_setor": "Setor de arquivo e prontuarios"
  }
}
```

### Regras

- `nm_piso` e `nm_setor` sao obrigatorios.
- `nm_localizacao` e opcional.
- A ordenacao de listagem considera `nm_piso`, depois `nm_setor`, depois `nm_localizacao`.

## Action: update_setor

### Request

```json
{
  "action": "update_setor",
  "payload": {
    "cd_setor": 10,
    "nm_piso": "1o Andar",
    "nm_setor": "SAME",
    "nm_localizacao": "Arquivo",
    "ds_setor": "Setor atualizado"
  }
}
```

### Errors comuns

- 400: `cd_setor, nm_piso e nm_setor sao obrigatorios`
