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

## 1.1. Detalhamento das Edge Functions

Esta secao explica, em linguagem de estudo, o que cada Edge Function faz e como ela faz.

### `collector-impressoras`

Local do codigo:

```text
inventario-unificado-web/supabase/functions/collector-impressoras/index.ts
```

Quem chama:

- coletor Python, principalmente quando precisa baixar uma lista de impressoras por endpoint protegido.

Autenticacao:

```text
Authorization: Bearer <COLLECTOR_API_TOKEN>
```

O que faz:

- devolve ao coletor a lista oficial de impressoras que podem ser consultadas na rede;
- usa `public.inventario` como fonte oficial;
- considera somente itens ativos e com IP preenchido;
- entrega IP, patrimonio, serie, modelo, fabricante, setor, localizacao e comunidade SNMP.

Como faz, passo a passo:

1. Recebe uma requisicao `GET`.
2. Responde `OPTIONS` para CORS quando necessario.
3. Rejeita metodo diferente de `GET`.
4. Le `COLLECTOR_API_TOKEN` do ambiente.
5. Extrai o token do header `Authorization`.
6. Compara token recebido com token esperado.
7. Cria cliente Supabase com `SUPABASE_SERVICE_ROLE_KEY`.
8. Consulta `public.inventario`.
9. Filtra `ie_situacao = A` e `nr_ip` preenchido.
10. Normaliza IP e textos.
11. Retorna JSON com `total` e `impressoras`.

Tabelas usadas:

```text
public.inventario
public.equipamento
public.setor
```

Resumo de apresentacao:

```text
Essa Function entrega ao coletor a lista do que deve ser varrido via SNMP.
```

### `collector-telemetria`

Local do codigo:

```text
inventario-unificado-web/supabase/functions/collector-telemetria/index.ts
```

Quem chama:

- coletor Python depois de consultar as impressoras via SNMP.

Autenticacao:

```text
Authorization: Bearer <COLLECTOR_API_TOKEN>
```

O que faz:

- recebe o payload JSON de telemetria;
- normaliza dados da impressora;
- valida contador, status, serie, MAC, patrimonio e suprimentos;
- compara a identidade detectada com `public.inventario`;
- grava pagecount e suprimentos quando a identidade esta correta;
- cria pendencia quando existe divergencia de IP, serie, MAC ou patrimonio;
- segura pagecount suspeito para nao poluir o item errado;
- resume dados retidos por dia em `telemetria_substituicao_evento_retido`.

Como faz, passo a passo:

1. Recebe uma requisicao `POST`.
2. Valida token do coletor.
3. Le e valida o JSON recebido.
4. Aceita lote com `eventos` ou evento unico.
5. Normaliza campos de texto, IP, MAC, status e numeros.
6. Resolve qual item do inventario corresponde ao evento.
7. Busca o item ativo esperado para o IP detectado.
8. Compara identidade esperada com identidade detectada.
9. Se estiver tudo consistente, grava `telemetria_pagecount`.
10. A trigger SQL atualiza `telemetria_pagecount_diaria`.
11. Grava ou atualiza `suprimentos`.
12. Se houver divergencia, cria/atualiza `telemetria_substituicao_pendente`.
13. Se houver contador durante a pendencia, resume em `telemetria_substituicao_evento_retido`.
14. Retorna um relatorio do lote com processados, bloqueios e erros.

Tabelas usadas:

```text
public.inventario
public.telemetria_pagecount
public.telemetria_substituicao_pendente
public.telemetria_substituicao_evento_retido
public.suprimentos
```

Resumo de apresentacao:

```text
Essa Function e a porta de entrada da telemetria. Ela decide se a coleta pode virar dado oficial ou se deve virar alerta de troca/cadastro errado.
```

### `inventory-core`

Local do codigo:

```text
inventario-unificado-web/supabase/functions/inventory-core/index.ts
```

Quem chama:

- frontend Next.js em telas de inventario, devolucao, pendencias, movimentacao e conciliacao;
- em alguns casos, telas que precisam alterar dados oficiais do inventario.

Autenticacao:

- JWT do usuario logado no Supabase Auth;
- resolve o usuario em `public.usuario`;
- usa o ator real para auditoria/movimentacao.

O que faz:

- lista contexto do inventario;
- lista itens em devolucao;
- lista pendencias de substituicao detectadas pela telemetria;
- resolve pendencias de troca, correcao ou descarte;
- cria e atualiza itens do inventario;
- movimenta equipamentos entre setores/status;
- executa substituicao assistida de equipamento em manutencao;
- resolve manutencao;
- apoia consultas de matriz/conciliacao.

Actions principais:

```text
list_context
list_devolucao
list_substituicao_pendente
resolver_substituicao_pendente
create_inventario
update_inventario
move_inventario
substituir_manutencao
resolver_manutencao
matrix_lookup
matrix_lines
matrix_conciliacao
```

Como faz, passo a passo:

1. Recebe `POST` com `action` e `payload`.
2. Valida o JWT do usuario.
3. Busca o usuario ativo em `public.usuario`.
4. Cria cliente Supabase administrativo para aplicar a regra.
5. Escolhe o bloco de codigo conforme `action`.
6. Valida campos obrigatorios do payload.
7. Consulta tabelas de apoio, como setor, equipamento, piso e empresa.
8. Aplica regras de status, hierarquia e movimentacao.
9. Grava em `public.inventario` quando a acao altera cadastro.
10. Registra movimentacao em `public.movimentacao` quando ha mudanca operacional.
11. Em pendencias, atualiza `telemetria_substituicao_pendente` e aplica dados retidos quando permitido.
12. Retorna JSON padronizado `{ ok, data }` ou `{ ok, error }`.

Tabelas usadas:

```text
public.inventario
public.movimentacao
public.equipamento
public.empresa
public.piso
public.setor
public.vw_setor
public.tipo_equipamento
public.usuario
public.telemetria_pagecount
public.telemetria_pagecount_diaria
public.telemetria_substituicao_pendente
public.telemetria_substituicao_evento_retido
public.inventario_consolidado_carga
public.inventario_consolidado_linha
```

Resumo de apresentacao:

```text
Essa Function e o nucleo do inventario. Ela concentra as alteracoes oficiais e evita que a tela grave regra critica diretamente no banco.
```

### `inventory-print`

Local do codigo:

```text
inventario-unificado-web/supabase/functions/inventory-print/index.ts
```

Quem chama:

- tela de impressoras;
- dashboard operacional;
- telas que precisam de visao geral, suprimentos ou indicadores de impressao.

Autenticacao:

- chamada via cliente Supabase/Edge Function;
- deve ser chamada com sessao valida quando usada pelo frontend protegido.

O que faz:

- monta a visao operacional de impressoras;
- calcula status `online`, `offline` ou `unknown` com base na telemetria;
- agrupa suprimentos por impressora;
- monta indicadores do dashboard;
- calcula ranking por periodo, setor, localizacao e modelo;
- consulta pagecount consolidado;
- apoia telas de categorias/linhas de impressora quando usadas.

Regra importante de status:

- `online` significa que a ultima coleta indicou resposta normal da impressora.
- `offline` significa que o coletor tentou consultar o IP via SNMP e registrou falha de resposta.
- `unknown` significa que ainda nao existe historico de coleta suficiente para classificar a impressora.

Assim, impressora sem resposta SNMP nao fica como `unknown`; ela fica como `offline`. O `unknown` e reservado para equipamento sem coleta anterior.

Actions principais:

```text
visao_geral
categorias_opcoes
categorias_linhas
linha_valores
add_impressora_manual
tornar_operacional_linha
sincronizar_operacionais_lote
dashboard_analitico
```

Como faz, passo a passo:

1. Recebe `POST` com `action` e `payload`.
2. Cria cliente Supabase administrativo.
3. Valida action obrigatoria.
4. Para `visao_geral`, busca impressoras no inventario e junta telemetria/suprimentos.
5. Para dashboard, aplica periodo, filtros de setor/localizacao e limite historico.
6. Le contadores em `telemetria_pagecount` e/ou consolidado diario.
7. Calcula deltas por periodo, rankings e totais.
8. Classifica suprimentos por nivel percentual.
9. Monta resposta pronta para o frontend renderizar cards, tabelas e graficos.

Tabelas usadas:

```text
public.inventario
public.telemetria_pagecount
public.suprimentos
```

Observacao:

- o codigo tambem possui verificacoes defensivas para estruturas antigas de telemetria/categorias quando algum ambiente legado ainda existe;
- no banco atual de producao, a fonte principal operacional e `public.inventario`, `telemetria_pagecount` e `suprimentos`.

Resumo de apresentacao:

```text
Essa Function transforma dados brutos/consolidados de impressoras em informacao pronta para painel, filtros, alertas e graficos.
```

### `inventory-admin`

Local do codigo:

```text
inventario-unificado-web/supabase/functions/inventory-admin/index.ts
```

Quem chama:

- telas administrativas de usuarios/cadastros base;
- fluxos que precisam gerenciar piso, setor, empresa, tipo e equipamento.

Autenticacao:

- JWT do usuario logado;
- valida usuario ativo em `public.usuario`;
- confere perfil `ADMIN` em `public.usuario_perfil`/`public.perfil`;
- bloqueia usuario sem perfil administrativo.

O que faz:

- lista cadastros administrativos;
- cria e atualiza pisos;
- cria e atualiza empresas;
- cria e atualiza tipos de equipamento;
- cria e atualiza setores/localizacoes;
- cria e atualiza modelos/equipamentos.

Actions principais:

```text
list
create_piso
update_piso
create_empresa
update_empresa
create_tipo
update_tipo
create_setor
update_setor
create_equipamento
update_equipamento
```

Como faz, passo a passo:

1. Recebe `POST` com `action` e `payload`.
2. Valida JWT do usuario.
3. Busca usuario ativo.
4. Verifica se o usuario e ADMIN.
5. Para `list`, carrega cadastros em paralelo.
6. Para criacao/edicao, valida campos obrigatorios.
7. Grava nas tabelas correspondentes.
8. Em setores, pode resolver/criar piso por nome quando necessario.
9. Retorna o registro criado/atualizado.

Tabelas usadas:

```text
public.piso
public.empresa
public.tipo_equipamento
public.setor
public.vw_setor
public.equipamento
public.usuario
public.usuario_perfil
public.perfil
```

Resumo de apresentacao:

```text
Essa Function administra os cadastros base que sustentam o inventario.
```

### `inventory-matrix`

Local do codigo:

```text
inventario-unificado-web/supabase/functions/inventory-matrix/index.ts
```

Quem chama:

- tela/rotina de importacao de planilha Matrix;
- fluxo de carga mensal por empresa/competencia.

Autenticacao:

- chamada como Edge Function do sistema;
- usa service role no backend para gravar carga e linhas consolidadas.

O que faz:

- inicia uma carga de inventario consolidado;
- apaga carga anterior da mesma empresa/competencia quando necessario;
- insere linhas da planilha em lotes;
- finaliza a carga contando quantas linhas foram inseridas.

Actions principais:

```text
start
append
finish
```

Como faz, passo a passo:

1. `start`: recebe competencia, empresa, nome do arquivo e total de linhas.
2. Valida competencia no formato `MM/AAAA`.
3. Valida se a empresa existe e esta ativa.
4. Remove carga anterior da mesma empresa/competencia para evitar duplicidade.
5. Cria nova linha em `inventario_consolidado_carga`.
6. `append`: recebe `nr_carga` e um lote de linhas.
7. Sanitiza cada linha da planilha.
8. Insere em `inventario_consolidado_linha`.
9. `finish`: conta quantas linhas foram gravadas para aquela carga.
10. Retorna resumo da importacao.

Tabelas usadas:

```text
public.empresa
public.inventario_consolidado_carga
public.inventario_consolidado_linha
```

Resumo de apresentacao:

```text
Essa Function e a esteira de entrada da planilha Matrix: abre carga, grava linhas e fecha com contagem.
```

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
