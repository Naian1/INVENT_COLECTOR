# 15) Visão Geral do TCC - Inventário e Monitoramento de Impressoras

## 1. Problema e objetivo

### Por que o sistema existe
Em ambientes corporativos, o inventário de TI costuma ficar distribuído entre planilhas, sistemas legados e cadastros incompletos. Isso dificulta responder perguntas básicas como:
- quais equipamentos existem e onde estão;
- quais impressoras estão ativas, em manutenção ou com baixo suprimento;
- quem fez movimentações e alterações em cada item.

### Dor que o sistema resolve
O projeto resolve duas dores centrais:
- **Inventário de ativos**: cadastro estruturado, hierarquia (pai/filho), movimentação e auditoria.
- **Monitoramento de impressoras**: coleta automática de status, contador de páginas e suprimentos via SNMP, com envio para backend e visualização em dashboard.

## 2. Arquitetura

### Frontend (Next.js + Vercel)
- Aplicação web em Next.js (App Router).
- Interface para inventário, gestão de usuários, categorias e dashboards.
- Deploy em Vercel.
- Login via Supabase Auth no frontend.

### Backend (Supabase + Edge Functions)
- Banco PostgreSQL no Supabase.
- Edge Functions para regras de negócio:
  - `inventory-core`: inventário operacional.
  - `inventory-admin`: gestão de cadastros base (empresa, setor, tipo, equipamento).
  - `collector-impressoras` e `collector-telemetria`: integração com coletor.
- Chamadas protegidas por autenticação e autorização conforme o tipo de endpoint.

### Coletor SNMP (Python)
- Serviço separado (`coletor-snmp`) que:
  - busca lista de impressoras remotas;
  - consulta OIDs SNMP das impressoras;
  - monta payload padronizado;
  - envia telemetria para as Edge Functions.
- Opera em loop configurável, com retry e fila de pendências.

### Banco de dados (foco TCC)
- `inventario`: ativos operacionais.
- `movimentacao`: histórico de movimentação.
- `usuario`, `perfil`, `usuario_perfil`: identidade e RBAC.
- `telemetria_pagecount` e estruturas de impressora/suprimentos: séries de monitoramento.

## 3. Fluxo principal de impressoras

### Origem da lista de impressoras
No cenário atual, o coletor pode usar:
- fonte `supabase`;
- tabela `inventario` como origem;
- filtro de itens que representam impressoras (conforme modelo de dados e regras do projeto).

Resumo: o coletor não depende de cadastro manual isolado; ele reaproveita o inventário como fonte de verdade dos dispositivos.

### Coleta SNMP
Para cada IP elegível:
- lê estado geral;
- lê contador de páginas (com fallback por família/modelo quando necessário);
- lê níveis de suprimentos (descrição, atual, máximo).

Observação técnica importante para apresentação:
- O padrão SNMP/Printer-MIB cobre bem nível e descrição de suprimento.
- Serial individual de cartucho é, em geral, vendor-specific e não garantido em todos os modelos.

### Envio de telemetria
O coletor monta um payload de evento e envia para endpoint de telemetria.
- usa retry;
- registra falhas;
- pode reprocessar pendências.

### Persistência e visualização
Os dados recebidos alimentam tabelas de telemetria.
O frontend consulta essas informações para:
- dashboard analítico de impressoras;
- visão de status;
- leitura de suprimentos;
- tendências por período.

## 4. Segurança e governança

### Auth Supabase + vínculo `auth_user_id`
Modelo adotado:
- `auth.users` (Supabase Auth) gerencia credenciais e JWT.
- `public.usuario` mantém perfil, status e auditoria.
- vínculo por `public.usuario.auth_user_id -> auth.users.id`.

Benefício:
- separa autenticação (credencial) de regra de negócio (perfil/acesso).

### Perfis e RBAC
Perfis principais:
- `ADMIN`: gestão completa, incluindo usuários e cadastros.
- `COLABORADOR`: operação de inventário.
- `VIEWER`: leitura.

As permissões são avaliadas no backend/functions para impedir bypass apenas por frontend.

### Proteção de endpoints e coletor
- Endpoints de usuário/aplicação usam JWT Bearer.
- Endpoints de coletor (máquina-a-máquina) podem operar sem `verify_jwt` da borda, desde que protegidos por `COLLECTOR_API_TOKEN` forte, com rotação e boas práticas de segurança.

## 5. O que foi concluído nesta etapa

- Migração do login para Supabase Auth.
- Vínculo de usuários com `auth_user_id`.
- Ajustes nas APIs para autenticação Bearer.
- Ajustes de autorização em funções críticas.
- Validação de coleta de impressoras via Supabase.
- Correções de frontend nas telas administrativas.

## 6. Mensagem de defesa (resumo para fala)

“O sistema unifica inventário e monitoramento de impressoras em uma arquitetura moderna com Next.js, Supabase e coletor SNMP. A autenticação foi migrada para Supabase Auth com vínculo controlado em tabela de negócio, garantindo segurança e governança. O fluxo de impressoras foi automatizado: origem no inventário, coleta SNMP, persistência e visualização analítica, reduzindo dependência de controles manuais e aumentando rastreabilidade operacional.”

