# 13 - Auth, RBAC e Auditoria (Banco de Dados)

## Escopo aplicado

Este documento descreve a modelagem de banco adicionada para:
- Autenticacao de usuarios
- RBAC por perfil
- Matriz de permissoes por recurso e acao
- Auditoria de criacao e ultima alteracao no inventario
- Auditoria de usuario em movimentacao
- Auditoria de ativacao/inativacao de usuario
- Regra de bloqueio de login para usuario inativo

Implementacao consolidada no arquivo de migration unico:
- inventario-unificado-web/supabase/migrations/SQL Sistema.sql
- Bloco SOURCE: 20260427_auth_rbac_auditoria.sql
- Bloco SOURCE: 20260427_usuario_status_ativacao_inativacao.sql

## Tabelas criadas

### 1) public.perfil

Finalidade:
- Cadastro dos perfis de acesso do sistema

Campos principais:
- cd_perfil (PK)
- nm_perfil (UNIQUE)
- ds_perfil
- ie_situacao (A/I)
- dt_cadastro

Seeds padrao:
- ADMIN
- COLABORADOR
- VIEWER

### 2) public.usuario

Finalidade:
- Cadastro de usuarios para login e autorizacao

Campos principais:
- cd_usuario (PK)
- nm_usuario
- ds_email
- ds_login
- ds_senha_hash
- cd_perfil (FK -> perfil.cd_perfil)
- ie_situacao (A/I)
- dt_ultimo_login
- dt_cadastro
- dt_atualizacao

Campos de rastreio de status:
- cd_usuario_ativacao (FK -> usuario.cd_usuario)
- dt_ativacao
- cd_usuario_inativacao (FK -> usuario.cd_usuario)
- dt_inativacao
- ds_motivo_inativacao

Campos de auditoria no proprio usuario:
- cd_usuario_criacao (FK -> usuario.cd_usuario)
- cd_usuario_ultima_alteracao (FK -> usuario.cd_usuario)

Regras/indices:
- unique case-insensitive para ds_login
- unique case-insensitive para ds_email
- trigger para atualizar dt_atualizacao em UPDATE
- trigger para registrar quem/quando ativou ou inativou usuario

Regra funcional de login:
- Se ie_situacao = 'I', o usuario nao autentica
- Funcao de apoio: fn_usuario_autenticavel(p_login)
- Registro de ultimo login so ocorre para usuario ativo

### 3) public.perfil_permissao

Finalidade:
- Definir permissoes por perfil em nivel de recurso/acao

Campos principais:
- cd_perfil_permissao (PK)
- cd_perfil (FK -> perfil.cd_perfil)
- nm_recurso
- nm_acao
- ie_permitido (S/N)
- dt_cadastro

Regras:
- unique (cd_perfil, nm_recurso, nm_acao)
- acoes permitidas: VIEW, CREATE, UPDATE, DELETE, MOVE, MANAGE

Seeds de permissoes:
- ADMIN: permissao ampla (inclui USUARIO/PERFIL MANAGE)
- COLABORADOR: operacao de inventario sem administracao de usuarios
- VIEWER: leitura

## Alteracoes em tabelas existentes

### public.inventario

Campos adicionados:
- cd_usuario_criacao (FK -> usuario.cd_usuario)
- cd_usuario_ultima_alteracao (FK -> usuario.cd_usuario)
- dt_ultima_alteracao

Regra automatica:
- Trigger atualiza dt_ultima_alteracao em UPDATE

### public.movimentacao

Campo adicionado:
- cd_usuario (FK -> usuario.cd_usuario)

Observacao:
- nm_usuario legado foi mantido para compatibilidade historica

## Cardinalidades (modelo relacional)

1) perfil (1) -> (N) usuario
- Um perfil pode estar em varios usuarios
- Um usuario pertence a exatamente um perfil

2) perfil (1) -> (N) perfil_permissao
- Um perfil possui varias permissoes
- Cada permissao pertence a um perfil

3) usuario (1) -> (N) usuario [auto-relacao de auditoria]
- Um usuario pode criar/alterar varios usuarios
- Campos: cd_usuario_criacao e cd_usuario_ultima_alteracao

4) usuario (1) -> (N) inventario [criacao]
- Um usuario pode criar varios itens de inventario

5) usuario (1) -> (N) inventario [ultima alteracao]
- Um usuario pode alterar varios itens de inventario

6) usuario (1) -> (N) movimentacao
- Um usuario pode registrar varias movimentacoes

7) inventario (1) -> (N) movimentacao [ja existente no modelo]
- Um item de inventario pode ter varias movimentacoes

## Integridade referencial

Politicas de FK aplicadas:
- perfil -> usuario: ON UPDATE CASCADE, ON DELETE RESTRICT
- perfil -> perfil_permissao: ON UPDATE CASCADE, ON DELETE CASCADE
- usuario (auditoria) auto-FK: ON UPDATE CASCADE, ON DELETE SET NULL
- usuario -> inventario (auditoria): ON UPDATE CASCADE, ON DELETE SET NULL
- usuario -> movimentacao: ON UPDATE CASCADE, ON DELETE SET NULL
- usuario (ativacao) -> usuario: ON UPDATE CASCADE, ON DELETE SET NULL
- usuario (inativacao) -> usuario: ON UPDATE CASCADE, ON DELETE SET NULL

## Fluxo de funcionamento (usuario, perfil, permissao)

1) Criacao de usuario
- Admin cria usuario com perfil inicial (ADMIN, COLABORADOR ou VIEWER)
- Usuario nasce ativo por padrao (ie_situacao = 'A')

2) Autorizacao
- Sistema busca perfil do usuario
- Sistema avalia permissoes na tabela perfil_permissao por recurso/acao

3) Inativacao
- Admin altera ie_situacao para 'I'
- Trigger grava dt_inativacao e cd_usuario_inativacao
- Usuario inativo deixa de autenticar

4) Reativacao
- Admin altera ie_situacao para 'A'
- Trigger grava dt_ativacao e cd_usuario_ativacao
- Usuario volta a ser elegivel para autenticacao

5) Auditoria operacional
- inventario e movimentacao mantem referencia do usuario executor
- Permite rastrear quem criou, quem alterou e quem movimentou

## Impacto para aplicacao

Com esta modelagem, o backend pode:
- Autenticar por login/email + hash de senha
- Resolver perfil e permissoes por recurso/acao
- Registrar usuario criador e ultimo editor do inventario
- Registrar usuario executor da movimentacao

## Proximos passos recomendados

1. API de autenticacao:
- login, logout, me

2. Middleware de autorizacao:
- validacao por perfil/permissao (recurso + acao)

3. Painel admin de usuarios:
- CRUD de usuario
- Alteracao de perfil (liberar perfil)
- Ativacao/inativacao

4. UI de auditoria:
- Exibir criado por / ultima alteracao por no modal de inventario
- Exibir usuario da movimentacao no historico
