# API - inventory-core

Endpoint:

- POST /functions/v1/inventory-core

Acoes:

- list_context
- list_devolucao
- create_inventario
- update_inventario
- move_inventario
- substituir_manutencao
- resolver_manutencao
- matrix_lookup
- matrix_lines
- matrix_conciliacao

## Action: list_devolucao

### Request

```json
{
  "action": "list_devolucao",
  "payload": {}
}
```

### Response (resumo)

```json
{
  "ok": true,
  "data": [
    {
      "nr_inventario": 4,
      "nr_patrimonio": "362687",
      "empresa": "Arklok",
      "nr_chamado": "123",
      "tp_status": "DEVOLUCAO"
    }
  ]
}
```

## Action: create_inventario

### Request

```json
{
  "action": "create_inventario",
  "payload": {
    "cd_equipamento": 123,
    "cd_setor": 10,
    "nr_patrimonio": "PAT123",
    "nr_serie": "SER999",
    "nr_ip": "10.0.0.12",
    "nm_hostname": "CPU-ADM-001",
    "nr_invent_sup": null,
    "tp_status": "ATIVO"
  }
}
```

### Response

```json
{
  "ok": true,
  "data": {
    "nr_inventario": 999,
    "cd_equipamento": 123,
    "cd_setor": 10,
    "tp_status": "ATIVO"
  }
}
```

### Errors comuns

- 400: cd_equipamento e cd_setor sao obrigatorios
- 500: Equipamento do tipo RAIZ nao pode ter item superior vinculado
- 500: Equipamento do tipo FILHO em status ATIVO precisa de item superior
- 500: Item superior e item filho devem estar no mesmo setor

### Regras de hostname

- `nm_hostname` deve ser enviado para equipamentos com hierarquia `RAIZ` ou `AMBOS`.
- Quando o equipamento e `FILHO`, o backend ignora/limpa `nm_hostname`.

## Action: update_inventario

### Request

```json
{
  "action": "update_inventario",
  "payload": {
    "nr_inventario": 999,
    "cd_equipamento": 123,
    "cd_setor": 10,
    "nr_patrimonio": "PAT123",
    "nr_serie": "SER999",
    "nr_ip": "10.0.0.12",
    "nm_hostname": "CPU-ADM-001",
    "nr_invent_sup": null,
    "tp_status": "ATIVO"
  }
}
```

## Action: list_context

### Observacoes

- Retorna inventario, setores, equipamentos, tipos e empresas ativas.
- Setores sao ordenados por `nm_piso`, `nm_setor` e `nm_localizacao`.

## Action: move_inventario

### Request

```json
{
  "action": "move_inventario",
  "payload": {
    "nr_inventario": 101,
    "cd_setor_destino": 20,
    "nr_chamado": "GLPI-123456",
    "observacao": "Mudanca de sala",
    "filhos_acoes": [
      { "nr_inventario_filho": 102, "acao": "ACOMPANHAR_DESTINO" },
      { "nr_inventario_filho": 103, "acao": "MOVER_ESTOQUE" }
    ]
  }
}
```

### Response (resumo)

```json
{
  "ok": true,
  "data": {
    "resumo": {
      "nr_inventario": 101,
      "cd_setor_origem": 10,
      "cd_setor_destino": 20,
      "filhos_acompanharam_destino": 1,
      "filhos_movidos_estoque": 1
    }
  }
}
```

## Action: substituir_manutencao

### Request

```json
{
  "action": "substituir_manutencao",
  "payload": {
    "nr_inventario_manutencao": 101,
    "nr_inventario_substituto": 999,
    "cd_setor_destino": 20,
    "nr_chamado": "GLPI-123456",
    "observacao": "Backup para manter operacao",
    "filhos_acoes": [
      { "nr_inventario_filho": 102, "acao": "ACOMPANHAR_NOVO_PAI" },
      { "nr_inventario_filho": 103, "acao": "PERMANECER_ANTIGO_PENDENTE" },
      { "nr_inventario_filho": 104, "acao": "MOVER_ESTOQUE" }
    ]
  }
}
```

### Response (resumo)

```json
{
  "ok": true,
  "data": {
    "resumo": {
      "nr_inventario_manutencao": 101,
      "nr_inventario_substituto": 999,
      "filhos_acompanharam_novo_pai": 1,
      "filhos_permaneceram_pendentes": 1,
      "filhos_movidos_estoque": 1
    }
  }
}
```

## Action: resolver_manutencao

### Request

```json
{
  "action": "resolver_manutencao",
  "payload": {
    "nr_inventario": 101,
    "tipo_resolucao": "RESOLVIDO",
    "destino_resolucao": "ORIGEM",
    "nr_chamado": "GLPI-123456",
    "observacao": "Retorno apos reparo"
  }
}
```

### Regras

- `tipo_resolucao`: `RESOLVIDO` ou `SEM_RESOLUCAO`
- `destino_resolucao` (quando resolvido): `ORIGEM`, `NOVO_SETOR` ou `ESTOQUE`
- sem resolucao envia para `DEVOLUCAO` e exige chamado valido

## Action: matrix_lookup

### Request

```json
{
  "action": "matrix_lookup",
  "payload": {
    "patrimonio": "PAT123",
    "competencia": "03/2026"
  }
}
```

### Response

```json
{
  "ok": true,
  "data": {
    "encontrado": true,
    "competencia": "03/2026",
    "item": {
      "nr_linha": 18,
      "nr_patrimonio": "PAT123",
      "nr_serie": "SER999"
    }
  }
}
```

## Action: matrix_lines

### Request

```json
{
  "action": "matrix_lines",
  "payload": {
    "competencia": "03/2026",
    "patrimonio": "PAT",
    "pagina": 1,
    "tamanhoPagina": 500
  }
}
```

### Response (resumo)

```json
{
  "ok": true,
  "data": {
    "linhas": [],
    "paginacao": {
      "pagina": 1,
      "tamanhoPagina": 500,
      "total": 1200,
      "totalPaginas": 3
    }
  }
}
```

## Action: matrix_conciliacao

### Request

```json
{
  "action": "matrix_conciliacao",
  "payload": {
    "competencia": "03/2026",
    "limite": 1000
  }
}
```

### Response (resumo)

```json
{
  "ok": true,
  "data": {
    "resumo": {
      "totalInventario": 900,
      "totalConsolidado": 950,
      "duplicidadesInventario": 2,
      "duplicidadesConsolidado": 3
    },
    "divergencias": {
      "consolidadoNaoNoInventario": [],
      "inventarioNaoNoConsolidado": []
    }
  }
}
```
