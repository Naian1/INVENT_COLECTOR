# API - inventory-core
> **Leitura guiada para estudo:** este documento foi organizado para explicar o papel do módulo, o fluxo prático que ele executa e onde conferir o comportamento no código. Para estudar, leia primeiro o objetivo, depois acompanhe os arquivos/comandos citados e compare a entrada, o processamento e a saída descritos.

Endpoint:

- POST /functions/v1/inventory-core

Acoes:

- list_context
- list_devolucao
- list_substituicao_pendente
- resolver_substituicao_pendente
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

## Action: list_substituicao_pendente

Lista alertas de substituicao detectados pela telemetria quando o IP respondeu com serie/mac/patrimonio diferente do esperado.

### Request

```json
{
  "action": "list_substituicao_pendente",
  "payload": {
    "somente_pendentes": true,
    "limite": 200
  }
}
```

### Response (resumo)

```json
{
  "ok": true,
  "data": [
    {
      "id": 12,
      "ie_status": "PENDENTE",
      "nr_ocorrencias": 3,
      "ds_motivo": "Numero de serie detectado diferente do numero de serie esperado para o IP",
      "nr_inventario_referencia": 50,
      "setor_referencia_label": "1 Andar - Setor X",
      "referencia": {
        "nr_patrimonio": "293273",
        "nr_serie": "SER-ANTIGA",
        "nr_ip": "10.6.0.50"
      },
      "detectado": {
        "nr_ip": "10.6.0.50",
        "nr_patrimonio": "330731",
        "nr_serie": "SER-NOVA"
      }
    }
  ]
}
```

## Action: resolver_substituicao_pendente

Resolve uma pendencia detectada pela telemetria.

`CONFIRMAR_TROCA`:
- coloca o item detectado como `ATIVO` com o IP da pendencia;
- opcionalmente move o item detectado para o setor da referencia;
- move o item de referencia para `BACKUP` e limpa IP.
- aceita identificar substituto por patrimonio/serie/mac mesmo quando o item detectado estiver em status `BACKUP` (nao exige `ie_situacao = A`).
- reaplica o resumo diario retido da pendencia no item substituto confirmado (`replay_pagecount`).

`DESCARTAR_ALERTA`:
- marca a pendencia como descartada sem mexer no inventario.

`CORRIGIR_DADOS`:
- usado para divergencia cadastral quando o patrimonio confere e apenas um identificador diverge:
  - serie diferente com MAC igual, ou
  - MAC diferente com serie igual.
- atualiza os dados do item de referencia com os identificadores detectados (principalmente `nm_mac`).
- nao executa troca fisica de itens.
- reaplica o resumo diario retido da pendencia no proprio item de referencia.

### Como o replay evita duplicar paginas

- O replay preferencial usa `telemetria_substituicao_evento_retido`, que guarda um resumo por pendencia/dia.
- Durante a pendencia, varias coletas atualizam a mesma linha diaria.
- Na resolucao, o resumo diario e somado ao `telemetria_pagecount_diaria` do inventario correto.
- Exemplo: contador 200 vira base; depois contador 250 soma 50 em `nr_paginas_dia`, nao 450.
- O `telemetria_pagecount` atual sera atualizado normalmente na proxima coleta confirmada, sem precisar gravar linha por ciclo.
- Isso separa corretamente: producao antes da divergencia fica na impressora antiga; producao em quarentena vai para a impressora confirmada ou para a correcao cadastral.
- Se a tabela de fila ainda nao existir, o backend usa fallback pelo ultimo `payload_evento` salvo na pendencia.

### Request (confirmar)

```json
{
  "action": "resolver_substituicao_pendente",
  "payload": {
    "id_pendencia": 12,
    "acao": "CONFIRMAR_TROCA",
    "mover_substituto_para_setor_referencia": true,
    "nr_chamado": "GLPI-789",
    "observacao": "Troca fisica validada em campo"
  }
}
```

### Request (descartar)

```json
{
  "action": "resolver_substituicao_pendente",
  "payload": {
    "id_pendencia": 12,
    "acao": "DESCARTAR_ALERTA",
    "observacao": "Falso positivo apos validacao"
  }
}
```

### Request (corrigir dados)

```json
{
  "action": "resolver_substituicao_pendente",
  "payload": {
    "id_pendencia": 12,
    "acao": "CORRIGIR_DADOS",
    "nr_chamado": "GLPI-999",
    "observacao": "Cadastro corrigido: MAC divergente"
  }
}
```

### Erros comuns

- 400: `id_pendencia` invalido.
- 400: `acao` invalida.
- 400: pendencia ja resolvida.
- 400: nao encontrou substituto por patrimonio/serie/mac no inventario.
- 400: `CORRIGIR_DADOS` usado fora do criterio (patrimonio nao confere ou divergencia de serie/MAC nao e isolada).

## Mapa de codigo (linhas)

- Listagem de pendencias:
  - `inventario-unificado-web/supabase/functions/inventory-core/index.ts:2149`
- Resolucao de pendencias:
  - `inventario-unificado-web/supabase/functions/inventory-core/index.ts:2261`
- Correcao cadastral (`CORRIGIR_DADOS`):
  - `inventario-unificado-web/supabase/functions/inventory-core/index.ts:2362`
- Replay do resumo diario retido:
  - `inventario-unificado-web/supabase/functions/inventory-core/index.ts:1002`
- Aplicacao do resumo retido no diario oficial:
  - `inventario-unificado-web/supabase/functions/inventory-core/index.ts:763`
- Fallback pelo ultimo payload da pendencia:
  - `inventario-unificado-web/supabase/functions/inventory-core/index.ts:960`
- Atualizacao com fallback para ambientes sem `dt_atualizacao`:
  - `inventario-unificado-web/supabase/functions/inventory-core/index.ts:1131`

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

- Retorna inventario, pisos, setores, equipamentos, tipos e empresas ativas.
- Setor retorna `cd_piso` para vinculo com piso.
- Setores sao ordenados por piso, setor e localizacao.

## Action: move_inventario

### Request

```json
{
  "action": "move_inventario",
  "payload": {
    "nr_inventario": 101,
    "cd_setor_destino": 20,
    "tp_status_destino": "ATIVO",
    "ajustar_ip_destino": true,
    "nr_ip_destino": "10.0.0.12",
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
      "tp_status_final": "ATIVO",
      "nr_ip_final": "10.0.0.12",
      "filhos_acompanharam_destino": 1,
      "filhos_movidos_estoque": 1
    }
  }
}
```

### Regra de chamado (importante)

- `nr_chamado` e opcional.
- Se nao for enviado, a movimentacao **nao** herda chamado antigo automaticamente.
- Nesse caso a observacao final fica:
  - `OBS: ...` quando houver observacao manual.
  - ou texto padrao de movimentacao quando chamado e observacao estiverem vazios.
- `tp_status_destino` e opcional (`ATIVO`, `MANUTENCAO`, `BACKUP`, `DEVOLUCAO`).
- `ajustar_ip_destino=true` permite atualizar IP no mesmo fluxo:
  - `nr_ip_destino` preenchido: define novo IP.
  - `nr_ip_destino` vazio/null: limpa IP do item.

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

### Regra de chamado

- `nr_chamado` e opcional para substituicao.
- Se vier vazio, o backend nao reaproveita chamado anterior automaticamente.

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
- chamado nao e herdado automaticamente de movimentacoes anteriores

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
