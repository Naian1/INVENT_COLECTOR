# 04 - Database

## Banco principal

- Plataforma: Supabase PostgreSQL
- Modelo: relacional
- Foco: integridade referencial + historico operacional

## Entidades centrais

- empresa
- tipo_equipamento
- equipamento
- setor
- inventario
- movimentacao
- suprimentos
- telemetria_pagecount

## Entidades Matrix

- inventario_consolidado_carga
- inventario_consolidado_linha

## Relacoes principais

- equipamento -> empresa
- equipamento -> tipo_equipamento
- inventario -> equipamento
- inventario -> setor
- inventario -> inventario (nr_invent_sup)
- movimentacao -> inventario
- movimentacao -> setor (origem/destino)
- suprimentos -> inventario
- telemetria_pagecount -> inventario
- inventario_consolidado_linha -> inventario_consolidado_carga

## Regras criticas

1. Hierarquia de inventario
- Equipamento RAIZ nao aceita nr_invent_sup.
- Equipamento FILHO em status ATIVO exige nr_invent_sup.
- Filho e superior devem estar no mesmo setor.

2. Status operacional padrao
- ATIVO
- MANUTENCAO
- BACKUP
- DEVOLUCAO

3. Matrix por competencia
- Competencia no formato MM/AAAA.
- Reimportacao substitui apenas a competencia alvo.

## Boas praticas de evolucao

- Toda alteracao de schema deve entrar em migration versionada.
- Alteracao de regra de negocio deve atualizar docs de API e ADR quando aplicavel.
- Operacoes destrutivas devem ter estrategia de rollback.
