# API - collector-impressoras

> **Leitura guiada para estudo:** este documento explica como o coletor Python descobre quais impressoras deve consultar na rede. A fonte atual e oficial é `public.inventario`.

## Endpoint

```text
GET /functions/v1/collector-impressoras
```

## Autenticação

```text
Authorization: Bearer <COLLECTOR_API_TOKEN>
```

A função valida o token do coletor antes de consultar o banco. Isso impede que qualquer cliente externo baixe a lista de IPs das impressoras.

## Fonte de dados atual

A Edge Function consulta exclusivamente:

```text
public.inventario
```

A origem deste endpoint é somente `public.inventario`.

## Como reconhece impressoras ativas

A consulta considera somente itens que atendem a estes critérios:

```text
ie_situacao = A
nr_ip preenchido
```

Na prática:

- `ie_situacao = A` indica que o item está ativo no inventário;
- `nr_ip preenchido` indica que o equipamento tem endereço de rede para coleta SNMP;
- itens sem IP não entram na lista do coletor;
- itens em backup, devolução ou manutenção normalmente ficam fora da coleta operacional quando não estão ativos.

## Dados retornados ao coletor

Cada item retornado contém os dados mínimos para o coletor conseguir trabalhar:

```json
{
  "id": "50",
  "ip": "172.18.134.115",
  "patrimonio": "330731",
  "modelo": "XM1246",
  "fabricante": "Lexmark",
  "numero_serie": "701732940Z7PX",
  "hostname": null,
  "setor": "UI Maternidade",
  "localizacao": "UI Maternidade",
  "ativa": true,
  "comunidade": "public"
}
```

## Fluxo interno

1. Recebe `GET` do coletor Python.
2. Valida `COLLECTOR_API_TOKEN` pelo header Authorization.
3. Cria cliente Supabase com `SUPABASE_SERVICE_ROLE_KEY`.
4. Consulta `public.inventario`.
5. Junta dados de modelo/marca pela relação `equipamento:cd_equipamento`.
6. Junta nome do setor pela relação `setor:cd_setor`.
7. Filtra `ie_situacao = A`.
8. Filtra `nr_ip IS NOT NULL`.
9. Normaliza IP e textos.
10. Retorna a lista para o coletor.

## Resposta padrão

```json
{
  "sucesso": true,
  "dados": {
    "total": 1,
    "impressoras": [
      {
        "id": "50",
        "ip": "172.18.134.115",
        "patrimonio": "330731",
        "modelo": "XM1246",
        "fabricante": "Lexmark",
        "numero_serie": "701732940Z7PX",
        "hostname": null,
        "setor": "UI Maternidade",
        "localizacao": "UI Maternidade",
        "ativa": true,
        "comunidade": "public"
      }
    ]
  }
}
```

## Erros comuns

- `401`: token ausente ou inválido.
- `405`: método diferente de `GET`.
- `500`: erro interno ao consultar `public.inventario` ou variáveis de ambiente ausentes.

## Arquivo principal

```text
inventario-unificado-web/supabase/functions/collector-impressoras/index.ts
```
