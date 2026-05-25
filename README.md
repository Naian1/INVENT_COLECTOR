# Inventário Unificado e Telemetria de Impressoras

Sistema de inventário unificado e operação de impressoras para ambiente hospitalar. O projeto integra três partes principais: inventário patrimonial, coleta SNMP das impressoras e análise operacional de impressão, pagecount e suprimentos.

A parte central para apresentação do TCC é o módulo de impressoras e telemetria, porque ele conecta hardware real na rede, coletor Python, Edge Functions, banco PostgreSQL/Supabase, triggers SQL e interface web.

# Fluxo de Impressoras e Telemetria

O foco técnico da apresentação do TCC é o fluxo de impressoras: coleta SNMP, coletor Python, telemetria, pagecount, suprimentos, troca assistida e dashboard operacional.

A fonte oficial das impressoras é `public.inventario`. A telemetria coletada pela rede é gravada nas tabelas atuais de impressoras: `public.telemetria_pagecount`, `public.telemetria_pagecount_diaria`, `public.suprimentos`, `public.telemetria_substituicao_pendente`, `public.telemetria_substituicao_evento_retido` e `public.tarifas_bilhetagem`.

Documento completo de estudo para o TCC:

- [Mapa de Estudo TCC - Impressoras e Telemetria](docs/MAPA_ESTUDO_IMPRESSORAS_TCC.md)

```mermaid
flowchart TD
  A["Impressora física"] --> B["Coletor Python"]
  B --> C["SNMP / OIDs"]
  C --> D["Payload JSON de telemetria"]
  D --> E["Edge collector-telemetria"]
  E --> F["Validação do token"]
  F --> G["Comparação com public.inventario"]
  G --> H{"Identidade confere?"}
  H -- "Sim" --> I["telemetria_pagecount"]
  H -- "Sim" --> J["suprimentos"]
  I --> K["Trigger de consolidação diária"]
  K --> L["telemetria_pagecount_diaria"]
  H -- "Não" --> M["telemetria_substituicao_pendente"]
  M --> N["telemetria_substituicao_evento_retido"]
  L --> O["Edge inventory-print"]
  J --> O
  N --> P["Troca assistida no frontend"]
  O --> Q["Dashboard /impressoras"]
```

## Objetivo
O sistema foi criado para responder perguntas práticas da operação de TI:

- Onde cada equipamento está?
- Qual impressora está ativa em cada setor?
- Qual impressora está em backup, manutenção ou devolução?
- Quanto foi impresso por dia, por modelo e por setor?
- Quais suprimentos estão críticos?
- Quando uma impressora foi trocada fisicamente?
- Como evitar que uma troca física jogue o contador histórico inteiro da impressora nova no volume diário do setor?

## Visão Geral dos Módulos

### Inventário Web

Local principal:

```text
inventario-unificado-web/
```

Responsável por cadastrar, consultar e movimentar equipamentos. A tela de inventário organiza os itens por piso, setor, localização, tipo, status e relação hierárquica. Também exibe pendências de substituição detectadas pela telemetria das impressoras.

Arquivos principais:

```text
inventario-unificado-web/app/inventario/page.tsx
inventario-unificado-web/app/inventario/devolucao/page.tsx
inventario-unificado-web/app/impressoras/page.tsx
inventario-unificado-web/app/page.tsx
inventario-unificado-web/components/AppShell.tsx
inventario-unificado-web/services/telemetriaDiariaService.ts
```

### Coletor SNMP Python

Local principal:

```text
coletor-snmp/
```

Responsável por descobrir quais impressoras devem ser consultadas, acessar cada IP pela rede usando SNMP, coletar identidade da impressora, contador de páginas e suprimentos, montar o payload JSON e enviar tudo para o Supabase Edge Functions.

Arquivos principais:

```text
coletor-snmp/utils/snmp_client.py
coletor-snmp/utils/telemetry_mapper.py
coletor-snmp/utils/cache_manager.py
coletor-snmp/utils/api_client.py
coletor-snmp/utils/file_manager.py
coletor-snmp/utils/runtime_trace.py
coletor-snmp/scripts/run_collector_loop.py
coletor-snmp/scripts/collector_control_app.py
```

### Edge Functions

Local principal:

```text
inventario-unificado-web/supabase/functions/
```

Responsáveis por aplicar regras de negócio do lado do backend. O frontend chama essas funções para consultar, alterar e resolver dados com validação. O coletor também chama Edge Functions para buscar impressoras e enviar telemetria.

Funções principais:

```text
collector-impressoras
collector-telemetria
inventory-core
inventory-print
inventory-admin
inventory-matrix
```

Resumo rapido do papel de cada uma:

| Edge Function | O que faz no sistema |
| --- | --- |
| `collector-impressoras` | Entrega ao coletor a lista de impressoras oficiais vindas de `public.inventario`. |
| `collector-telemetria` | Recebe payload SNMP do coletor, compara identidade, grava pagecount/suprimentos ou cria pendencia de troca. |
| `inventory-core` | Nucleo do inventario: lista contexto, cria/edita/movimenta itens, resolve pendencias, manutencao e devolucao. |
| `inventory-print` | Monta visao operacional de impressoras, dashboard, suprimentos, status e ranking de impressao. |
| `inventory-admin` | Administra cadastros base: piso, empresa, tipo, setor, equipamento e validacao de perfil ADMIN. |
| `inventory-matrix` | Controla importacao Matrix: inicia carga, insere linhas e finaliza conferencia da carga. |

O passo a passo completo de quem chama, como autentica, quais actions existem, quais tabelas usa e como cada uma executa esta em:

```text
docs/05-api/overview.md
```

### Camadas de API do Sistema

No projeto, a palavra "API" aparece em duas camadas diferentes. As duas recebem requisicoes HTTP, mas elas nao tem o mesmo papel.

#### 1. Supabase Edge Functions

As Edge Functions sao APIs backend serverless executadas no Supabase. Elas ficam em:

```text
inventario-unificado-web/supabase/functions/
```

Funcoes atuais:

```text
collector-impressoras
collector-telemetria
inventory-core
inventory-print
inventory-admin
inventory-matrix
```

Papel delas:

- concentrar regras criticas de negocio;
- validar permissao, token ou sessao antes de alterar dados;
- receber telemetria do coletor Python;
- gravar e consultar dados no PostgreSQL/Supabase;
- reduzir risco de o frontend gravar algo errado direto no banco.

Resumo para apresentar:

```text
Edge Function = API backend principal do Supabase.
```

#### 2. Rotas API do Next.js

As rotas API do Next.js tambem sao APIs HTTP, mas rodam dentro do projeto web. Elas ficam em:

```text
inventario-unificado-web/app/api/
```

Exemplos:

```text
/api/auth/me
/api/inventario
/api/impressoras
/api/telemetria/resumo-diario
```

Papel delas:

- apoiar telas do proprio site;
- encapsular consultas auxiliares;
- integrar services TypeScript usados pelo frontend;
- manter compatibilidade com fluxos internos do Next.js.

Resumo para apresentar:

```text
Rotas app/api = APIs internas do site Next.js.
```

Portanto, as Edge Functions sao APIs, mas nao sao as unicas APIs do projeto. A diferenca principal e que as regras mais sensiveis e operacionais ficam nas Edge Functions, enquanto as rotas `app/api` ajudam o site a organizar chamadas internas.

### Banco Supabase

Arquivo principal de referência:

```text
inventario-unificado-web/supabase/migrations/SQL Sistema.sql
```

Tabelas principais:

```text
public.inventario
public.movimentacao
public.empresa
public.equipamento
public.piso
public.setor
public.usuario
public.perfil
public.usuario_perfil
public.telemetria_pagecount
public.telemetria_pagecount_diaria
public.telemetria_substituicao_pendente
public.telemetria_substituicao_evento_retido
public.suprimentos
```


## Estrutura de Pastas

O projeto esta organizado para separar claramente sistema web, coletor Python e documentacao.

```text
INVENT_COLECTOR/
|- inventario-unificado-web/   Frontend Next.js, services TypeScript, Edge Functions e SQL Supabase
|- coletor-snmp/               Aplicativo Python local que coleta impressoras via SNMP
|- docs/                       Documentacao tecnica, TCC, deploy, banco e troubleshooting
|- .venv/                      Ambiente virtual Python local
|- .vscode/                    Configuracoes locais do editor
`- README.md                   Entrada principal do projeto no GitHub
```

Resumo das pastas principais:

| Pasta | Papel no sistema |
| --- | --- |
| `inventario-unificado-web/app` | Paginas Next.js, rotas internas e CSS global. |
| `inventario-unificado-web/components` | Componentes reutilizaveis de interface. |
| `inventario-unificado-web/services` | Camada TypeScript de acesso a dados e regras auxiliares. |
| `inventario-unificado-web/lib` | Helpers compartilhados, Supabase, seguranca e validacoes. |
| `inventario-unificado-web/supabase/functions` | Edge Functions que aplicam regras de negocio no backend. |
| `inventario-unificado-web/supabase/migrations` | SQL do banco, tabelas, triggers e funcoes. |
| `coletor-snmp/scripts` | Scripts executaveis do coletor, incluindo app visual e loop. |
| `coletor-snmp/utils` | Modulos Python de SNMP, cache, API, mapper e arquivos locais. |
| `coletor-snmp/data` | Cache local, fila pendente e dados de apoio do coletor. |
| `coletor-snmp/logs` | Logs de execucao e rastros tecnicos do coletor. |
| `docs` | Documentacao de arquitetura, banco, coletor, TCC e operacao. |

Documentacao detalhada da estrutura e CSS:

```text
docs/21-estrutura-pastas-css.md
docs/22-mapa-completo-arquivos.md
```

O arquivo `docs/22-mapa-completo-arquivos.md` e o catalogo mais detalhado: ele lista cada arquivo versionado no Git, agrupado por pasta, e explica o papel de cada um no sistema.

## Organizacao de CSS

O CSS principal fica em:

```text
inventario-unificado-web/app/globals.css
```

A estrategia recomendada nao e jogar tudo sem criterio no global. O ideal e:

- `globals.css` para tokens de tema, layout, componentes reutilizaveis e classes por pagina bem separadas por comentarios;
- classes `ui-*` para componentes globais;
- classes `inventory-*`, `printers-*` e `dashboard-*` para estilos especificos de pagina;
- CSS inline apenas quando o valor e dinamico, como largura de barra percentual ou variavel calculada por dado.

Exemplo:

```tsx
<span className="ui-supply-fill" style={{ width: `${percentual}%` }} />
```

Nesse caso, o inline faz sentido porque `percentual` vem do dado da impressora. Ja `marginBottom`, `padding`, cor fixa e grid repetido devem virar classe CSS.

Observacao da sanitizacao: a antiga tela `app/operacional/page.tsx` foi removida. O acompanhamento operacional atual fica na tela `/impressoras`, que usa dados consolidados pela Edge Function `inventory-print`.

## Como a Coleta de Impressoras Funciona

A fonte oficial das impressoras é `public.inventario`. Não existe tabela separada de impressoras no fluxo atual.

O coletor Python nao sai inventando IP. Em producao, ele consulta diretamente o Supabase/PostgREST usando `COLLECTOR_PRINTERS_SOURCE=supabase` e a tabela `public.inventario`. A lista oficial retorna somente itens ativos do inventario que possuem IP preenchido e que podem ser consultados por SNMP.

Critérios principais da lista do coletor:

```text
ie_situacao = A
nr_ip preenchido
```

Na prática:

- `ie_situacao = A` significa que o item está ativo no inventário;
- `nr_ip preenchido` significa que existe endereço de rede para consultar via SNMP;
- itens sem IP não entram no ciclo de coleta;
- itens em backup sem IP continuam existindo no inventário, mas não são varridos pelo coletor.

## O Que é SNMP no Sistema

SNMP significa Simple Network Management Protocol. É um protocolo usado para consultar informações de equipamentos de rede, como impressoras, switches e nobreaks.

No projeto, o coletor Python usa SNMP para perguntar dados diretamente para cada impressora. A impressora responde valores identificados por OIDs, que são endereços padronizados dentro da árvore SNMP do equipamento.

Exemplos de dados consultados:

- número de série;
- endereço MAC;
- hostname;
- contador total de páginas;
- percentual de toner;
- unidade de imagem;
- kit de manutenção;
- status online/offline.

## Bibliotecas Principais

### Python

```text
pysnmp
urllib.request
json
logging
concurrent.futures
tkinter
pystray
Pillow
```

`pysnmp` executa as consultas SNMP. `urllib.request` envia requisições HTTP para as Edge Functions. `json` monta e lê payloads. `logging` registra o que aconteceu em cada ciclo. `concurrent.futures` permite consultar várias impressoras em paralelo sem travar o coletor em uma única máquina lenta. `tkinter`, `pystray` e `Pillow` apoiam a interface local e o ícone de bandeja.

### Frontend

```text
next
react
@supabase/supabase-js
lucide-react
@flaticon/flaticon-uicons
xlsx
jspdf
jspdf-autotable
zod
```

Next.js e React constroem as telas. Supabase JS chama autenticação e Edge Functions. As bibliotecas de exportação geram planilhas e PDFs. As bibliotecas de ícones melhoram a leitura visual. `zod` ajuda a validar dados quando necessário.


## Fluxograma - Aplicativo Python do Coletor

Este fluxo mostra os arquivos Python locais do coletor e como eles trabalham juntos. Ele complementa o fluxograma geral de impressoras, focando no aplicativo que inicia/para o coletor e no loop que executa a coleta.

```mermaid
flowchart TD
  classDef app fill:#E3F2FD,stroke:#1565C0,stroke-width:1px,color:#000;
  classDef loop fill:#FFF3E0,stroke:#EF6C00,stroke-width:1px,color:#000;
  classDef util fill:#E8F5E9,stroke:#2E7D32,stroke-width:1px,color:#000;
  classDef db fill:#ECEFF1,stroke:#37474F,stroke-width:1px,color:#000;
  classDef net fill:#F3E5F5,stroke:#6A1B9A,stroke-width:1px,color:#000;
  classDef danger fill:#FFEBEE,stroke:#C62828,stroke-width:2px,color:#000;

  A[Usuario abre<br/>collector_control_app.py]:::app
  B[App carrega .env<br/>load_env]:::app
  C{Coletor ja esta<br/>rodando?}:::app
  D[Mostra PID, status<br/>logs e painel tecnico]:::app
  E[Usuario clica<br/>Iniciar coletor]:::app
  F[save_env grava<br/>configuracoes]:::app
  G[resolve_python_command<br/>acha Python da .venv]:::app
  H[subprocess inicia<br/>run_collector_loop.py]:::loop

  I[run_collector_loop.py<br/>configura logs e intervalo]:::loop
  J[run_loop inicia ciclo]:::loop
  K[cache_manager.py<br/>atualizar_cache]:::loop
  L[api_client.py<br/>le .env e consulta Supabase REST]:::util
  M[Supabase PostgREST<br/>public.inventario]:::db
  N[file_manager.py<br/>salva/usa printers.json]:::util
  O[cache_manager.py<br/>filtra IPs elegiveis]:::loop
  P[snmp_client.py<br/>SNMP GET/WALK]:::net
  Q[Impressoras fisicas<br/>respondem OIDs]:::net
  R[cache_manager.py<br/>interpreta identidade, pagecount e suprimentos]:::loop
  S[telemetry_mapper.py<br/>monta payload JSON]:::util
  T[api_client.py<br/>envia para collector-telemetria]:::util
  U[Edge collector-telemetria<br/>valida e grava]:::net
  V[Supabase<br/>telemetria e suprimentos]:::db
  W[runtime_trace.py<br/>registra eventos tecnicos]:::util
  X[collector_pending.jsonl<br/>fila local se envio falhar]:::danger
  Y[Circuit breaker<br/>cooldown em timeout]:::danger

  A --> B --> C
  C -- Sim --> D
  C -- Nao --> E --> F --> G --> H
  H --> I --> J --> K
  K --> L --> M --> L
  L --> N --> O
  O --> P --> Q --> P
  P --> R --> S --> T --> U --> V
  T --> W
  P --> W
  L -- timeout repetido --> Y
  T -- falha temporaria --> X
  X --> T
```

Resumo curto do fluxo Python:

```text
collector_control_app.py -> run_collector_loop.py -> cache_manager.py -> snmp_client.py -> telemetry_mapper.py -> api_client.py -> Supabase
```

## Fluxograma - Impressoras e Telemetria

Este fluxograma mostra somente a parte de impressoras. A fonte oficial das impressoras coletadas é `public.inventario`. A interface web não grava regra crítica direto no banco; ela chama Edge Functions, e as Edge Functions aplicam validações, permissões e regras de negócio antes de escrever no Supabase.

```mermaid
flowchart TD
  classDef user fill:#E3F2FD,stroke:#1565C0,stroke-width:1px,color:#000;
  classDef frontend fill:#E8F5E9,stroke:#2E7D32,stroke-width:1px,color:#000;
  classDef collector fill:#FFF3E0,stroke:#EF6C00,stroke-width:1px,color:#000;
  classDef edge fill:#F3E5F5,stroke:#6A1B9A,stroke-width:1px,color:#000;
  classDef db fill:#ECEFF1,stroke:#37474F,stroke-width:1px,color:#000;
  classDef decision fill:#FFFDE7,stroke:#F9A825,stroke-width:2px,color:#000;
  classDef danger fill:#FFEBEE,stroke:#C62828,stroke-width:2px,color:#000;
  classDef ok fill:#E8F5E9,stroke:#1B5E20,stroke-width:2px,color:#000;

  USER_TI["Usuário de TI<br/>acompanha impressoras"]:::user
  WEB_PRINT["Frontend Next.js<br/>Painel, Inventário e Impressoras"]:::frontend
  WEB_CALL["supabase.functions.invoke<br/>chama inventory-print ou inventory-core"]:::frontend

  COL_LOOP["Coletor Python<br/>run_collector_loop.py"]:::collector
  COL_LIST_REQ["api_client.py<br/>consulta Supabase REST"]:::collector
  COL_LIST_QUERY["PostgREST<br/>select em public.inventario"]:::db
  DB_INV["public.inventario<br/>fonte oficial dos equipamentos"]:::db

  COL_SNMP["Coletor consulta IPs<br/>via SNMP com pysnmp"]:::collector
  PRINTER["Impressoras físicas<br/>respondem OIDs SNMP"]:::collector
  COL_PAYLOAD["telemetry_mapper.py<br/>monta payload JSON"]:::collector
  TEL_EDGE["Edge collector-telemetria<br/>valida token, payload e campos"]:::edge
  TEL_COMPARE["Compara IP, patrimônio,<br/>série e MAC com public.inventario"]:::edge
  ID_OK{"Identidade confere<br/>com o inventário?"}:::decision

  DB_PAGE["public.telemetria_pagecount<br/>contador bruto aceito"]:::db
  TRG_DIA["Trigger SQL<br/>sincroniza produção diária"]:::db
  DB_DIA["public.telemetria_pagecount_diaria<br/>delta diário consolidado"]:::db
  DB_SUP["public.suprimentos<br/>nível atual dos consumíveis"]:::db

  DB_PEND["public.telemetria_substituicao_pendente<br/>alerta de divergência"]:::db
  DB_RET["public.telemetria_substituicao_evento_retido<br/>resumo diário enquanto pendente"]:::db
  CORE["Edge inventory-core<br/>confirmar, corrigir ou descartar"]:::edge
  DB_MOV["public.movimentacao<br/>histórico operacional"]:::db
  PRINT_EDGE["Edge inventory-print<br/>dashboard e operação"]:::edge

  USER_TI --> WEB_PRINT --> WEB_CALL
  WEB_CALL --> PRINT_EDGE
  WEB_CALL --> CORE

  COL_LOOP --> COL_LIST_REQ --> COL_LIST_QUERY --> DB_INV
  DB_INV --> COL_LIST_QUERY --> COL_LOOP
  COL_LOOP --> COL_SNMP --> PRINTER --> COL_SNMP
  COL_SNMP --> COL_PAYLOAD --> TEL_EDGE --> TEL_COMPARE --> DB_INV
  TEL_COMPARE --> ID_OK

  ID_OK -- "Sim" --> OK["Telemetria aceita"]:::ok
  OK --> DB_PAGE --> TRG_DIA --> DB_DIA
  OK --> DB_SUP

  ID_OK -- "Não" --> WARN["Divergência detectada<br/>troca física ou cadastro errado"]:::danger
  WARN --> DB_PEND
  WARN --> DB_RET
  DB_PEND --> WEB_PRINT

  USER_TI -- "confirmar troca" --> CORE
  USER_TI -- "corrigir cadastro" --> CORE
  USER_TI -- "descartar alerta" --> CORE
  CORE --> DB_INV
  CORE --> DB_MOV
  CORE --> DB_DIA
  CORE --> DB_PEND

  DB_DIA --> PRINT_EDGE --> WEB_PRINT
  DB_SUP --> PRINT_EDGE
  DB_PEND --> PRINT_EDGE
```

## Fluxograma - Inventário Completo com Impressoras

Este fluxograma mostra o sistema inteiro: autenticação, telas, Edge Functions, tabelas principais, coletor SNMP e impressoras físicas.

```mermaid
flowchart LR
  classDef user fill:#E3F2FD,stroke:#1565C0,stroke-width:1px,color:#000;
  classDef frontend fill:#E8F5E9,stroke:#2E7D32,stroke-width:1px,color:#000;
  classDef edge fill:#F3E5F5,stroke:#6A1B9A,stroke-width:1px,color:#000;
  classDef collector fill:#FFF3E0,stroke:#EF6C00,stroke-width:1px,color:#000;
  classDef db fill:#ECEFF1,stroke:#37474F,stroke-width:1px,color:#000;
  classDef auth fill:#E0F7FA,stroke:#00838F,stroke-width:1px,color:#000;

  USR["Usuário<br/>administrador ou operador"]:::user
  AUTH["Supabase Auth<br/>login e JWT"]:::auth
  SHELL["Frontend Next.js<br/>layout, menu, tema e notificações"]:::frontend

  PAINEL["Painel<br/>indicadores gerais"]:::frontend
  INV["Inventário<br/>visão geral, filtros e pendências"]:::frontend
  DEV["Devolução<br/>itens agrupados por empresa"]:::frontend
  CONC["Conciliação<br/>conferência de cargas"]:::frontend
  IMP["Impressoras<br/>operação, suprimentos e status"]:::frontend
  CAT["Categorias<br/>tipos e modelos"]:::frontend
  IMPORT["Importações<br/>planilhas e matriz"]:::frontend
  USERS["Usuários<br/>perfis e permissões"]:::frontend

  CORE["inventory-core<br/>regras de inventário"]:::edge
  PRINT["inventory-print<br/>métricas de impressoras"]:::edge
  ADMIN["inventory-admin<br/>usuários e administração"]:::edge
  MATRIX["inventory-matrix<br/>cargas e conciliação"]:::edge
  COL_LIST["api_client.py<br/>consulta Supabase REST<br/>public.inventario"]:::collector
  COL_TEL["collector-telemetria<br/>ingestão SNMP"]:::edge

  COL["Coletor Python SNMP<br/>pysnmp + HTTP"]:::collector
  PRN["Impressoras físicas<br/>rede hospitalar"]:::collector

  DB_USER["public.usuario<br/>public.perfil<br/>public.usuario_perfil"]:::db
  DB_INV["public.inventario<br/>public.equipamento"]:::db
  DB_LOCAL["public.piso<br/>public.setor"]:::db
  DB_MOV["public.movimentacao"]:::db
  DB_EMP["public.empresa"]:::db
  DB_TEL["public.telemetria_pagecount<br/>public.telemetria_pagecount_diaria<br/>public.suprimentos"]:::db
  DB_SWAP["public.telemetria_substituicao_pendente<br/>public.telemetria_substituicao_evento_retido"]:::db

  USR --> AUTH --> SHELL
  SHELL --> PAINEL
  SHELL --> INV
  SHELL --> DEV
  SHELL --> CONC
  SHELL --> IMP
  SHELL --> CAT
  SHELL --> IMPORT
  SHELL --> USERS

  PAINEL --> PRINT
  IMP --> PRINT
  INV --> CORE
  DEV --> CORE
  CAT --> CORE
  CONC --> MATRIX
  IMPORT --> MATRIX
  USERS --> ADMIN

  CORE --> DB_INV
  CORE --> DB_LOCAL
  CORE --> DB_MOV
  CORE --> DB_EMP
  CORE --> DB_SWAP
  PRINT --> DB_INV
  PRINT --> DB_TEL
  PRINT --> DB_SWAP
  ADMIN --> DB_USER
  MATRIX --> DB_INV
  MATRIX --> DB_EMP

  COL --> COL_LIST --> DB_INV
  COL_LIST --> COL
  COL --> PRN
  PRN --> COL
  COL --> COL_TEL
  COL_TEL --> DB_INV
  COL_TEL --> DB_TEL
  COL_TEL --> DB_SWAP
  DB_TEL --> PRINT
  DB_SWAP --> CORE
```

## Proteção Contra Explosão de Pagecount

Impressoras possuem contador físico histórico. Uma impressora reserva pode já ter centenas de milhares de páginas no contador interno. Se o sistema somasse esse total no dia da troca, o dashboard mostraria um volume falso.

A regra correta é trabalhar com delta, ou seja, diferença entre leituras consistentes:

```text
contador no início do período = 200
contador depois = 250
páginas produzidas = 50
```

O sistema não soma `200 + 250`. Ele calcula a diferença.

Quando existe divergência de identidade, a telemetria não é aplicada imediatamente no item errado. Enquanto a pendência está aberta, a produção fica resumida por dia em `telemetria_substituicao_evento_retido`. Assim o banco não recebe uma linha por ciclo sem necessidade e o plano gratuito do Supabase fica mais protegido.

## Como Rodar Localmente

Frontend:

```powershell
cd inventario-unificado-web
npm run dev
```

Coletor:

```powershell
python ./coletor-snmp/scripts/run_collector_loop.py
```

Deploy das Edge Functions alteradas:

```powershell
cd inventario-unificado-web
npx supabase functions deploy collector-impressoras --no-verify-jwt --project-ref tcxaktsleilbdgxcstqo
npx supabase functions deploy collector-telemetria --no-verify-jwt --project-ref tcxaktsleilbdgxcstqo
npx supabase functions deploy inventory-core --project-ref tcxaktsleilbdgxcstqo
npx supabase functions deploy inventory-print --project-ref tcxaktsleilbdgxcstqo
```

Deploy do frontend:

```powershell
cd inventario-unificado-web
npx vercel --prod
```
