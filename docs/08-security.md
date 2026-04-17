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
- Operacoes administrativas ficam nas Edge Functions.
- Coletor acessa endpoint com Bearer token dedicado.

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
