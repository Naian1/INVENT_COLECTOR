# API - inventory-print
> **Leitura guiada para estudo:** este documento foi organizado para explicar o papel do módulo, o fluxo prático que ele executa e onde conferir o comportamento no código. Para estudar, leia primeiro o objetivo, depois acompanhe os arquivos/comandos citados e compare a entrada, o processamento e a saída descritos.

Endpoint:

- POST /functions/v1/inventory-print

Acoes:

- visao_geral
- categorias_opcoes
- categorias_linhas
- linha_valores
- add_impressora_manual
- tornar_operacional_linha
- sincronizar_operacionais_lote
- dashboard_analitico

## Action: visao_geral

### Como a tela conta impressoras

- No schema atual de produção, a fonte oficial é `inventario`, usando itens do tipo impressora.
- A tela operacional e o coletor contam somente impressoras ativas e com IP. Por isso, se existem `116` impressoras no inventário mas `1` está em `BACKUP`, o total operacional/coletável fica `115`.
- A Edge ainda tem compatibilidade defensiva para ambientes antigos que tinham tabela `impressoras`, mas quando essa tabela não existe ela segue direto pelo `inventario`.
- Código principal: `inventario-unificado-web/supabase/functions/inventory-print/index.ts`, funções `loadVisaoGeral` e `loadOperacionaisViaInventario`.

### Request

```json
{
  "action": "visao_geral",
  "payload": {
    "incluir_nao_operacionais": true
  }
}
```

### Response (resumo)

```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "patrimonio": "PAT123",
      "ip": "10.0.0.40",
      "status_atual": "online",
      "menor_nivel_suprimento": 34,
      "resumo_suprimentos": [
        {
          "nome_suprimento": "Cartucho Preto",
          "nivel_percentual": 34,
          "quantidade_atual": 34,
          "status_suprimento": "ok"
        }
      ],
      "operacional": true
    }
  ]
}
```

### Observacao de compatibilidade

- Quando `nr_quantidade_maxima` existe, o percentual e calculado por `nr_quantidade / nr_quantidade_maxima`.
- Quando `nr_quantidade_maxima` esta nulo e `nr_quantidade` vem entre 0 e 100, o sistema trata `nr_quantidade` como percentual legado.

## Action: add_impressora_manual

### Request

```json
{
  "action": "add_impressora_manual",
  "payload": {
    "patrimonio": "PAT999",
    "ip": "10.0.0.99",
    "setor": "UTI",
    "modelo": "HP LaserJet"
  }
}
```

### Response

```json
{
  "ok": true,
  "data": {
    "acao": "criado",
    "data": {
      "id": "uuid"
    }
  }
}
```

## Action: tornar_operacional_linha

### Request

```json
{
  "action": "tornar_operacional_linha",
  "payload": {
    "linha_id": "uuid-da-linha"
  }
}
```

### Errors comuns

- 400: linha_id e obrigatorio
- 500: Linha sem patrimonio/IP de impressora para sincronizar
- 500: Tabela impressoras nao existe no schema atual

## Action: dashboard_analitico

### Request

```json
{
  "action": "dashboard_analitico",
  "payload": {
    "dias": 30,
    "agrupamento": "dia",
    "setor": "UTI"
  }
}
```

## Atualizacao 2026-05-04

- O dashboard de paginas passou a consumir consolidacao diaria por patrimonio quando disponivel.
- Fonte primaria: `telemetria_pagecount_diaria`.
- Fallback de compatibilidade: agregacao sobre `telemetria_pagecount` legado.

### Response (resumo)

```json
{
  "ok": true,
  "data": {
    "resumo": {
      "online": 10,
      "offline": 2,
      "suprimentos_criticos": 1,
      "suprimentos_baixos": 2
    },
    "paginas_por_periodo": [],
    "suprimentos_delicados": []
  }
}
```
