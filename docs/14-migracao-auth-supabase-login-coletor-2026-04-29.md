# 14) MigraÃ§Ã£o Auth + Login + Coletor (2026-04-29)
> **Leitura guiada para estudo:** este documento foi organizado para explicar o papel do mÃ³dulo, o fluxo prÃ¡tico que ele executa e onde conferir o comportamento no cÃ³digo. Para estudar, leia primeiro o objetivo, depois acompanhe os arquivos/comandos citados e compare a entrada, o processamento e a saÃ­da descritos.

## Objetivo
Migrar autenticaÃ§Ã£o legada para Supabase Auth com vÃ­nculo em `public.usuario`, mantendo RBAC e operaÃ§Ã£o do coletor SNMP.

## Resumo Executivo
- Login via Supabase Auth habilitado.
- VÃ­nculo `public.usuario.auth_user_id -> auth.users.id` implementado.
- APIs de sessÃ£o/usuÃ¡rio adaptadas para JWT Bearer.
- Edge Functions crÃ­ticas protegidas por validaÃ§Ã£o de usuÃ¡rio/perfil.
- Coletor validado para leitura de impressoras via Supabase (`inventario`), com ajuste pendente em funÃ§Ã£o de telemetria (JWT gateway).

## AlteraÃ§Ãµes Aplicadas

### Banco de dados (SQL)
- `public.usuario.auth_user_id UUID` adicionado.
- FK `fk_usuario_auth_user` para `auth.users(id)` adicionada.
- ndice Ãºnico parcial `uq_usuario_auth_user_id` adicionado.
- Estrutura `usuario_perfil` e rotinas de auditoria em inventÃ¡rio presentes.

Arquivo:
- `inventario-unificado-web/supabase/migrations/SQL Sistema.sql`

VerificaÃ§Ã£o (ok):
- `auth_user_id`
- `fk_usuario_auth_user`
- `uq_usuario_auth_user_id`
- `cd_usuario_criacao` / `cd_usuario_ultima_alteracao` em `inventario`
- trigger/funÃ§Ã£o de auditoria de inventÃ¡rio

### Frontend (Next.js)
- Tela de login usando `supabase.auth.signInWithPassword`.
- `/usuarios` corrigido para evitar erro de hooks (client-side exception).
- `/inventario/categorias` corrigido para evitar erro de hooks.
- `BasicPageShell` com validaÃ§Ã£o de sessÃ£o e redirecionamento para `/login` quando nÃ£o autenticado.

Arquivos:
- `inventario-unificado-web/app/login/page.tsx`
- `inventario-unificado-web/app/usuarios/page.tsx`
- `inventario-unificado-web/app/inventario/categorias/page.tsx`
- `inventario-unificado-web/components/BasicPageShell.tsx`

### APIs (App Router)
- `/api/auth/me` validando Bearer JWT e resolvendo usuÃ¡rio por `auth_user_id`.
- `/api/usuarios` com autenticaÃ§Ã£o Bearer + checagem ADMIN.
- `/api/inventario/auditoria` migrado de sessÃ£o cookie para Bearer JWT.
- `/api/auth/login` legado mantido como descontinuado (410), conforme migraÃ§Ã£o.

Arquivos:
- `inventario-unificado-web/app/api/auth/me/route.ts`
- `inventario-unificado-web/app/api/usuarios/route.ts`
- `inventario-unificado-web/app/api/inventario/auditoria/route.ts`
- `inventario-unificado-web/app/api/auth/login/route.ts`

### Edge Functions
- `inventory-admin`: valida token, resolve ator e exige perfil ADMIN.
- `inventory-core`: resolve usuÃ¡rio autenticado e usa ator real nas operaÃ§Ãµes/auditoria.

Arquivos:
- `inventario-unificado-web/supabase/functions/inventory-admin/index.ts`
- `inventario-unificado-web/supabase/functions/inventory-core/index.ts`

## ValidaÃ§Ãµes executadas
- `npm run typecheck` -> OK
- `npm run build` -> OK

## Coletor SNMP (status)

### Resultado dos testes
1. Fonte `supabase` apontada para `public.inventario`: sucesso na leitura das impressoras elegÃ­veis.
2. Ciclo de coleta (`--once`): coleta SNMP ok; a etapa de envio depende do deploy da funÃ§Ã£o `collector-telemetria` com token do coletor.

### Ajuste recomendado no `.env` do coletor
```env
COLLECTOR_PRINTERS_SOURCE=supabase
```

### Deploy recomendado para funÃ§Ãµes do coletor
Se mantido modelo token-a-token (sem JWT de usuÃ¡rio):
```bash
npx supabase functions deploy collector-telemetria --project-ref tcxaktsleilbdgxcstqo --no-verify-jwt
npx supabase functions deploy collector-impressoras --project-ref tcxaktsleilbdgxcstqo --no-verify-jwt
```

ObservaÃ§Ã£o:
- Nesse modo, a proteÃ§Ã£o fica por `COLLECTOR_API_TOKEN` validado dentro das funÃ§Ãµes.

## SituaÃ§Ã£o da etapa de login
**ConcluÃ­da tecnicamente**, com estes pontos finais operacionais:
1. Publicar frontend com as correÃ§Ãµes mais recentes (hooks + bloqueio sem sessÃ£o).
2. Revalidar `/usuarios` e `/inventario/categorias` em produÃ§Ã£o.
3. Garantir fluxo do coletor apÃ³s ajuste de tabela e deploy das functions do coletor.

## PrÃ³ximos passos (curto prazo)
1. Deploy web:
```bash
cd inventario-unificado-web
npx vercel --prod --force
```
2. Deploy collector functions (conforme seÃ§Ã£o acima).
3. Executar:
```bash
python scripts/run_collector_loop.py --check-connection --log-level INFO
python scripts/run_collector_loop.py --once --log-level INFO
```
4. Validar telas protegidas sem login (deve redirecionar para `/login`).


## AtualizaÃ§Ã£o complementar (2026-05-04)

- Telemetria de pÃ¡ginas evoluiu para modelo em duas tabelas com trigger SQL diÃ¡ria.
- Fonte oficial para bilhetagem diÃ¡ria:
  - `telemetria_pagecount_diaria`
- Estado atual da impressora:
  - `telemetria_pagecount`
