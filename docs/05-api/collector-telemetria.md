# API - collector-telemetria
> **Leitura guiada para estudo:** este documento foi organizado para explicar o papel do módulo, o fluxo prático que ele executa e onde conferir o comportamento no código. Para estudar, leia primeiro o objetivo, depois acompanhe os arquivos/comandos citados e compare a entrada, o processamento e a saída descritos.

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
    "alertas_substituicao_detectados": 0,
    "erros": [],
    "modo_gravacao": {
      "inventario": true,
      "telemetria_pagecount": true,
      "telemetria_pagecount_diaria": true,
      "suprimentos": true,
      "telemetria_substituicao_pendente": true,
      "telemetria_substituicao_evento_retido": true
    }
  }
}
```

Observacao importante:

- As tabelas antigas de telemetria/suprimentos usadas antes da sanitizacao nao fazem parte do schema atual.
- A fonte oficial das impressoras e `public.inventario`.
- O historico de contador usa `public.telemetria_pagecount`.
- O consolidado diario usa `public.telemetria_pagecount_diaria`.
- Os suprimentos atuais usam `public.suprimentos`.

Observacao (2026-05-04):

- Em ambiente atualizado, o contador de paginas e gravado em `telemetria_pagecount` por upsert (`nr_inventario`).
- O historico diario (min/max/delta) e derivado por trigger em `telemetria_pagecount_diaria`.

Observacao (2026-05-06):

- Datas de leitura no banco usam `TIMESTAMPTZ` para evitar deslocamento de fuso no painel.
- No coletor SNMP, quando mais de um OID de contador responde no mesmo ciclo, o seletor prioriza valor valido mais consistente e evita preferir leitura `0` quando existe leitura positiva no mesmo evento.

Observacao (2026-05-14) - Substituicao assistida:

- Quando existir tabela `telemetria_substituicao_pendente`, o collector compara a identidade detectada no IP com a identidade esperada na vaga do inventario.
- Se detectar divergencia relevante (patrimonio/serie/mac), cria/atualiza pendencia para confirmacao manual no `inventory-core`.
- Nessa etapa o collector nao substitui item automaticamente.

Observacao (2026-05-18) - Enriquecimento da pendencia:

- Em divergencias, o backend tenta identificar o item real detectado cruzando `nr_serie`/`nm_mac` no inventario.
- Quando encontra match confiavel, ajusta `nr_patrimonio_detectado` da pendencia para o patrimonio real do item detectado.
- Objetivo: evitar pendencia com patrimonio "herdado da vaga/IP" quando serie e MAC ja apontam para outra impressora.

Observacao (2026-05-19) - Resumo diario de coletas retidas:

- Quando a tabela `telemetria_substituicao_evento_retido` existir, cada coleta bloqueada atualiza um resumo diario da pendencia.
- O collector continua atualizando a pendencia com o ultimo `payload_evento`, mas compacta a producao em uma linha por pendencia/dia.
- O resumo nao grava paginas no inventario enquanto a troca/correcao nao for confirmada.
- Na primeira leitura retida, se a impressora detectada ja existir no inventario por serie/MAC, o collector usa o ultimo `telemetria_pagecount` dela como base inicial.
- Exemplo: substituta estava em 100 paginas e a primeira leitura divergente veio 150; a retencao inicial grava 50 paginas, nao zero.
- Se a substituta nunca teve pagecount salvo, a primeira leitura vira baseline. Exemplo: contador fisico 50000 vira `inicio=50000`, `fim=50000`, `paginas_dia=0`, nunca 50000 paginas produzidas no dia.
- Isso evita flood no banco: varias coletas no mesmo dia atualizam a mesma linha.

## Fluxo de comparacao de identidade

1. Coleta recebe IP + identificadores da impressora (serie/mac/patrimonio).
2. Backend busca o item ativo do inventario para esse IP.
3. Compara esperado x detectado.
4. Se houver divergencia, registra em `telemetria_substituicao_pendente`.
5. Se houver match no inventario por serie/MAC, grava tambem o inventario substituto provavel.
6. Se existir retencao, atualiza o resumo diario em `telemetria_substituicao_evento_retido`.
7. Time resolve manualmente via action `resolver_substituicao_pendente`.
8. O inventory-core reaplica o resumo diario retido no item correto.

## Mapa de codigo (linhas)

- Montagem do payload padrao do coletor:
  - `coletor-snmp/utils/telemetry_mapper.py:208`
- Selecao de contador SNMP por OID/modelo:
  - `coletor-snmp/utils/cache_manager.py:220`
- Envio HTTP com retry e rastreio de tentativas:
  - `coletor-snmp/utils/api_client.py:712`
- Rastros jsonl locais para auditoria:
  - `coletor-snmp/utils/runtime_trace.py:37`
- Painel de execucao real no app desktop:
  - `coletor-snmp/scripts/collector_control_app.py:609`
- Deteccao de alerta de substituicao na ingestao:
  - `inventario-unificado-web/supabase/functions/collector-telemetria/index.ts:1329`
- Comparacao esperado x detectado:
  - `inventario-unificado-web/supabase/functions/collector-telemetria/index.ts:565`
- Enriquecimento do patrimonio detectado por serie/mac:
  - `inventario-unificado-web/supabase/functions/collector-telemetria/index.ts:730`
- Registro da pendencia no banco:
  - `inventario-unificado-web/supabase/functions/collector-telemetria/index.ts:758`
- Retencao de ciclos bloqueados:
  - `inventario-unificado-web/supabase/functions/collector-telemetria/index.ts:870`

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
