-- =========================================================
-- MIGRATION UNICA CONSOLIDADA (DATADA)
-- Gerada em: 2026-03-27
-- Baseada em:
--   1) 20260325_reset_total_sistema_unificado.sql
--   2) 20260325_seed_categoria_impressoras.sql
--   3) 20260326_categoria_unica_ativa_por_aba.sql
-- =========================================================
-- ===== BLOCO 1: RESET TOTAL E CRIACAO COMPLETA =====
begin;

-- reset total do schema operacional para recomecar do zero
drop schema if exists public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- =========================================================
-- RESET TOTAL (PT-BR + legado)
-- =========================================================
-- objetos anteriores sao removidos pelo drop schema acima

-- =========================================================
-- TIPOS DINAMICOS
-- =========================================================
create type public.tipo_campo_categoria_t as enum (
  'texto',
  'numero',
  'booleano',
  'data',
  'ip',
  'patrimonio',
  'lista'
);

create type public.conceito_semantico_campo_t as enum (
  'nenhum',
  'patrimonio',
  'ip',
  'hostname',
  'setor',
  'localizacao',
  'modelo',
  'fabricante',
  'numero_serie',
  'impressora_modelo',
  'impressora_patrimonio',
  'impressora_ip'
);

-- =========================================================
-- FUNCAO TRIGGER atualizado_em
-- =========================================================
create or replace function public.fn_touch_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- =========================================================
-- OPERACIONAL DE IMPRESSORAS
-- =========================================================
create table public.impressoras (
  id uuid primary key default gen_random_uuid(),

  patrimonio text not null check (btrim(patrimonio) <> ''),
  ip inet not null,
  setor text not null check (btrim(setor) <> ''),
  localizacao text null,
  modelo text not null check (btrim(modelo) <> ''),

  fabricante text null,
  numero_serie text null,
  hostname text null,
  endereco_mac text null,

  ativo boolean not null default true,
  ultima_coleta_em timestamptz null,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index uq_impressoras_ip on public.impressoras (ip);
create unique index uq_impressoras_patrimonio_ci on public.impressoras ((lower(btrim(patrimonio))));
create unique index uq_impressoras_numero_serie_ci
  on public.impressoras ((lower(btrim(numero_serie))))
  where numero_serie is not null and btrim(numero_serie) <> '';

create index idx_impressoras_setor on public.impressoras (setor);
create index idx_impressoras_modelo on public.impressoras (modelo);
create index idx_impressoras_ativo on public.impressoras (ativo);
create index idx_impressoras_ultima_coleta_em on public.impressoras (ultima_coleta_em desc);

create trigger trg_impressoras_touch_atualizado_em
before update on public.impressoras
for each row execute function public.fn_touch_atualizado_em();

create table public.telemetria_impressoras (
  id bigint generated always as identity primary key,
  impressora_id uuid not null references public.impressoras(id) on delete cascade,

  patrimonio text null,
  ip inet null,

  coletor_id text not null check (btrim(coletor_id) <> ''),
  ingestao_id text not null check (btrim(ingestao_id) <> ''),
  coletado_em timestamptz not null,

  status text not null default 'unknown'
    check (status in ('online', 'offline', 'warning', 'error', 'unknown')),
  tempo_resposta_ms integer null check (tempo_resposta_ms is null or tempo_resposta_ms >= 0),

  payload_bruto jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),

  constraint uq_telemetria_coletor_ingestao unique (coletor_id, ingestao_id)
);

create index idx_telemetria_impressora_coletado_em
  on public.telemetria_impressoras (impressora_id, coletado_em desc);
create index idx_telemetria_status_coletado_em
  on public.telemetria_impressoras (status, coletado_em desc);
create index idx_telemetria_patrimonio on public.telemetria_impressoras (patrimonio);
create index idx_telemetria_ip on public.telemetria_impressoras (ip);

create table public.leituras_paginas_impressoras (
  id bigint generated always as identity primary key,
  impressora_id uuid not null references public.impressoras(id) on delete cascade,

  patrimonio text null,
  ip inet null,

  coletor_id text not null check (btrim(coletor_id) <> ''),
  ingestao_id text not null check (btrim(ingestao_id) <> ''),
  coletado_em timestamptz not null,

  contador_total_paginas bigint not null check (contador_total_paginas >= 0),
  valido boolean not null default true,
  motivo_invalido text null,
  reset_detectado boolean not null default false,

  payload_bruto jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),

  constraint uq_leituras_paginas_coletor_ingestao unique (coletor_id, ingestao_id),
  constraint chk_motivo_invalido check (
    valido = true or (motivo_invalido is not null and btrim(motivo_invalido) <> '')
  )
);

create index idx_leituras_paginas_impressora_coletado_em
  on public.leituras_paginas_impressoras (impressora_id, coletado_em desc);
create index idx_leituras_paginas_coletado_em
  on public.leituras_paginas_impressoras (coletado_em desc);
create index idx_leituras_paginas_validas_impressora_coletado_em
  on public.leituras_paginas_impressoras (impressora_id, coletado_em desc)
  where valido = true;
create index idx_leituras_paginas_patrimonio on public.leituras_paginas_impressoras (patrimonio);
create index idx_leituras_paginas_ip on public.leituras_paginas_impressoras (ip);

create table public.suprimentos_impressoras (
  id bigint generated always as identity primary key,
  impressora_id uuid not null references public.impressoras(id) on delete cascade,

  patrimonio text null,
  ip inet null,

  coletor_id text not null check (btrim(coletor_id) <> ''),
  ingestao_id text not null check (btrim(ingestao_id) <> ''),
  coletado_em timestamptz not null,

  chave_suprimento text not null check (btrim(chave_suprimento) <> ''),
  nome_suprimento text not null check (btrim(nome_suprimento) <> ''),

  nivel_percentual numeric(5,2) null
    check (nivel_percentual is null or (nivel_percentual >= 0 and nivel_percentual <= 100)),
  paginas_restantes bigint null check (paginas_restantes is null or paginas_restantes >= 0),

  status_suprimento text not null default 'unknown'
    check (status_suprimento in ('ok', 'low', 'critical', 'empty', 'unknown', 'offline')),

  valido boolean not null default true,
  payload_bruto jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint uq_suprimentos_estado_atual
    unique (impressora_id, chave_suprimento)
);

create index idx_suprimentos_impressora_coletado_em
  on public.suprimentos_impressoras (impressora_id, coletado_em desc);
create index idx_suprimentos_validos_impressora_coletado_em
  on public.suprimentos_impressoras (impressora_id, coletado_em desc)
  where valido = true;
create index idx_suprimentos_status on public.suprimentos_impressoras (status_suprimento, coletado_em desc);
create index idx_suprimentos_patrimonio on public.suprimentos_impressoras (patrimonio);
create index idx_suprimentos_ip on public.suprimentos_impressoras (ip);

create trigger trg_suprimentos_touch_atualizado_em
before update on public.suprimentos_impressoras
for each row execute function public.fn_touch_atualizado_em();

create table public.alertas_impressoras (
  id bigint generated always as identity primary key,
  impressora_id uuid not null references public.impressoras(id) on delete cascade,

  patrimonio text null,
  ip inet null,

  coletor_id text null,
  ingestao_id text null,

  tipo_alerta text not null check (btrim(tipo_alerta) <> ''),
  severidade text not null default 'low' check (severidade in ('low', 'medium', 'high', 'critical')),
  status_alerta text not null default 'aberto' check (status_alerta in ('aberto', 'reconhecido', 'resolvido', 'fechado')),

  titulo text not null check (btrim(titulo) <> ''),
  descricao text null,
  dados jsonb not null default '{}'::jsonb,

  aberto_em timestamptz not null default now(),
  reconhecido_em timestamptz null,
  resolvido_em timestamptz null,
  fechado_em timestamptz null,
  criado_em timestamptz not null default now(),

  constraint uq_alertas_coletor_ingestao unique (coletor_id, ingestao_id)
);

create index idx_alertas_impressora_status_aberto_em
  on public.alertas_impressoras (impressora_id, status_alerta, aberto_em desc);
create index idx_alertas_severidade_aberto_em
  on public.alertas_impressoras (severidade, aberto_em desc);
create index idx_alertas_patrimonio on public.alertas_impressoras (patrimonio);
create index idx_alertas_ip on public.alertas_impressoras (ip);

-- =========================================================
-- RETENCAO DE LEITURAS DE PAGINAS (3 MESES ROLLING)
-- =========================================================
create or replace function public.fn_purgar_leituras_paginas_antigas(meses_manter integer default 3)
returns integer
language plpgsql
as $$
declare
  limite timestamptz;
  removidos integer;
begin
  if meses_manter < 1 then
    raise exception 'meses_manter deve ser >= 1';
  end if;

  limite := date_trunc('month', now()) - make_interval(months => meses_manter - 1);

  delete from public.leituras_paginas_impressoras
  where coletado_em < limite;

  get diagnostics removidos = row_count;
  return removidos;
end;
$$;

select public.fn_purgar_leituras_paginas_antigas(3);

do $$
declare
  job_existente_id bigint;
begin
  select jobid
    into job_existente_id
  from cron.job
  where jobname = 'purge_leituras_paginas_3_meses'
  limit 1;

  if job_existente_id is not null then
    perform cron.unschedule(job_existente_id);
  end if;

  perform cron.schedule(
    'purge_leituras_paginas_3_meses',
    '15 3 * * *',
    'select public.fn_purgar_leituras_paginas_antigas(3);'
  );
end;
$$;

-- =========================================================
-- INVENTARIO DINAMICO
-- =========================================================
create table public.abas_inventario (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  slug text not null check (btrim(slug) <> ''),
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index uq_abas_inventario_nome_ci on public.abas_inventario ((lower(btrim(nome))));
create unique index uq_abas_inventario_slug_ci on public.abas_inventario ((lower(btrim(slug))));
create index idx_abas_inventario_ordem on public.abas_inventario (ordem);
create trigger trg_abas_inventario_touch_atualizado_em
before update on public.abas_inventario
for each row execute function public.fn_touch_atualizado_em();

create table public.tipos_itens (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  slug text not null check (btrim(slug) <> ''),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index uq_tipos_itens_nome_ci on public.tipos_itens ((lower(btrim(nome))));
create unique index uq_tipos_itens_slug_ci on public.tipos_itens ((lower(btrim(slug))));
create trigger trg_tipos_itens_touch_atualizado_em
before update on public.tipos_itens
for each row execute function public.fn_touch_atualizado_em();

create table public.categorias_inventario (
  id uuid primary key default gen_random_uuid(),
  aba_inventario_id uuid not null references public.abas_inventario(id) on delete cascade,

  nome text not null check (btrim(nome) <> ''),
  slug text not null check (btrim(slug) <> ''),
  descricao text null,
  ordem integer not null default 100,

  origem_tipo text not null default 'manual' check (origem_tipo in ('manual', 'importacao', 'api', 'sistema')),

  planilha_aba_nome text null,
  planilha_aba_id integer null,

  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index uq_categorias_inventario_aba_nome_ci
  on public.categorias_inventario (aba_inventario_id, lower(btrim(nome)));
create unique index uq_categorias_inventario_aba_slug_ci
  on public.categorias_inventario (aba_inventario_id, lower(btrim(slug)));
create index idx_categorias_inventario_aba_ordem
  on public.categorias_inventario (aba_inventario_id, ordem, nome);
create index idx_categorias_inventario_planilha_aba_nome
  on public.categorias_inventario (lower(planilha_aba_nome))
  where planilha_aba_nome is not null;
create trigger trg_categorias_inventario_touch_atualizado_em
before update on public.categorias_inventario
for each row execute function public.fn_touch_atualizado_em();

create table public.categoria_campos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias_inventario(id) on delete cascade,

  nome_campo_exibicao text not null check (btrim(nome_campo_exibicao) <> ''),
  chave_campo text not null check (chave_campo ~ '^[a-z][a-z0-9_]{1,62}$'),

  tipo_campo public.tipo_campo_categoria_t not null,
  tipo_semantico public.conceito_semantico_campo_t not null default 'nenhum',

  obrigatorio boolean not null default false,
  unico boolean not null default false,
  ordem integer not null default 100,

  opcoes_json jsonb null,
  metadados jsonb not null default '{}'::jsonb,

  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint chk_categoria_campos_lista_opcoes
    check (
      tipo_campo <> 'lista'
      or (
        opcoes_json is not null
        and jsonb_typeof(opcoes_json) = 'array'
        and jsonb_array_length(opcoes_json) > 0
      )
    )
);

create unique index uq_categoria_campos_categoria_chave_ci
  on public.categoria_campos (categoria_id, lower(btrim(chave_campo)));
create unique index uq_categoria_campos_categoria_nome_ci
  on public.categoria_campos (categoria_id, lower(btrim(nome_campo_exibicao)));
create index idx_categoria_campos_categoria_ordem
  on public.categoria_campos (categoria_id, ordem, nome_campo_exibicao);
create index idx_categoria_campos_semantico
  on public.categoria_campos (tipo_semantico)
  where ativo = true;
create trigger trg_categoria_campos_touch_atualizado_em
before update on public.categoria_campos
for each row execute function public.fn_touch_atualizado_em();

create table public.linhas_inventario (
  id uuid primary key default gen_random_uuid(),
  aba_inventario_id uuid not null references public.abas_inventario(id) on delete cascade,
  categoria_id uuid not null references public.categorias_inventario(id) on delete restrict,

  codigo_linha text null,
  ordem integer not null default 1000,

  setor text null,
  localizacao text null,
  hostname_base text null,
  observacao text null,

  origem_tipo text not null default 'manual' check (origem_tipo in ('manual', 'importacao', 'api', 'sistema')),
  origem_sheet text null,
  origem_indice_linha text null,

  dados_extras jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_linhas_inventario_aba_ordem on public.linhas_inventario (aba_inventario_id, ordem, criado_em);
create index idx_linhas_inventario_categoria on public.linhas_inventario (categoria_id, ordem, criado_em);
create unique index uq_linhas_inventario_importacao_origem
  on public.linhas_inventario (aba_inventario_id, lower(coalesce(origem_sheet, '')), coalesce(origem_indice_linha, ''))
  where origem_sheet is not null and btrim(origem_sheet) <> ''
    and origem_indice_linha is not null and btrim(origem_indice_linha) <> '';
create trigger trg_linhas_inventario_touch_atualizado_em
before update on public.linhas_inventario
for each row execute function public.fn_touch_atualizado_em();

create table public.linha_valores_campos (
  id bigint generated always as identity primary key,
  linha_id uuid not null references public.linhas_inventario(id) on delete cascade,
  campo_id uuid not null references public.categoria_campos(id) on delete cascade,

  valor_texto text null,
  valor_numero numeric(18,4) null,
  valor_booleano boolean null,
  valor_data date null,
  valor_ip inet null,
  valor_json jsonb null,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint uq_linha_valor_campo unique (linha_id, campo_id),
  constraint chk_linha_valor_algum_preenchido
    check (
      valor_texto is not null
      or valor_numero is not null
      or valor_booleano is not null
      or valor_data is not null
      or valor_ip is not null
      or valor_json is not null
    )
);

create index idx_linha_valores_campos_linha on public.linha_valores_campos (linha_id);
create index idx_linha_valores_campos_campo on public.linha_valores_campos (campo_id);
create index idx_linha_valores_campos_ip on public.linha_valores_campos (valor_ip) where valor_ip is not null;
create index idx_linha_valores_campos_texto_ci
  on public.linha_valores_campos ((lower(btrim(valor_texto))))
  where valor_texto is not null and btrim(valor_texto) <> '';
create trigger trg_linha_valores_campos_touch_atualizado_em
before update on public.linha_valores_campos
for each row execute function public.fn_touch_atualizado_em();

create table public.itens_inventario (
  id uuid primary key default gen_random_uuid(),
  aba_inventario_id uuid not null references public.abas_inventario(id),
  tipo_item_id uuid not null references public.tipos_itens(id),

  linha_inventario_id uuid null references public.linhas_inventario(id) on delete set null,
  categoria_campo_id uuid null references public.categoria_campos(id) on delete set null,
  linha_valor_campo_id bigint null references public.linha_valores_campos(id) on delete set null,

  patrimonio text null,
  descricao text null,
  setor text null,
  localizacao text null,
  modelo text null,
  fabricante text null,
  numero_serie text null,
  hostname text null,
  ip inet null,

  status_item text not null default 'ativo'
    check (status_item in ('ativo', 'estoque', 'manutencao', 'substituido', 'devolvido', 'descartado')),

  dados_extras jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index uq_itens_inventario_patrimonio_ci
  on public.itens_inventario ((lower(btrim(patrimonio))))
  where patrimonio is not null and btrim(patrimonio) <> '';
create unique index uq_itens_inventario_ip
  on public.itens_inventario (ip)
  where ip is not null;
create unique index uq_itens_inventario_numero_serie_ci
  on public.itens_inventario ((lower(btrim(numero_serie))))
  where numero_serie is not null and btrim(numero_serie) <> '';

create index idx_itens_inventario_aba on public.itens_inventario (aba_inventario_id);
create index idx_itens_inventario_tipo on public.itens_inventario (tipo_item_id);
create index idx_itens_inventario_linha on public.itens_inventario (linha_inventario_id);
create index idx_itens_inventario_status on public.itens_inventario (status_item);
create index idx_itens_inventario_ativo on public.itens_inventario (ativo);
create index idx_itens_inventario_dados_extras_gin on public.itens_inventario using gin (dados_extras);
create trigger trg_itens_inventario_touch_atualizado_em
before update on public.itens_inventario
for each row execute function public.fn_touch_atualizado_em();

create table public.vinculos_itens_impressoras (
  item_inventario_id uuid primary key references public.itens_inventario(id) on delete cascade,
  impressora_id uuid not null unique references public.impressoras(id) on delete cascade,
  vinculado_em timestamptz not null default now(),
  origem_vinculo text not null default 'manual'
    check (origem_vinculo in ('manual', 'importacao', 'coletor', 'sistema'))
);

create table public.movimentacoes_itens_inventario (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.itens_inventario(id) on delete cascade,
  acao text not null check (acao in ('criacao', 'edicao', 'movimentacao', 'troca', 'devolucao', 'status', 'vinculo', 'descarte')),
  motivo text not null check (motivo in ('correcao', 'manutencao', 'troca', 'movimentacao', 'devolucao', 'descarte', 'consertado')),
  observacao text null,
  item_relacionado_id uuid null references public.itens_inventario(id),
  de_aba_id uuid null references public.abas_inventario(id),
  para_aba_id uuid null references public.abas_inventario(id),
  criado_em timestamptz not null default now()
);

create index idx_movimentacoes_itens_item on public.movimentacoes_itens_inventario (item_id, criado_em desc);

create table public.importacoes_planilha (
  id uuid primary key default gen_random_uuid(),
  nome_arquivo text not null check (btrim(nome_arquivo) <> ''),
  nome_aba text null,
  aba_inventario_id uuid null references public.abas_inventario(id),
  tipo_item_id uuid null references public.tipos_itens(id),
  estrategia_matching jsonb not null default '["patrimonio","ip","numero_serie"]'::jsonb,
  status text not null default 'preview' check (status in ('preview', 'executada', 'erro')),
  resumo jsonb not null default '{}'::jsonb,
  payload_bruto jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  executado_em timestamptz null
);

create index idx_importacoes_planilha_criado_em on public.importacoes_planilha (criado_em desc);
create index idx_importacoes_planilha_status on public.importacoes_planilha (status);

create table public.importacoes_planilha_linhas (
  id bigint generated always as identity primary key,
  importacao_id uuid not null references public.importacoes_planilha(id) on delete cascade,
  indice_linha integer not null check (indice_linha > 0),
  dados_originais jsonb not null default '{}'::jsonb,
  dados_normalizados jsonb not null default '{}'::jsonb,
  acao_sugerida text not null default 'ignorar' check (acao_sugerida in ('criar', 'atualizar', 'erro', 'conflito', 'ignorar')),
  status text not null default 'pendente' check (status in ('pendente', 'sucesso', 'erro', 'conflito', 'ignorado')),
  item_inventario_id uuid null references public.itens_inventario(id),
  match_por text null check (match_por in ('patrimonio', 'ip', 'numero_serie')),
  erros jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  processado_em timestamptz null,
  constraint uq_importacoes_planilha_linhas unique (importacao_id, indice_linha)
);

create index idx_importacoes_planilha_linhas_importacao
  on public.importacoes_planilha_linhas (importacao_id, indice_linha);
create index idx_importacoes_planilha_linhas_status
  on public.importacoes_planilha_linhas (status);

-- =========================================================
-- VIEW: DUPLICIDADES GLOBAIS (todas as abas/categorias)
-- =========================================================
create or replace view public.vw_duplicidades_globais_inventario as
with base as (
  select
    l.id as linha_id,
    a.nome as aba_nome,
    c.nome as categoria_nome,
    cc.id as campo_id,
    cc.nome_campo_exibicao,
    cc.chave_campo,
    cc.tipo_semantico,
    lower(
      btrim(
        coalesce(
          nullif(v.valor_texto, ''),
          nullif(regexp_replace(v.valor_ip::text, '/32$', ''), ''),
          case when v.valor_numero is not null then v.valor_numero::text end,
          case when v.valor_booleano is not null then case when v.valor_booleano then 'true' else 'false' end end,
          case when v.valor_data is not null then v.valor_data::text end
        )
      )
    ) as valor_normalizado
  from public.linha_valores_campos v
  join public.linhas_inventario l on l.id = v.linha_id
  join public.categoria_campos cc on cc.id = v.campo_id
  join public.categorias_inventario c on c.id = l.categoria_id
  join public.abas_inventario a on a.id = l.aba_inventario_id
  where l.ativo = true
    and cc.ativo = true
    and cc.tipo_semantico in (
      'patrimonio',
      'impressora_patrimonio',
      'ip',
      'impressora_ip',
      'numero_serie',
      'hostname'
    )
)
select
  tipo_semantico,
  valor_normalizado,
  count(*) as total_ocorrencias,
  jsonb_agg(
    jsonb_build_object(
      'linha_id', linha_id,
      'aba_nome', aba_nome,
      'categoria_nome', categoria_nome,
      'campo_id', campo_id,
      'campo', nome_campo_exibicao,
      'chave_campo', chave_campo
    ) order by aba_nome, categoria_nome
  ) as ocorrencias
from base
where valor_normalizado is not null
  and valor_normalizado <> ''
group by tipo_semantico, valor_normalizado
having count(*) > 1;

-- =========================================================
-- SEEDS MINIMOS
-- =========================================================
insert into public.tipos_itens (nome, slug, ativo)
values
  ('Equipamento', 'equipamento', true),
  ('Impressora', 'impressora', true)
on conflict do nothing;

commit;


-- ===== BLOCO 2: SEED CATEGORIA IMPRESSORAS =====
begin;

insert into public.abas_inventario (nome, slug, ordem, ativo)
select 'IMPRESSORAS', 'impressoras', 10, true
where not exists (
  select 1 from public.abas_inventario where lower(btrim(nome)) = 'impressoras'
);

with aba as (
  select id from public.abas_inventario where lower(btrim(nome)) = 'impressoras' limit 1
)
insert into public.categorias_inventario (
  aba_inventario_id, nome, slug, descricao, ordem, origem_tipo, ativo
)
select aba.id, 'IMPRESSORAS', 'impressoras', 'Categoria operacional de impressoras', 10, 'manual', true
from aba
where not exists (
  select 1 from public.categorias_inventario c
  where c.aba_inventario_id = aba.id and lower(btrim(c.nome)) = 'impressoras'
);

with categoria as (
  select c.id
  from public.categorias_inventario c
  join public.abas_inventario a on a.id = c.aba_inventario_id
  where lower(btrim(a.nome)) = 'impressoras'
    and lower(btrim(c.nome)) = 'impressoras'
  limit 1
),
template as (
  select * from (
    values
      ('Patrimonio','nm_patrimonio','patrimonio','impressora_patrimonio',true,true,1),
      ('Modelo','nm_modelo','texto','impressora_modelo',true,false,2),
      ('IP Equipamento','nm_ip','ip','impressora_ip',true,true,3),
      ('Numero Serie','nm_numero_serie','texto','numero_serie',false,true,4),
      ('Hostname','nm_hostname','texto','hostname',false,false,5),
      ('Setor','nm_setor','texto','setor',true,false,6),
      ('Localizacao','nm_localizacao','texto','localizacao',false,false,7),
      ('Fabricante','nm_fabricante','texto','fabricante',false,false,8)
  ) as t(nome_campo_exibicao, chave_campo, tipo_campo, tipo_semantico, obrigatorio, unico, ordem)
)
insert into public.categoria_campos (
  categoria_id,
  nome_campo_exibicao,
  chave_campo,
  tipo_campo,
  tipo_semantico,
  obrigatorio,
  unico,
  ordem,
  opcoes_json,
  metadados,
  ativo
)
select
  c.id,
  t.nome_campo_exibicao,
  t.chave_campo,
  t.tipo_campo::public.tipo_campo_categoria_t,
  t.tipo_semantico::public.conceito_semantico_campo_t,
  t.obrigatorio,
  t.unico,
  t.ordem,
  null,
  '{}'::jsonb,
  true
from categoria c
cross join template t
where not exists (
  select 1
  from public.categoria_campos cc
  where cc.categoria_id = c.id
    and lower(btrim(cc.chave_campo)) = lower(btrim(t.chave_campo))
);

commit;


-- ===== BLOCO 3: REGRA CATEGORIA ATIVA UNICA =====
begin;

-- 1) Higieniza legado: se houver mais de uma categoria ativa na mesma aba,
-- mantÃ©m a mais recente ativa e desativa as demais.
with ranqueadas as (
  select
    id,
    aba_inventario_id,
    row_number() over (
      partition by aba_inventario_id
      order by atualizado_em desc nulls last, criado_em desc nulls last, id desc
    ) as rn
  from public.categorias_inventario
  where ativo = true
)
update public.categorias_inventario c
set
  ativo = false,
  atualizado_em = now()
from ranqueadas r
where c.id = r.id
  and r.rn > 1;

-- 2) Garante regra 1:1 no banco:
-- uma unica categoria ativa por aba.
create unique index if not exists uq_categorias_inventario_aba_ativa_unica
  on public.categorias_inventario (aba_inventario_id)
  where ativo = true;

commit;


-- ===== BLOCO 4: PERMISSOES POS-RESET =====
begin;

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;
grant all on all routines in schema public to postgres, service_role;

alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to service_role;
alter default privileges for role postgres in schema public
  grant all on routines to service_role;

commit;

