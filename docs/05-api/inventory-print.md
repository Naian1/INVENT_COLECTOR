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
- A Edge usa `public.inventario` como fonte oficial da visao operacional atual.
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

### Regra atual de status da impressora

Esta regra existe para separar dois cenarios diferentes que antes podiam parecer iguais na tela:

- `online`: a ultima telemetria valida informou que a impressora respondeu normalmente.
- `offline`: o coletor tentou consultar a impressora via SNMP, nao recebeu resposta e enviou status `offline`.
- `unknown`: a impressora ainda nao possui historico confiavel de coleta. Ou seja, nao e uma impressora "offline"; e uma impressora sem base de telemetria para classificar.

Na pratica, quando o log do coletor mostra que a impressora "parece estar offline", a tela `/impressoras` deve exibir `offline`. O status `unknown` fica reservado para equipamentos cadastrados que nunca tiveram coleta gravada.

Os suprimentos continuam sendo exibidos a partir da ultima leitura conhecida. Isso e proposital: se uma impressora respondeu uma vez e depois ficou offline, o sistema ainda pode mostrar o ultimo toner/unidade de imagem conhecido, sem apagar informacao util da operacao.

Na tela, o filtro de status operacional foi simplificado para os estados de telemetria realmente usados no fluxo atual:

- `online`;
- `offline`;
- `unknown`.

O conceito de equipamento nao operacional continua existindo, mas fica no filtro de operacionalidade/inventario, nao como status de telemetria.

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
- 500: erro interno ao consultar `public.inventario` ou tabelas atuais de telemetria

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
