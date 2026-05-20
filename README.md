# INVENT_COLECTOR

Sistema de inventario unificado e operacao de impressoras para ambiente hospitalar. O projeto junta tres mundos que antes ficavam separados: inventario patrimonial, coleta SNMP das impressoras e analise operacional de impressao/suprimentos.

## Visao Geral

O sistema foi desenhado para responder perguntas praticas da TI:

- Onde esta cada equipamento?
- Qual patrimonio, serie, IP e MAC de cada impressora?
- Qual impressora esta online, com suprimento baixo ou critico?
- Quanto foi impresso por dia, por modelo e por setor?
- O que acontece quando uma impressora reserva entra no lugar de outra?
- Como evitar que uma troca fisica jogue o contador historico inteiro no volume diario?

A parte principal para apresentacao do TCC e o modulo de impressoras/telemetria, porque ele integra hardware real, rede, coletor Python, Edge Functions, banco Supabase, triggers SQL e interface web.

## Modulos do Sistema

### 1. Inventario Web

Local principal: `inventario-unificado-web/`

Responsabilidade:

- Cadastrar e consultar equipamentos.
- Organizar equipamentos por piso, setor e localizacao.
- Controlar status como `ATIVO`, `MANUTENCAO`, `BACKUP` e `DEVOLUCAO`.
- Exibir pendencias de substituicao detectadas pela telemetria.
- Permitir confirmacao, descarte ou correcao de dados quando a telemetria aponta divergencia.

Arquivos importantes:

- `app/inventario/page.tsx`: tela principal do inventario.
- `app/impressoras/page.tsx`: tela operacional de impressoras.
- `components/BasicPageShell.tsx`: estrutura geral, menu lateral, tema e notificacoes.
- `services/telemetriaDiariaService.ts`: consolida e interpreta pagecount diario.

### 2. Coletor SNMP

Local principal: `coletor-snmp/`

Responsabilidade:

- Buscar lista de impressoras ativas no Supabase.
- Coletar dados reais via SNMP.
- Capturar identidade fisica: IP, patrimonio informado, numero de serie, MAC e hostname.
- Capturar contador total de paginas.
- Capturar suprimentos como cartucho, kit de manutencao e unidade de imagem.
- Montar payload normalizado e enviar para a Edge Function de telemetria.

Arquivos importantes:

- `scripts/run_collector_loop.py`: executa o coletor em ciclo continuo.
- `utils/cache_manager.py`: coleta SNMP, resolve identidade, pagecount e suprimentos.
- `utils/telemetry_mapper.py`: transforma snapshot bruto em payload da API.
- `utils/api_client.py`: comunica com Supabase/Edge Functions e sincroniza impressoras.
- `utils/snmp_client.py`: funcoes SNMP de baixo nivel.

### 3. Edge Functions Supabase

Local principal: `inventario-unificado-web/supabase/functions/`

Responsabilidade:

- Receber dados do coletor.
- Validar token do coletor.
- Comparar identidade detectada contra inventario.
- Gravar pagecount e suprimentos quando esta tudo confiavel.
- Criar pendencia quando IP responde com serie/MAC/patrimonio diferente.
- Reter producao diaria enquanto a pendencia esta aberta, sem floodar o banco.
- Expor dados para o front de inventario, impressoras e dashboards.

Funcoes principais:

- `collector-impressoras`: fornece a lista de impressoras elegiveis ao coletor.
- `collector-telemetria`: recebe eventos SNMP, valida identidade, grava telemetria e cria pendencias.
- `inventory-core`: controla inventario, movimentacoes, substituicoes, pendencias e replay de pagecount retido.
- `inventory-print`: fornece visao operacional de impressoras, suprimentos, pagecount e dashboard.

### 4. Banco Supabase/PostgreSQL

Arquivo principal de referencia: `inventario-unificado-web/supabase/migrations/SQL Sistema.sql`

Tabelas centrais:

- `inventario`: cadastro unico de equipamentos.
- `piso`, `setor`: hierarquia fisica do hospital.
- `equipamento`: modelo/tipo tecnico do equipamento.
- `movimentacao`: historico de mudancas de local/status.
- `empresa`: empresas usadas em devolucao/importacao.
- `suprimentos`: estado atual de toner/kit/unidade de imagem.
- `telemetria_pagecount`: ultimo contador total conhecido por inventario.
- `telemetria_pagecount_diaria`: consolidado diario por inventario.
- `telemetria_substituicao_pendente`: alerta de divergencia de identidade.
- `telemetria_substituicao_evento_retido`: consolidado diario temporario enquanto uma pendencia aguarda decisao.

## Fluxo Principal de Telemetria

1. O coletor sincroniza impressoras ativas pelo endpoint `collector-impressoras`.
2. Para cada IP, o coletor faz leituras SNMP.
3. O coletor monta um evento com identidade, contador e suprimentos.
4. O evento chega em `collector-telemetria`.
5. A Edge procura no `inventario` qual item deveria estar naquele IP.
6. Se patrimonio/serie/MAC batem, a telemetria e confiavel e grava:
   - `telemetria_pagecount`
   - `telemetria_pagecount_diaria`
   - `suprimentos`
7. Se algum identificador forte diverge, o sistema cria uma pendencia em `telemetria_substituicao_pendente`.
8. Enquanto a pendencia esta aberta, o sistema nao grava pagecount no inventario errado.
9. A producao fica retida por dia em `telemetria_substituicao_evento_retido`.
10. Quando o usuario confirma/corrige/descarta, `inventory-core` resolve a pendencia e aplica a regra correta.

## Fluxo de Troca Assistida de Impressora

Cenario: uma impressora quebra e uma reserva assume o mesmo IP.

O problema tecnico e que impressoras possuem contador fisico historico. Uma impressora reserva pode ja ter 500.000 paginas no proprio contador interno. Se o sistema simplesmente somasse isso no dia da troca, o dashboard mostraria uma explosao falsa.

Regra adotada:

- A primeira leitura suspeita nao e gravada diretamente no pagecount oficial.
- O sistema cria pendencia de substituicao.
- A producao enquanto a pendencia esta aberta e consolidada por dia, nao por ciclo.
- Se a troca for confirmada, o sistema aplica apenas delta seguro.
- Se for erro cadastral, o usuario pode corrigir dados de serie/MAC/patrimonio.
- Se for falso positivo, o alerta pode ser descartado.

Resultado esperado:

- A impressora antiga preserva seu historico ate a troca.
- A impressora nova nao herda paginas antigas da outra.
- O setor continua somando a producao operacional do dia de forma coerente.
- O banco nao fica cheio de linhas repetidas por ciclo.

## Pagecount Diario

O sistema separa dois conceitos:

- Contador total: numero bruto acumulado da impressora, vindo do SNMP.
- Paginas do dia: diferenca segura entre leituras do mesmo dia.

Exemplo simples:

```text
08:00 contador total = 1000
09:00 contador total = 1030
10:00 contador total = 1050

paginas do dia = 50
```

O banco evita dois problemas:

- Queda brusca: quando o contador diminui por reset/troca, nao subtrai paginas.
- Salto brusco: quando o contador sobe demais por troca, nao soma o historico inteiro no dia.

## Triggers Importantes

### `trg_guardar_pagecount_consistente`

Funcao: `fn_guardar_pagecount_consistente`

Papel:

- Protege `telemetria_pagecount` contra queda abrupta de contador.
- Evita que uma leitura ruim faca o contador atual voltar no tempo.
- Foi por isso que um update manual de `99999` para `35318` foi bloqueado: a trigger entendeu como queda suspeita.

### `trg_sync_telemetria_pagecount_diaria`

Funcao: `fn_sync_telemetria_pagecount_diaria`

Papel:

- Sincroniza o contador bruto com a tabela diaria.
- Atualiza inicio/fim do dia.
- Soma apenas delta seguro em `nr_paginas_dia`.
- Ignora leituras fora de ordem, quedas e saltos absurdos.

### Triggers de inventario

Funcoes principais:

- `fn_inventario_evitar_ciclo`: evita hierarquia circular, por exemplo item ser filho de si mesmo indiretamente.
- `fn_inventario_validar_hierarquia_status`: valida relacoes de item superior/status.
- `fn_inventario_touch_dt_atualizacao`: atualiza timestamp automatico.
- `fn_inventario_auditoria_fill`: preenche campos de auditoria.

## APIs e Edge Actions Mais Importantes

### Coletor

- `collector-impressoras`: entrega impressoras ativas para o coletor.
- `collector-telemetria`: recebe payloads de coleta e decide se grava, retem ou abre pendencia.

### Inventario

- `inventory-core/list_context`: carrega contexto de inventario, setores, pisos, modelos e empresas.
- `inventory-core/list_devolucao`: lista itens em devolucao.
- `inventory-core/confirmar_substituicao`: confirma troca assistida.
- `inventory-core/descartar_substituicao`: descarta alerta.
- `inventory-core/corrigir_dados_substituicao`: ajusta dados cadastrais quando a impressora real e a mesma, mas o inventario estava errado.

### Impressoras

- `inventory-print/listar_impressoras`: visao operacional.
- `inventory-print/resumo`: indicadores e cards.
- `inventory-print/detalhes`: metricas por impressora.

## Como Rodar Localmente

Web local usando banco real do Supabase:

```powershell
cd C:\Users\7003233\Desktop\INVENT_COLECTOR\inventario-unificado-web
npm run dev
```

Coletor local:

```powershell
cd C:\Users\7003233\Desktop\INVENT_COLECTOR
.\.venv\Scripts\Activate.ps1
python .\coletor-snmp\scripts\run_collector_loop.py
```

Deploy Edge Functions principais:

```powershell
cd C:\Users\7003233\Desktop\INVENT_COLECTOR\inventario-unificado-web
npx supabase functions deploy inventory-core --project-ref tcxaktsleilbdgxcstqo
npx supabase functions deploy inventory-print --project-ref tcxaktsleilbdgxcstqo
npx supabase functions deploy collector-telemetria --no-verify-jwt --project-ref tcxaktsleilbdgxcstqo
npx supabase functions deploy collector-impressoras --no-verify-jwt --project-ref tcxaktsleilbdgxcstqo
```

Deploy web:

```powershell
cd C:\Users\7003233\Desktop\INVENT_COLECTOR\inventario-unificado-web
npx vercel --prod
```

## Documentacao Detalhada

- [Visao Geral](docs/01-overview.md)
- [Arquitetura](docs/02-architecture.md)
- [Banco de Dados](docs/04-database.md)
- [Coletor SNMP](docs/06-collector.md)
- [API Collector Telemetria](docs/05-api/collector-telemetria.md)
- [API Collector Impressoras](docs/05-api/collector-impressoras.md)
- [API Inventory Core](docs/05-api/inventory-core.md)
- [API Inventory Print](docs/05-api/inventory-print.md)
- [Pagecount Diario](docs/16-telemetria-pagecount-modelo-diario.md)
- [TCC Impressoras](docs/15-visao-geral-tcc-impressoras.md)
- [Guia Integrado TCC](docs/20-guia-integrado-tcc-impressao-telemetria.md)

## Prompt Para Gerar Fluxograma no ChatGPT

Use este prompt em outro chat para desenhar o fluxograma:

```text
Crie um fluxograma completo, em linguagem visual clara, do sistema INVENT_COLECTOR. O sistema tem: frontend Next.js, coletor Python SNMP, Supabase Edge Functions e banco PostgreSQL. Mostre os fluxos: cadastro de inventario; sincronizacao de impressoras ativas para o coletor; coleta SNMP de IP, serie, MAC, hostname, pagecount e suprimentos; envio para collector-telemetria; validacao de token; comparacao de identidade com a tabela inventario; gravacao normal em telemetria_pagecount, telemetria_pagecount_diaria e suprimentos; abertura de pendencia em telemetria_substituicao_pendente quando IP responde com serie/MAC/patrimonio diferente; retencao diaria em telemetria_substituicao_evento_retido; confirmacao/descarte/correcao pela tela de inventario; replay seguro do pagecount retido; exibicao final nos dashboards de impressoras. Destaque as triggers fn_guardar_pagecount_consistente e fn_sync_telemetria_pagecount_diaria e explique que elas evitam queda/salto falso de contador. Organize por raias: Usuario, Frontend, Edge Functions, Banco Supabase e Coletor SNMP.
```
