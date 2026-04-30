# 07 - Deploy

## Estrategia

- Frontend: Vercel
- Backend/API + DB: Supabase

## Deploy de migrations

```bash
cd inventario-unificado-web
npx supabase login
npx supabase link --project-ref tcxaktsleilbdgxcstqo
npx supabase db push
```

## Deploy de Edge Functions

```powershell
cd inventario-unificado-web
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-edge-functions.ps1 -LinkProject
```

### Observacao de seguranca (producao)

- As funcoes `inventory-core`, `inventory-admin`, `inventory-matrix` e `inventory-print` devem permanecer com `verify_jwt=true`.
- Apos deploy, valide no painel do Supabase se a versao ativa corresponde ao deploy atual.

## Deploy frontend

```bash
cd inventario-unificado-web
npx vercel --prod --yes
```

## Checklist pos deploy

1. Validar health das functions publicadas.
2. Executar smoke test de inventory-core e inventory-matrix.
3. Validar tela de inventario e tela de impressoras.
4. Validar troca de perfil (admin/colaborador/viewer) e bloqueio de rotas admin.
5. Validar ingestao do coletor (telemetria e suprimentos) com token dedicado.
6. Conferir logs iniciais de erro no Supabase.
7. Atualizar [11-release-review](11-release-review.md).
