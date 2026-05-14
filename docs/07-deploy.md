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

## Checklist extra (telemetria diaria - 2026-05-04)

1. Confirmar migration consolidada em `SQL Sistema.sql` aplicada.
2. Confirmar trigger `trg_sync_telemetria_pagecount_diaria` criada.
3. Reimplantar `collector-telemetria`.
4. Rodar coletor por 1 ciclo e validar:
- `telemetria_pagecount` com 1 linha por inventario.
- `telemetria_pagecount_diaria` com linha do dia atual.

## Checklist extra (substituicao assistida - 2026-05-14)

1. Aplicar migration `20260514_telemetria_substituicao_pendente.sql`.
2. Reimplantar `collector-telemetria` e `inventory-core`.
3. Rodar coletor em um IP de teste com serie diferente da esperada.
4. Confirmar registro em `telemetria_substituicao_pendente` com `ie_status=PENDENTE`.
5. Executar action `list_substituicao_pendente`.
6. Executar action `resolver_substituicao_pendente` com `CONFIRMAR_TROCA`.
7. Validar no inventario:
- item antigo ficou `BACKUP` e sem IP.
- item substituto ficou `ATIVO` com o IP aplicado.
