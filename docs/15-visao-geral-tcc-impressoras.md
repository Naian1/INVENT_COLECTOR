# 15) VisÃ£o Geral do TCC - InventÃ¡rio e Monitoramento de Impressoras
> **Leitura guiada para estudo:** este documento foi organizado para explicar o papel do módulo, o fluxo prático que ele executa e onde conferir o comportamento no código. Para estudar, leia primeiro o objetivo, depois acompanhe os arquivos/comandos citados e compare a entrada, o processamento e a saída descritos.

## 1. Problema e objetivo

### Por que o sistema existe
Em ambientes corporativos, o inventÃ¡rio de TI costuma ficar distribuÃ­do entre planilhas, sistemas legados e cadastros incompletos. Isso dificulta responder perguntas bÃ¡sicas como:
- quais equipamentos existem e onde estÃ£o;
- quais impressoras estÃ£o ativas, em manutenÃ§Ã£o ou com baixo suprimento;
- quem fez movimentaÃ§Ãµes e alteraÃ§Ãµes em cada item.

### Dor que o sistema resolve
O projeto resolve duas dores centrais:
- **InventÃ¡rio de ativos**: cadastro estruturado, hierarquia (pai/filho), movimentaÃ§Ã£o e auditoria.
- **Monitoramento de impressoras**: coleta automÃ¡tica de status, contador de pÃ¡ginas e suprimentos via SNMP, com envio para backend e visualizaÃ§Ã£o em dashboard.

## 2. Arquitetura

### Frontend (Next.js + Vercel)
- AplicaÃ§Ã£o web em Next.js (App Router).
- Interface para inventÃ¡rio, gestÃ£o de usuÃ¡rios, categorias e dashboards.
- Deploy em Vercel.
- Login via Supabase Auth no frontend.

### Backend (Supabase + Edge Functions)
- Banco PostgreSQL no Supabase.
- Edge Functions para regras de negÃ³cio:
  - `inventory-core`: inventÃ¡rio operacional.
  - `inventory-admin`: gestÃ£o de cadastros base (empresa, setor, tipo, equipamento).
  - `collector-impressoras` e `collector-telemetria`: integraÃ§Ã£o com coletor.
- Chamadas protegidas por autenticaÃ§Ã£o e autorizaÃ§Ã£o conforme o tipo de endpoint.

### Coletor SNMP (Python)
- ServiÃ§o separado (`coletor-snmp`) que:
  - busca lista de impressoras remotas;
  - consulta OIDs SNMP das impressoras;
  - monta payload padronizado;
  - envia telemetria para as Edge Functions.
- Opera em loop configurÃ¡vel, com retry e fila de pendÃªncias.

### Banco de dados (foco TCC)
- `inventario`: ativos operacionais.
- `movimentacao`: histÃ³rico de movimentaÃ§Ã£o.
- `usuario`, `perfil`, `usuario_perfil`: identidade e RBAC.
- `telemetria_pagecount` e estruturas de impressora/suprimentos: sÃ©ries de monitoramento.

## 3. Fluxo principal de impressoras

### Origem da lista de impressoras
No cenÃ¡rio atual, o coletor pode usar:
- fonte `supabase`;
- tabela `inventario` como origem;
- filtro de itens que representam impressoras (conforme modelo de dados e regras do projeto).

Resumo: o coletor nÃ£o depende de cadastro manual isolado; ele reaproveita o inventÃ¡rio como fonte de verdade dos dispositivos.

### Coleta SNMP
Para cada IP elegÃ­vel:
- lÃª estado geral;
- lÃª contador de pÃ¡ginas (com fallback por famÃ­lia/modelo quando necessÃ¡rio);
- lÃª nÃ­veis de suprimentos (descriÃ§Ã£o, atual, mÃ¡ximo).

ObservaÃ§Ã£o tÃ©cnica importante para apresentaÃ§Ã£o:
- O padrÃ£o SNMP/Printer-MIB cobre bem nÃ­vel e descriÃ§Ã£o de suprimento.
- Serial individual de cartucho Ã©, em geral, vendor-specific e nÃ£o garantido em todos os modelos.

### Envio de telemetria
O coletor monta um payload de evento e envia para endpoint de telemetria.
- usa retry;
- registra falhas;
- pode reprocessar pendÃªncias.

### PersistÃªncia e visualizaÃ§Ã£o
Os dados recebidos alimentam tabelas de telemetria.
O frontend consulta essas informaÃ§Ãµes para:
- dashboard analÃ­tico de impressoras;
- visÃ£o de status;
- leitura de suprimentos;
- tendÃªncias por perÃ­odo.

## 4. SeguranÃ§a e governanÃ§a

### Auth Supabase + vÃ­nculo `auth_user_id`
Modelo adotado:
- `auth.users` (Supabase Auth) gerencia credenciais e JWT.
- `public.usuario` mantÃ©m perfil, status e auditoria.
- vÃ­nculo por `public.usuario.auth_user_id -> auth.users.id`.

BenefÃ­cio:
- separa autenticaÃ§Ã£o (credencial) de regra de negÃ³cio (perfil/acesso).

### Perfis e RBAC
Perfis principais:
- `ADMIN`: gestÃ£o completa, incluindo usuÃ¡rios e cadastros.
- `COLABORADOR`: operaÃ§Ã£o de inventÃ¡rio.
- `VIEWER`: leitura.

As permissÃµes sÃ£o avaliadas no backend/functions para impedir bypass apenas por frontend.

### ProteÃ§Ã£o de endpoints e coletor
- Endpoints de usuÃ¡rio/aplicaÃ§Ã£o usam JWT Bearer.
- Endpoints de coletor (mÃ¡quina-a-mÃ¡quina) podem operar sem `verify_jwt` da borda, desde que protegidos por `COLLECTOR_API_TOKEN` forte, com rotaÃ§Ã£o e boas prÃ¡ticas de seguranÃ§a.

## 5. O que foi concluÃ­do nesta etapa

- MigraÃ§Ã£o do login para Supabase Auth.
- VÃ­nculo de usuÃ¡rios com `auth_user_id`.
- Ajustes nas APIs para autenticaÃ§Ã£o Bearer.
- Ajustes de autorizaÃ§Ã£o em funÃ§Ãµes crÃ­ticas.
- ValidaÃ§Ã£o de coleta de impressoras via Supabase.
- CorreÃ§Ãµes de frontend nas telas administrativas.

## 6. Mensagem de defesa (resumo para fala)

â€œO sistema unifica inventÃ¡rio e monitoramento de impressoras em uma arquitetura moderna com Next.js, Supabase e coletor SNMP. A autenticaÃ§Ã£o foi migrada para Supabase Auth com vÃ­nculo controlado em tabela de negÃ³cio, garantindo seguranÃ§a e governanÃ§a. O fluxo de impressoras foi automatizado: origem no inventÃ¡rio, coleta SNMP, persistÃªncia e visualizaÃ§Ã£o analÃ­tica, reduzindo dependÃªncia de controles manuais e aumentando rastreabilidade operacional.â€


## Atualizacao 2026-05-04 (bilhetagem diaria)

- O modelo de telemetria de paginas foi simplificado para duas tabelas.
- `telemetria_pagecount` guarda o contador atual por patrimonio/inventario.
- `telemetria_pagecount_diaria` guarda minimo, maximo e delta diario.
- Isso reduz volume de banco e facilita explicacao metodologica no TCC.
