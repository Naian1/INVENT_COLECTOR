# 08 - Security

## Principios

- Menor privilegio por contexto.
- Segregacao clara entre frontend e backend.
- Tokens e chaves fora de versionamento.

## Segredos

- Nao commitar .env com valores reais.
- Rotacionar COLLECTOR_API_TOKEN periodicamente.
- Usar SUPABASE_SERVICE_ROLE_KEY apenas no backend/edge.

## Acesso

- Frontend usa chave anonima publica.
- Edge Functions do app web (`inventory-core`, `inventory-admin`, `inventory-matrix`, `inventory-print`) exigem JWT valido (`verify_jwt=true`).
- Operacoes administrativas ficam nas Edge Functions.
- Coletor acessa endpoint com Bearer token dedicado.
- Telas administrativas no app web:
  - `/usuarios` e `/inventario/categorias` exigem perfil `ADMIN`.
  - Perfil `VIEWER` opera em modo somente leitura no inventario (sem criar/editar/movimentar/substituir/resolver).

## Coletor em producao

- Manter `COLLECTOR_API_TOKEN` forte e rotacionado.
- Preferir `COLLECTOR_PRINTERS_SOURCE=supabase` para listar impressoras direto no Supabase (evita latencia extra do Vercel).
- Quando usar source `supabase`, preencher `COLLECTOR_SUPABASE_URL` e `COLLECTOR_SUPABASE_KEY` (somente no host do coletor, nunca no browser).

## Boas praticas de release

1. Revisar variaveis de ambiente antes de deploy.
2. Conferir permissao de tabelas e policies.
3. Auditar uso de chaves em scripts.
4. Remover credenciais antigas apos rotacao.

## Incidentes

Em caso de suspeita de exposicao:

1. Revogar chave/token.
2. Gerar novo segredo.
3. Publicar functions com credenciais atualizadas.
4. Revisar logs de acesso e atualizar post-mortem.
