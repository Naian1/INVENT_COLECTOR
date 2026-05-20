# Inventário Unificado e Telemetria de Impressoras

Sistema de inventário unificado e operação de impressoras para ambiente hospitalar. O projeto junta três mundos que antes ficavam separados: inventário patrimonial, coleta SNMP das impressoras e análise operacional de impressão/suprimentos.

## Objetivo

O objetivo é responder perguntas práticas da operação de TI:

- Onde cada equipamento está?
- Qual impressora está ativa em cada setor?
- Qual impressora está em backup, manutenção ou devolução?
- Quanto foi impresso por dia, por modelo e por setor?
- Quais suprimentos estão críticos?
- Quando uma impressora foi trocada fisicamente?
- Como evitar que uma troca física jogue o contador histórico inteiro no volume diário?

A parte principal para apresentação do TCC é o módulo de impressoras/telemetria, porque ele integra hardware real, rede, coletor Python, Edge Functions, banco Supabase, triggers SQL e interface web.

## Módulos do Projeto

### 1. Inventário Web

Local principal:

```text
inventario-unificado-web/
```

Responsável por:

- cadastrar e consultar equipamentos;
- organizar itens por piso, setor e localização;
- controlar status como ativo, manutenção, backup e devolução;
- exibir pendências de substituição detectadas pela telemetria;
- permitir confirmação, descarte ou correção de dados quando a telemetria aponta divergência.

Arquivos importantes:

```text
inventario-unificado-web/app/inventario/page.tsx
inventario-unificado-web/app/inventario/devolucao/page.tsx
inventario-unificado-web/services/telemetriaDiariaService.ts
```

### 2. Coletor SNMP Python

Local principal:

```text
coletor-snmp/
```

Responsável por:

- buscar a lista de impressoras no inventário;
- consultar impressoras pela rede via SNMP;
- coletar série, MAC, contador de páginas e suprimentos;
- montar payload JSON;
- enviar os eventos para a Edge Function `collector-telemetria`;
- registrar logs e pendências locais quando necessário.

Arquivos importantes:

```text
coletor-snmp/utils/snmp_client.py
coletor-snmp/utils/telemetry_mapper.py
coletor-snmp/utils/cache_manager.py
coletor-snmp/utils/printer_sync_service.py
coletor-snmp/utils/supabase_client.py
coletor-snmp/scripts/run_collector_loop.py
```

### 3. Supabase Edge Functions

Local principal:

```text
inventario-unificado-web/supabase/functions/
```

Responsáveis por receber payloads do coletor, validar token, comparar identidade detectada contra inventário, gravar pagecount/suprimentos, criar pendências e expor dados para o frontend.

Funções principais:

```text
collector-telemetria
collector-impressoras
inventory-core
inventory-print
```

### 4. Banco Supabase

Arquivo principal de referência:

```text
inventario-unificado-web/supabase/migrations/SQL Sistema.sql
```

Tabelas importantes:

```text
public.inventario
public.movimentacao
public.empresa
public.telemetria_pagecount
public.telemetria_pagecount_diaria
public.telemetria_substituicao_pendente
public.telemetria_substituicao_evento_retido
public.suprimentos
```

## Fluxo Geral da Telemetria

1. O inventário guarda quais impressoras existem e quais IPs devem ser coletados.
2. O coletor Python consulta a lista de impressoras elegíveis.
3. Para cada IP, o coletor faz consultas SNMP.
4. A impressora responde dados reais: série, MAC, contador e suprimentos.
5. O coletor monta um payload JSON.
6. A Edge `collector-telemetria` recebe o payload.
7. A Edge procura no `public.inventario` qual item deveria estar naquele IP.
8. Se os identificadores batem, grava pagecount e suprimentos.
9. Se algum identificador forte diverge, cria pendência em `telemetria_substituicao_pendente`.
10. Enquanto a pendência está aberta, o sistema não grava pagecount no item errado.
11. A produção fica retida por dia em `telemetria_substituicao_evento_retido`.
12. Quando o usuário confirma, corrige ou descarta, `inventory-core` resolve a pendência.

## Fluxograma Corrigido - Impressoras e Telemetria

Este fluxo corrige uma confus?o comum: no sistema atual, a fonte oficial das impressoras ? `public.inventario`. A Edge `collector-impressoras` ainda possui fallback para uma tabela chamada `impressoras` caso ela exista em algum ambiente antigo, mas no banco atual a coleta vem do invent?rio.

Outro ponto importante: o frontend n?o grava regra cr?tica direto no banco. As telas chamam Edge Functions, e as Edge Functions aplicam valida??es, permiss?es e regras de neg?cio antes de escrever no Supabase.

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

  U1["Usu?rio de TI<br/>usa Invent?rio, Impressoras ou Painel"]:::user
  F1["Frontend Next.js<br/>telas do sistema"]:::frontend
  F2["supabase.functions.invoke<br/>chama inventory-core ou inventory-print"]:::frontend
  DB_INV["public.inventario<br/>fonte oficial dos equipamentos"]:::db
  DB_MOV["public.movimentacao<br/>hist?rico de altera??es"]:::db
  DB_PC["public.telemetria_pagecount<br/>contador bruto atual"]:::db
  DB_DIA["public.telemetria_pagecount_diaria<br/>produ??o di?ria por delta"]:::db
  DB_SUP["public.suprimentos<br/>n?veis atuais"]:::db
  DB_PEND["public.telemetria_substituicao_pendente<br/>alertas de diverg?ncia"]:::db
  DB_RET["public.telemetria_substituicao_evento_retido<br/>resumo di?rio retido"]:::db
  TRG_DIA["Trigger SQL<br/>fn_sync_telemetria_pagecount_diaria"]:::db
  EDGE_CORE["Edge inventory-core<br/>invent?rio, devolu??o, troca e corre??o"]:::edge
  EDGE_PRINT["Edge inventory-print<br/>opera??o e dashboards de impressoras"]:::edge
  EDGE_LIST["Edge collector-impressoras<br/>valida COLLECTOR_API_TOKEN"]:::edge
  EDGE_TEL["Edge collector-telemetria<br/>valida token e payload"]:::edge
  EDGE_CMP["Compara IP + patrim?nio + s?rie + MAC<br/>com a vaga esperada no invent?rio"]:::edge
  DEC_ID{"Identidade bate<br/>com o invent?rio?"}:::decision
  C0["Coletor Python<br/>run_collector_loop.py"]:::collector
  C1["Sincroniza impressoras<br/>GET collector-impressoras"]:::collector
  C2["Recebe IPs eleg?veis<br/>ie_situacao=A e nr_ip preenchido"]:::collector
  C3["SNMP com pysnmp<br/>GET/WALK por OID"]:::collector
  C4["Monta payload JSON<br/>telemetry_mapper.py"]:::collector
  C5["Envia POST<br/>collector-telemetria"]:::collector

  U1 --> F1 --> F2
  F2 --> EDGE_CORE
  F2 --> EDGE_PRINT
  EDGE_CORE --> DB_INV
  EDGE_CORE --> DB_MOV
  EDGE_PRINT --> DB_PC
  EDGE_PRINT --> DB_DIA
  EDGE_PRINT --> DB_SUP
  EDGE_PRINT --> DB_PEND
  C0 --> C1 --> EDGE_LIST
  EDGE_LIST --> DB_INV
  DB_INV --> EDGE_LIST
  EDGE_LIST --> C2
  C2 --> C3 --> C4 --> C5 --> EDGE_TEL
  EDGE_TEL --> EDGE_CMP
  EDGE_CMP --> DB_INV
  EDGE_CMP --> DEC_ID
  DEC_ID -- "Sim" --> OK1["Telemetria aceita"]:::ok
  OK1 --> DB_PC --> TRG_DIA --> DB_DIA
  OK1 --> DB_SUP
  DEC_ID -- "N?o" --> ALERTA["Diverg?ncia detectada<br/>troca f?sica ou cadastro errado"]:::danger
  ALERTA --> DB_PEND
  ALERTA --> DB_RET
  DB_PEND --> F1
  DB_RET --> F1
  U1 -- "confirmar troca" --> F2 --> EDGE_CORE
  U1 -- "corrigir cadastro" --> F2
  U1 -- "descartar alerta" --> F2
  EDGE_CORE -- "confirmar" --> DB_INV
  EDGE_CORE -- "registrar hist?rico" --> DB_MOV
  EDGE_CORE -- "reaplicar resumo retido" --> DB_DIA
  EDGE_CORE -- "resolver pend?ncia" --> DB_PEND
  EDGE_CORE -- "corrigir s?rie/MAC/patrim?nio" --> DB_INV
  EDGE_CORE -- "descartar" --> DB_PEND
  DB_DIA --> EDGE_PRINT --> F1
  DB_SUP --> EDGE_PRINT
  DB_PEND --> EDGE_PRINT
```

## Fluxograma Corrigido - Sistema Inteiro

```mermaid
flowchart LR
  classDef user fill:#E3F2FD,stroke:#1565C0,stroke-width:1px,color:#000;
  classDef frontend fill:#E8F5E9,stroke:#2E7D32,stroke-width:1px,color:#000;
  classDef edge fill:#F3E5F5,stroke:#6A1B9A,stroke-width:1px,color:#000;
  classDef collector fill:#FFF3E0,stroke:#EF6C00,stroke-width:1px,color:#000;
  classDef db fill:#ECEFF1,stroke:#37474F,stroke-width:1px,color:#000;
  classDef auth fill:#E0F7FA,stroke:#00838F,stroke-width:1px,color:#000;

  USR["Usu?rio<br/>Administrador ou operador"]:::user
  AUTH["Supabase Auth<br/>login e JWT"]:::auth
  SHELL["Frontend Next.js<br/>BasicPageShell, menu, tema e notifica??es"]:::frontend
  INV["Tela Invent?rio<br/>vis?o geral e pend?ncias"]:::frontend
  DEV["Tela Devolu??o<br/>itens por empresa"]:::frontend
  CONC["Tela Concilia??o<br/>apoio a confer?ncia"]:::frontend
  IMP["Tela Impressoras<br/>opera??o e suprimentos"]:::frontend
  PAINEL["Painel<br/>volume, custos e alertas"]:::frontend
  USER["Tela Usu?rios<br/>perfis e permiss?es"]:::frontend
  CAT["Categorias<br/>tipos/modelos"]:::frontend
  IMPORT["Importa??es<br/>planilhas e cargas"]:::frontend
  CORE["inventory-core<br/>regras de invent?rio"]:::edge
  PRINT["inventory-print<br/>m?tricas de impressoras"]:::edge
  ADMIN["inventory-admin<br/>administra??o"]:::edge
  MATRIX["inventory-matrix<br/>cargas e concilia??o"]:::edge
  COL_LIST["collector-impressoras<br/>lista IPs para coleta"]:::edge
  COL_TEL["collector-telemetria<br/>ingest?o SNMP"]:::edge
  COL["Coletor Python SNMP<br/>pysnmp + payload HTTP"]:::collector
  PRN["Impressoras f?sicas<br/>respondem SNMP na rede"]:::collector
  DB_USR["public.usuario<br/>public.perfil<br/>public.usuario_perfil"]:::db
  DB_INV["public.inventario<br/>public.equipamento<br/>public.piso<br/>public.setor"]:::db
  DB_MOV["public.movimentacao"]:::db
  DB_EMP["public.empresa"]:::db
  DB_TEL["telemetria_pagecount<br/>telemetria_pagecount_diaria<br/>suprimentos"]:::db
  DB_SWAP["telemetria_substituicao_pendente<br/>telemetria_substituicao_evento_retido"]:::db

  USR --> AUTH --> SHELL
  SHELL --> INV
  SHELL --> DEV
  SHELL --> CONC
  SHELL --> IMP
  SHELL --> PAINEL
  SHELL --> USER
  SHELL --> CAT
  SHELL --> IMPORT
  INV --> CORE
  DEV --> CORE
  CONC --> CORE
  CAT --> CORE
  IMPORT --> MATRIX
  USER --> ADMIN
  IMP --> PRINT
  PAINEL --> PRINT
  CORE --> DB_INV
  CORE --> DB_MOV
  CORE --> DB_EMP
  CORE --> DB_SWAP
  ADMIN --> DB_USR
  MATRIX --> DB_INV
  MATRIX --> DB_EMP
  PRINT --> DB_TEL
  PRINT --> DB_SWAP
  PRINT --> DB_INV
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

Impressoras possuem contador físico histórico. Uma impressora reserva pode já ter 500.000 páginas no contador interno. Se o sistema somasse esse total no dia da troca, o dashboard mostraria um volume falso.

Regra usada:

- contador bruto fica em `telemetria_pagecount`;
- produção diária fica em `telemetria_pagecount_diaria`;
- primeira leitura suspeita não é gravada diretamente no item errado;
- pendência de substituição é aberta;
- produção enquanto a pendência está aberta é consolidada por dia, não por ciclo;
- se for troca real, a produção retida é aplicada ao equipamento correto;
- se for erro cadastral, o usuário corrige série/MAC/patrimônio.

Exemplo correto:

```text
contador no início do dia = 200
contador depois = 250
páginas do dia = 50
```

O sistema não soma `200 + 250`. Ele calcula a diferença.

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

`pysnmp` faz a comunicação SNMP com as impressoras. `urllib.request` envia os payloads para as Edge Functions. As outras bibliotecas ajudam com JSON, logs, paralelismo, interface local e ícone de bandeja.

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

Next.js e React constroem a interface. Supabase JS integra com o backend. As bibliotecas de exportação geram planilhas e PDFs. As bibliotecas de ícone melhoram a usabilidade visual.

## Comandos Úteis

Rodar frontend local:

```powershell
cd C:\Users\7003233\Desktop\INVENT_COLECTOR\inventario-unificado-web
npm run dev
```

Rodar coletor local:

```powershell
cd C:\Users\7003233\Desktop\INVENT_COLECTOR
python .\coletor-snmp\scripts\run_collector_loop.py
```

Deploy Vercel:

```powershell
cd C:\Users\7003233\Desktop\INVENT_COLECTOR\inventario-unificado-web
npx vercel --prod
```

Deploy Supabase Functions:

```powershell
cd C:\Users\7003233\Desktop\INVENT_COLECTOR\inventario-unificado-web
npx supabase functions deploy inventory-core --project-ref tcxaktsleilbdgxcstqo
npx supabase functions deploy inventory-print --project-ref tcxaktsleilbdgxcstqo
npx supabase functions deploy collector-impressoras --no-verify-jwt --project-ref tcxaktsleilbdgxcstqo
npx supabase functions deploy collector-telemetria --no-verify-jwt --project-ref tcxaktsleilbdgxcstqo
```

## Documentação Principal

- [Guia Integrado TCC](docs/20-guia-integrado-tcc-impressao-telemetria.md)
- [Arquitetura](docs/02-architecture.md)
- [Banco de Dados](docs/04-database.md)
- [API Collector Telemetria](docs/05-api/collector-telemetria.md)
- [API Inventory Print](docs/05-api/inventory-print.md)
- [API Inventory Core](docs/05-api/inventory-core.md)
- [Pagecount Diário](docs/16-telemetria-pagecount-modelo-diario.md)
- [Bilhetagem e Tarifas](docs/17-bilhetagem-tarifas-supabase.md)

## Resumo Para Apresentação

O sistema usa o inventário como fonte oficial, coleta dados reais das impressoras via SNMP, compara identidade física com o cadastro e registra produção diária sem misturar contador histórico com volume do dia. Quando encontra divergência, abre uma troca assistida para proteger o histórico e evitar números falsos no dashboard.
