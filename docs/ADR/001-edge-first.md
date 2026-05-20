# ADR 001 - Edge First
> **Leitura guiada para estudo:** este documento foi organizado para explicar o papel do módulo, o fluxo prático que ele executa e onde conferir o comportamento no código. Para estudar, leia primeiro o objetivo, depois acompanhe os arquivos/comandos citados e compare a entrada, o processamento e a saída descritos.

Status: Aceito

## Contexto

Rotas API no frontend eram ponto de acoplamento para regras de dados e sofreram com limitacoes operacionais de timeout e manutencao.

## Decisao

Migrar regras de negocio e operacoes de dados para Supabase Edge Functions, mantendo Vercel focado em entrega de frontend.

## Consequencias

Positivas:

- Menor acoplamento entre UI e regras de backend.
- Escalabilidade mais previsivel para operacoes de dados.
- Governance centralizada no Supabase para API + DB.

Negativas:

- Necessidade de governar contratos por action.
- Curva inicial de ajuste da equipe para fluxo edge-first.

## Status atual

A maioria dos fluxos principais ja opera em Edge Functions, com legado residual em rotas Next para compatibilidade.
