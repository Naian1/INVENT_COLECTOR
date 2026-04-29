# 14) Migração Auth + Login + Coletor (2026-04-29)

## Objetivo
Migrar autenticação legada para Supabase Auth com vínculo em `public.usuario`, mantendo RBAC e operação do coletor SNMP.

## Resumo Executivo
- Login via Supabase Auth habilitado.
- Vínculo `public.usuario.auth_user_id -> auth.users.id` implementado.
- APIs de sessão/usuário adaptadas para JWT Bearer.
- Edge Functions críticas protegidas por validação de usuário/perfil.
- Coletor validado para leitura de impressoras via Supabase (`inventario`), com ajuste pendente em função de telemetria (JWT gateway).

## Alterações Aplicadas

### Banco de dados (SQL)
- `public.usuario.auth_user_id UUID` adicionado.
- FK `fk_usuario_auth_user` para `auth.users(id)` adicionada.
- Índice único parcial `uq_usuario_auth_user_id` adicionado.
- Estrutura `usuario_perfil` e rotinas de auditoria em inventário presentes.

Arquivo:
- `inventario-unificado-web/supabase/migrations/SQL Sistema.sql`

Verificação (ok):
- `auth_user_id`
- `fk_usuario_auth_user`
- `uq_usuario_auth_user_id`
- `cd_usuario_criacao` / `cd_usuario_ultima_alteracao` em `inventario`
- trigger/função de auditoria de inventário

### Frontend (Next.js)
- Tela de login usando `supabase.auth.signInWithPassword`.
- `/usuarios` corrigido para evitar erro de hooks (client-side exception).
- `/inventario/categorias` corrigido para evitar erro de hooks.
- `BasicPageShell` com validação de sessão e redirecionamento para `/login` quando não autenticado.

Arquivos:
- `inventario-unificado-web/app/login/page.tsx`
- `inventario-unificado-web/app/usuarios/page.tsx`
- `inventario-unificado-web/app/inventario/categorias/page.tsx`
- `inventario-unificado-web/components/BasicPageShell.tsx`

### APIs (App Router)
- `/api/auth/me` validando Bearer JWT e resolvendo usuário por `auth_user_id`.
- `/api/usuarios` com autenticação Bearer + checagem ADMIN.
- `/api/inventario/auditoria` migrado de sessão cookie para Bearer JWT.
- `/api/auth/login` legado mantido como descontinuado (410), conforme migração.

Arquivos:
- `inventario-unificado-web/app/api/auth/me/route.ts`
- `inventario-unificado-web/app/api/usuarios/route.ts`
- `inventario-unificado-web/app/api/inventario/auditoria/route.ts`
- `inventario-unificado-web/app/api/auth/login/route.ts`

### Edge Functions
- `inventory-admin`: valida token, resolve ator e exige perfil ADMIN.
- `inventory-core`: resolve usuário autenticado e usa ator real nas operações/auditoria.

Arquivos:
- `inventario-unificado-web/supabase/functions/inventory-admin/index.ts`
- `inventario-unificado-web/supabase/functions/inventory-core/index.ts`

## Validações executadas
- `npm run typecheck` -> OK
- `npm run build` -> OK

## Coletor SNMP (status)

### Resultado dos testes
1. Fonte `supabase` com tabela `impressoras`: falhou (tabela não existente no projeto atual).
2. Fonte `supabase` com tabela `inventario`: sucesso (4 impressoras encontradas).
3. Ciclo de coleta (`--once`): coleta SNMP ok, telemetria bloqueada por `401 UNAUTHORIZED_INVALID_JWT_FORMAT` na função `collector-telemetria`.

### Ajuste recomendado no `.env` do coletor
```env
COLLECTOR_PRINTERS_SOURCE=supabase
COLLECTOR_SUPABASE_PRINTERS_TABLE=inventario
```

### Deploy recomendado para funções do coletor
Se mantido modelo token-a-token (sem JWT de usuário):
```bash
npx supabase functions deploy collector-telemetria --project-ref tcxaktsleilbdgxcstqo --no-verify-jwt
npx supabase functions deploy collector-impressoras --project-ref tcxaktsleilbdgxcstqo --no-verify-jwt
```

Observação:
- Nesse modo, a proteção fica por `COLLECTOR_API_TOKEN` validado dentro das funções.

## Situação da etapa de login
**Concluída tecnicamente**, com estes pontos finais operacionais:
1. Publicar frontend com as correções mais recentes (hooks + bloqueio sem sessão).
2. Revalidar `/usuarios` e `/inventario/categorias` em produção.
3. Garantir fluxo do coletor após ajuste de tabela e deploy das functions do coletor.

## Próximos passos (curto prazo)
1. Deploy web:
```bash
cd inventario-unificado-web
npx vercel --prod --force
```
2. Deploy collector functions (conforme seção acima).
3. Executar:
```bash
python scripts/run_collector_loop.py --check-connection --log-level INFO
python scripts/run_collector_loop.py --once --log-level INFO
```
4. Validar telas protegidas sem login (deve redirecionar para `/login`).

