# 05 - API Overview

Este documento explica as APIs do projeto. No sistema existem duas camadas de API:

1. **Supabase Edge Functions**, que sao o backend serverless principal.
2. **Rotas API do Next.js**, que sao APIs internas do site.

## 1. Supabase Edge Functions

Local:

```text
inventario-unificado-web/supabase/functions/
```

As Edge Functions sao APIs HTTP publicadas no Supabase. Elas aplicam regras de negocio, validam autorizacao e acessam o banco PostgreSQL/Supabase.

Funcoes atuais:

```text
collector-impressoras
collector-telemetria
inventory-core
inventory-print
inventory-admin
inventory-matrix
```

### Papel de Cada Edge Function

| Function | Papel |
| --- | --- |
| `collector-impressoras` | Endpoint protegido para lista de impressoras em cenarios de API do coletor. |
| `collector-telemetria` | Recebe payload do coletor Python com SNMP, pagecount, identidade e suprimentos. |
| `inventory-core` | Regras principais de inventario, movimentacao, pendencias e substituicao assistida. |
| `inventory-print` | Consultas e indicadores da operacao de impressoras, dashboard, suprimentos e telemetria. |
| `inventory-admin` | Administracao de usuarios, perfis e cadastros administrativos. |
| `inventory-matrix` | Fluxos de importacao, matriz, cargas e conciliacao. |

## 2. Rotas API do Next.js

Local:

```text
inventario-unificado-web/app/api/
```

As rotas `app/api` tambem sao APIs HTTP, mas rodam dentro do projeto Next.js. Elas servem como apoio ao frontend e aos services TypeScript.

Exemplos:

```text
/api/auth/me
/api/inventario
/api/impressoras
/api/telemetria/resumo-diario
/api/usuarios
```

Papel delas:

- responder chamadas internas do site;
- consultar services TypeScript;
- apoiar telas especificas;
- encapsular detalhes de leitura ou transformacao;
- manter compatibilidade com fluxos que ainda nao estao 100% em Edge Function.

## 3. Diferenca Pratica

| Pergunta | Edge Function | Rota Next.js `app/api` |
| --- | --- | --- |
| Onde roda? | Supabase | Vercel/Next.js |
| Pasta | `supabase/functions/` | `app/api/` |
| E API? | Sim | Sim |
| Uso principal | Regra critica/backend serverless | API interna do site |
| Exemplo | `inventory-core` | `/api/inventario` |
| Quem chama? | Frontend, coletor ou ferramentas autorizadas | Frontend Next.js |

Frase curta:

```text
Edge Functions sao APIs, mas nao sao as unicas APIs. O projeto tambem tem rotas app/api do Next.js.
```

## 4. Padrao de Chamada das Edge Functions de Inventario

As Edge Functions de inventario normalmente usam envelope com `action`:

- Metodo: `POST`
- Endpoint: `/functions/v1/<nome-da-funcao>`
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

## 5. Excecao das Funcoes do Coletor

As funcoes de coletor usam contrato direto, porque sao chamadas por uma aplicacao Python, nao por uma tela comum.

Endpoints:

```text
collector-impressoras
collector-telemetria
```

Autenticacao:

```text
Authorization: Bearer <COLLECTOR_API_TOKEN>
```

Resposta comum:

```json
{
  "sucesso": true,
  "dados": {}
}
```

## 6. Seguranca

Regras gerais:

- Edge Functions do app web usam JWT de usuario quando exigem sessao.
- Funcoes do coletor usam token proprio do coletor.
- Rotas internas do Next.js devem validar sessao quando retornam dados protegidos.
- Regra critica deve ficar no backend, nao apenas no frontend.

## 7. Documentos Por Function

- [collector-impressoras](collector-impressoras.md)
- [collector-telemetria](collector-telemetria.md)
- [inventory-admin](inventory-admin.md)
- [inventory-core](inventory-core.md)
- [inventory-matrix](inventory-matrix.md)
- [inventory-print](inventory-print.md)

## 8. Relacao Com a Arquitetura

Para entender onde cada API entra no desenho geral, leia tambem:

- [02 - Arquitetura](../02-architecture.md)
- [06 - Coletor Python](../06-collector.md)
- [20 - Guia Integrado TCC](../20-guia-integrado-tcc-impressao-telemetria.md)
