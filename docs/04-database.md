# 04 - Database

## Banco principal

- Plataforma: Supabase PostgreSQL
- Modelo: relacional
- Foco: integridade referencial + historico operacional

## Entidades centrais

- piso
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

- setor -> piso
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

## Compatibilidade de auditoria (inventario x movimentacao)

- Ambientes legados podem nao ter `movimentacao.cd_usuario`.
- Nesses casos, a auditoria do inventario usa `movimentacao.nm_usuario` com match por `usuario.nm_usuario`.
- Campos de auditoria em inventario:
  - `cd_usuario_criacao`
  - `cd_usuario_ultima_alteracao`
- Trigger de touch:
  - `fn_inventario_touch_dt_atualizacao` so atualiza `dt_atualizacao` quando a coluna existe no schema do ambiente.

## Regras criticas

1. Hierarquia de inventario
- Equipamento RAIZ nao aceita nr_invent_sup.
- Equipamento FILHO em status ATIVO exige nr_invent_sup.
- Filho e superior devem estar no mesmo setor.
- Hostname (inventario.nm_hostname) e utilizado para equipamentos RAIZ/AMBOS.
- Equipamentos FILHO nao persistem hostname.

2. Status operacional padrao
- ATIVO
- MANUTENCAO
- BACKUP
- DEVOLUCAO

3. Estrutura de setor (hospital)
- `piso`: entidade propria para andares/blocos (`cd_piso`, `nm_piso`, `ds_piso`).
- `setor.cd_piso`: vinculacao obrigatoria do setor a um piso.
- `setor.nm_setor`: unidade funcional (SAME, UTI, Recepcao, etc.).
- `setor.nm_localizacao`: detalhamento opcional (sala/corredor/local).
- Unicidade composta em setor: (`cd_piso`, `nm_setor`, `nm_localizacao`).
- Modelo alvo: manter `nm_piso` apenas em `piso` (evitar redundancia em `setor`).
- Exibicao padronizada: usar `public.vw_setor` para retorno de setor com `nm_piso` via join.
- `setor.nm_piso` foi removida para evitar redundancia e risco de divergencia de dados.

4. Matrix por competencia
- Competencia no formato MM/AAAA.
- Reimportacao substitui apenas a competencia alvo.

## Boas praticas de evolucao

- Toda alteracao de schema deve entrar em migration versionada.
- Alteracao de regra de negocio deve atualizar docs de API e ADR quando aplicavel.
- Operacoes destrutivas devem ter estrategia de rollback.
