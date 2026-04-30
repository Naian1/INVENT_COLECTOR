-- MIGRATION UNICA CONSOLIDADA
-- Gerada automaticamente a partir das migrations existentes em ordem alfabetica

-- ========================================================
-- SOURCE: 20260327_schema_unico_completo_datado.sql
-- ========================================================

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
-- mantém a mais recente ativa e desativa as demais.
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



-- ========================================================
-- SOURCE: 20260331_reparo_permissoes_service_role.sql
-- ========================================================

-- =========================================================
-- REPARO DE PERMISSOES APOS RESET DE SCHEMA
-- Data: 2026-03-31
-- Objetivo: garantir que service_role consiga inserir/atualizar
-- nas tabelas recriadas pelo schema unico.
-- =========================================================

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


-- ========================================================
-- SOURCE: 20260331_retencao_leituras_paginas_3_meses.sql
-- ========================================================

-- Migration desativada.
-- A retencao de 3 meses agora faz parte do arquivo unico
-- 20260327_schema_unico_completo_datado.sql.
do $$
begin
  raise notice 'Retencao de paginas ja integrada em 20260327_schema_unico_completo_datado.sql';
end;
$$;


-- ========================================================
-- SOURCE: 20260402_migrate_daniel_to_public.sql
-- ========================================================

-- =========================================================
-- MIGRATION: Daniel Schema → Public (LIMPEZA TOTAL + RECREAÇÃO)
-- Data: 2026-04-02
-- Objetivo: DROPAR TODAS as tabelas antigas (v2, ativos, impressoras, etc)
--           CRIAR apenas as 6 tabelas do schema daniel puro
-- =========================================================

BEGIN;

-- =========================================================
-- 1. DROPAR TODAS AS VIEWS PRIMEIRO (para não bloquear DROP)
-- =========================================================
DROP VIEW IF EXISTS public.vw_duplicidades CASCADE;

-- =========================================================
-- 2. DROPAR TODAS AS TABELAS DO SISTEMA ANTIGO
-- =========================================================
-- Views v2 e anteriores
DROP TABLE IF EXISTS public.telemetria_pagecount CASCADE;
DROP TABLE IF EXISTS public.suprimentos CASCADE;
DROP TABLE IF EXISTS public.suprimentos_impressoras CASCADE;
DROP TABLE IF EXISTS public.movimentacao CASCADE;
DROP TABLE IF EXISTS public.movimentacoes_ativos CASCADE;
DROP TABLE IF EXISTS public.inventario CASCADE;
DROP TABLE IF EXISTS public.equipamento CASCADE;
DROP TABLE IF EXISTS public.tipo_equipamento CASCADE;
DROP TABLE IF EXISTS public.setor CASCADE;
DROP TABLE IF EXISTS public.empresa CASCADE;

-- Tabelas antigas de impressoras
DROP TABLE IF EXISTS public.impressoras CASCADE;
DROP TABLE IF EXISTS public.alertas_impressoras CASCADE;
DROP TABLE IF EXISTS public.leituras_paginas_impressoras CASCADE;
DROP TABLE IF EXISTS public.telemetria_impressoras CASCADE;

-- Tabelas antigas de configuração dinâmica
DROP TABLE IF EXISTS public.ativos CASCADE;
DROP TABLE IF EXISTS public.configuracao_abas CASCADE;
DROP TABLE IF EXISTS public.configuracao_colunas CASCADE;
DROP TABLE IF EXISTS public.corporativo CASCADE;
DROP TABLE IF EXISTS public.dispositivos_moveis CASCADE;
DROP TABLE IF EXISTS public.estoque_suprimentos CASCADE;
DROP TABLE IF EXISTS public.estoque_ti CASCADE;
DROP TABLE IF EXISTS public.postos_do_trabalho CASCADE;
DROP TABLE IF EXISTS public.racks_nobreaks CASCADE;
DROP TABLE IF EXISTS public.telefones CASCADE;

-- =========================================================
-- 2. CRIAR SCHEMA DANIEL NO PUBLIC (6 TABELAS PURAS)
-- =========================================================

-- 2.1 - TABELA: empresa
CREATE TABLE public.empresa (
  cd_cgc VARCHAR NOT NULL PRIMARY KEY,
  nm_empresa VARCHAR NOT NULL,
  nm_fantasia VARCHAR,
  ds_email VARCHAR,
  nr_telefone VARCHAR,
  dt_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  ie_situacao CHAR(1) NOT NULL DEFAULT 'A' CHECK (ie_situacao IN ('A', 'I'))
);

CREATE INDEX idx_empresa_situacao ON public.empresa(ie_situacao);

-- 2.2 - TABELA: tipo_equipamento
CREATE TABLE public.tipo_equipamento (
  cd_tipo_equipamento SERIAL PRIMARY KEY,
  nm_tipo_equipamento VARCHAR NOT NULL UNIQUE,
  ds_tipo_equipamento VARCHAR,
  ie_situacao CHAR(1) NOT NULL DEFAULT 'A' CHECK (ie_situacao IN ('A', 'I')),
  dt_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_tipo_equipamento_situacao ON public.tipo_equipamento(ie_situacao);

-- 2.3 - TABELA: equipamento (modelo)
CREATE TABLE public.equipamento (
  cd_equipamento SERIAL PRIMARY KEY,
  cd_cgc VARCHAR NOT NULL REFERENCES public.empresa(cd_cgc),
  nm_equipamento VARCHAR NOT NULL,
  ds_equipamento VARCHAR,
  nm_marca VARCHAR,
  nm_modelo VARCHAR,
  dt_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  ie_situacao CHAR(1) NOT NULL DEFAULT 'A' CHECK (ie_situacao IN ('A', 'I')),
  cd_tipo_equipamento INTEGER NOT NULL REFERENCES public.tipo_equipamento(cd_tipo_equipamento)
);

CREATE INDEX idx_equipamento_tipo ON public.equipamento(cd_tipo_equipamento);
CREATE INDEX idx_equipamento_empresa ON public.equipamento(cd_cgc);
CREATE INDEX idx_equipamento_situacao ON public.equipamento(ie_situacao);

-- 2.4 - TABELA: setor
CREATE TABLE public.setor (
  cd_setor SERIAL PRIMARY KEY,
  nm_setor VARCHAR NOT NULL UNIQUE,
  ds_setor VARCHAR,
  ie_situacao CHAR(1) NOT NULL DEFAULT 'A' CHECK (ie_situacao IN ('A', 'I')),
  dt_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_setor_situacao ON public.setor(ie_situacao);

-- 2.5 - TABELA: inventario (instância física)
CREATE TABLE public.inventario (
  nr_inventario SERIAL PRIMARY KEY,
  cd_equipamento INTEGER NOT NULL REFERENCES public.equipamento(cd_equipamento),
  cd_setor INTEGER NOT NULL REFERENCES public.setor(cd_setor),
  nr_patrimonio VARCHAR,
  nr_serie VARCHAR,
  dt_entrada TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  dt_saida TIMESTAMP,
  ie_situacao CHAR(1) NOT NULL DEFAULT 'A' CHECK (ie_situacao IN ('A', 'I', 'M')),
  nr_ip VARCHAR
);

CREATE UNIQUE INDEX uq_inventario_patrimonio ON public.inventario(LOWER(nr_patrimonio));
CREATE INDEX idx_inventario_equipamento ON public.inventario(cd_equipamento);
CREATE INDEX idx_inventario_setor ON public.inventario(cd_setor);
CREATE INDEX idx_inventario_ip ON public.inventario(nr_ip);
CREATE INDEX idx_inventario_situacao ON public.inventario(ie_situacao);

-- 2.6 - TABELA: movimentacao (auditoria de mudanças de setor)
CREATE TABLE public.movimentacao (
  nr_movimentacao SERIAL PRIMARY KEY,
  nr_inventario INTEGER NOT NULL REFERENCES public.inventario(nr_inventario),
  cd_setor_origem INTEGER REFERENCES public.setor(cd_setor),
  cd_setor_destino INTEGER NOT NULL REFERENCES public.setor(cd_setor),
  dt_movimentacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  nm_usuario VARCHAR,
  ds_observacao VARCHAR
);

CREATE INDEX idx_movimentacao_inventario ON public.movimentacao(nr_inventario);
CREATE INDEX idx_movimentacao_data ON public.movimentacao(dt_movimentacao);

-- =========================================================
-- 3. TABELAS DE TELEMETRIA DE IMPRESSORA
-- =========================================================

-- 3.1 - TABELA: suprimentos (estado atual de consumíveis)
CREATE TABLE public.suprimentos (
  nr_suprimento SERIAL PRIMARY KEY,
  nr_inventario INTEGER NOT NULL REFERENCES public.inventario(nr_inventario) ON DELETE CASCADE,
  tp_suprimento VARCHAR NOT NULL, -- ex: 'toner', 'tambor', 'papel', 'kits_manutencao'
  nr_quantidade INTEGER DEFAULT 0,
  nr_quantidade_maxima INTEGER,
  nr_quantidade_minima INTEGER DEFAULT 0,
  ds_suprimento VARCHAR,
  dt_ultima_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ie_situacao CHAR(1) NOT NULL DEFAULT 'A' CHECK (ie_situacao IN ('A', 'I')),
  UNIQUE(nr_inventario, tp_suprimento)
);

CREATE INDEX idx_suprimentos_inventario ON public.suprimentos(nr_inventario);
CREATE INDEX idx_suprimentos_tipo ON public.suprimentos(tp_suprimento);
CREATE INDEX idx_suprimentos_situacao ON public.suprimentos(ie_situacao);

-- Trigger para atualizar data de última atualização
CREATE OR REPLACE FUNCTION public.atualizar_timestamp_suprimentos()
RETURNS TRIGGER AS $$
BEGIN
  NEW.dt_ultima_atualizacao = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_timestamp_suprimentos
BEFORE UPDATE ON public.suprimentos
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_timestamp_suprimentos();

-- 3.2 - TABELA: telemetria_pagecount (histórico de contadores de página)
CREATE TABLE public.telemetria_pagecount (
  nr_telemetria SERIAL PRIMARY KEY,
  nr_inventario INTEGER NOT NULL REFERENCES public.inventario(nr_inventario) ON DELETE CASCADE,
  nr_paginas_total BIGINT DEFAULT 0,
  nr_paginas_coloridas BIGINT DEFAULT 0,
  nr_paginas_pb BIGINT DEFAULT 0,
  nr_paginas_copia BIGINT DEFAULT 0,
  nr_paginas_impressao BIGINT DEFAULT 0,
  nr_paginas_digitalizacao BIGINT DEFAULT 0,
  nr_paginas_fax BIGINT DEFAULT 0,
  dt_leitura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ds_status_impressora VARCHAR, -- ex: 'OK', 'ERRO', 'OFFLINE'
  ds_observacao VARCHAR
);

CREATE INDEX idx_telemetria_pagecount_inventario ON public.telemetria_pagecount(nr_inventario);
CREATE INDEX idx_telemetria_pagecount_data ON public.telemetria_pagecount(dt_leitura);

-- Função para limpar histórico de telemetria com mais de 3 meses
CREATE OR REPLACE FUNCTION public.limpar_telemetria_antiga()
RETURNS void AS $$
BEGIN
  DELETE FROM public.telemetria_pagecount
  WHERE dt_leitura < CURRENT_TIMESTAMP - INTERVAL '3 months';
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 4. AJUSTE FINAL DO SCHEMA DANIEL
-- =========================================================
-- Schema daniel puro criado com sucesso: 6 tabelas core + 2 tabelas telemetria
-- RLS desabilitado para desenvolvimento (ativar após testes)
-- Próximo passo: Executar função de limpeza periodicamente (ex: via cron)

COMMIT;

-- =========================================================
-- NOTAS IMPORTANTES:
-- =========================================================
-- 1. Schema daniel puro: 6 tabelas core + 2 tabelas telemetria = 8 tabelas total
--    Core: empresa, tipo_equipamento, equipamento, setor, inventario, movimentacao
--    Telemetria: suprimentos (estado), telemetria_pagecount (histórico com limpeza 3 meses)
-- 2. Todas as tabelas antigas foram dropadas (nenhum resíduo de v2)
-- 3. RLS desabilitado para desenvolvimento (ativar após testes)
-- 4. Triggers automáticos:
--    - suprimentos: atualiza dt_ultima_atualizacao antes de UPDATE
--    - telemetria_pagecount: função limpar_telemetria_antiga() para remover dados > 3 meses
-- 5. Próximo passo: 
--    a) Inserir dados iniciais (empresa, tipo_equipamento, setor, equipamento, inventario)
--    b) Testar coletor SNMP para validar telemetria


-- ========================================================
-- SOURCE: 20260406_inventario_self_reference.sql
-- ========================================================

-- Auto-relacionamento de inventario (item superior)
-- Permite modelar hierarquia: CPU (pai) -> Monitor/Nobreak/etc (filhos)

ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS nr_invent_sup INTEGER NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_inventario_sup'
      AND conrelid = 'public.inventario'::regclass
  ) THEN
    ALTER TABLE public.inventario
      ADD CONSTRAINT fk_inventario_sup
      FOREIGN KEY (nr_invent_sup)
      REFERENCES public.inventario(nr_inventario)
      ON DELETE SET NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_inventario_sup_not_self'
      AND conrelid = 'public.inventario'::regclass
  ) THEN
    ALTER TABLE public.inventario
      ADD CONSTRAINT ck_inventario_sup_not_self
      CHECK (nr_invent_sup IS NULL OR nr_invent_sup <> nr_inventario);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_inventario_sup
  ON public.inventario(nr_invent_sup);

CREATE OR REPLACE FUNCTION public.fn_inventario_evitar_ciclo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ciclo INTEGER;
BEGIN
  IF NEW.nr_invent_sup IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.nr_invent_sup = NEW.nr_inventario THEN
    RAISE EXCEPTION 'nr_invent_sup nao pode apontar para o proprio registro';
  END IF;

  WITH RECURSIVE cadeia AS (
    SELECT i.nr_inventario, i.nr_invent_sup
    FROM public.inventario i
    WHERE i.nr_inventario = NEW.nr_invent_sup
    UNION ALL
    SELECT p.nr_inventario, p.nr_invent_sup
    FROM public.inventario p
    JOIN cadeia c ON p.nr_inventario = c.nr_invent_sup
  )
  SELECT 1 INTO v_ciclo
  FROM cadeia
  WHERE nr_inventario = NEW.nr_inventario
  LIMIT 1;

  IF v_ciclo = 1 THEN
    RAISE EXCEPTION 'Ciclo hierarquico detectado no inventario';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventario_evitar_ciclo ON public.inventario;

CREATE TRIGGER trg_inventario_evitar_ciclo
BEFORE INSERT OR UPDATE OF nr_invent_sup ON public.inventario
FOR EACH ROW
EXECUTE FUNCTION public.fn_inventario_evitar_ciclo();


-- ========================================================
-- SOURCE: 20260407_hierarquia_status_rules.sql
-- ========================================================

-- Hierarquia de equipamento + status operacional de inventario
-- Regra: obrigatoriedade de vinculo depende de tp_hierarquia e tp_status

BEGIN;

ALTER TABLE public.equipamento
  ADD COLUMN IF NOT EXISTS tp_hierarquia VARCHAR(10);

UPDATE public.equipamento
SET tp_hierarquia = COALESCE(tp_hierarquia, 'AMBOS');

ALTER TABLE public.equipamento
  ALTER COLUMN tp_hierarquia SET DEFAULT 'AMBOS';

ALTER TABLE public.equipamento
  ALTER COLUMN tp_hierarquia SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_equipamento_tp_hierarquia'
      AND conrelid = 'public.equipamento'::regclass
  ) THEN
    ALTER TABLE public.equipamento
      ADD CONSTRAINT ck_equipamento_tp_hierarquia
      CHECK (tp_hierarquia IN ('RAIZ', 'FILHO', 'AMBOS'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_equipamento_tp_hierarquia
  ON public.equipamento(tp_hierarquia);

ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS nr_invent_sup INTEGER NULL;

ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS tp_status VARCHAR(15);

UPDATE public.inventario
SET tp_status = COALESCE(
  tp_status,
  CASE
    WHEN ie_situacao = 'M' THEN 'MANUTENCAO'
    WHEN ie_situacao = 'I' THEN 'BACKUP'
    ELSE 'ATIVO'
  END
);

ALTER TABLE public.inventario
  ALTER COLUMN tp_status SET DEFAULT 'ATIVO';

ALTER TABLE public.inventario
  ALTER COLUMN tp_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_inventario_tp_status'
      AND conrelid = 'public.inventario'::regclass
  ) THEN
    ALTER TABLE public.inventario
      ADD CONSTRAINT ck_inventario_tp_status
      CHECK (tp_status IN ('ATIVO', 'MANUTENCAO', 'BACKUP'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_inventario_tp_status
  ON public.inventario(tp_status);

CREATE OR REPLACE FUNCTION public.fn_inventario_validar_hierarquia_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tp_hierarquia VARCHAR(10);
  v_parent_setor INTEGER;
BEGIN
  SELECT e.tp_hierarquia
    INTO v_tp_hierarquia
  FROM public.equipamento e
  WHERE e.cd_equipamento = NEW.cd_equipamento;

  IF v_tp_hierarquia IS NULL THEN
    RAISE EXCEPTION 'Equipamento % sem tp_hierarquia definido', NEW.cd_equipamento;
  END IF;

  IF v_tp_hierarquia = 'RAIZ' AND NEW.nr_invent_sup IS NOT NULL THEN
    RAISE EXCEPTION 'Equipamento com tp_hierarquia=RAIZ nao pode ter item superior';
  END IF;

  IF v_tp_hierarquia = 'FILHO' AND NEW.tp_status = 'ATIVO' AND NEW.nr_invent_sup IS NULL THEN
    RAISE EXCEPTION 'Equipamento com tp_hierarquia=FILHO e tp_status=ATIVO exige nr_invent_sup';
  END IF;

  IF NEW.nr_invent_sup IS NOT NULL THEN
    SELECT i.cd_setor
      INTO v_parent_setor
    FROM public.inventario i
    WHERE i.nr_inventario = NEW.nr_invent_sup;

    IF v_parent_setor IS NULL THEN
      RAISE EXCEPTION 'Item superior % nao encontrado', NEW.nr_invent_sup;
    END IF;

    IF NEW.cd_setor <> v_parent_setor THEN
      RAISE EXCEPTION 'Item filho deve permanecer no mesmo setor do item superior';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventario_validar_hierarquia_status ON public.inventario;

CREATE TRIGGER trg_inventario_validar_hierarquia_status
BEFORE INSERT OR UPDATE OF cd_equipamento, nr_invent_sup, tp_status, cd_setor ON public.inventario
FOR EACH ROW
EXECUTE FUNCTION public.fn_inventario_validar_hierarquia_status();

COMMIT;



-- ========================================================
-- SOURCE: 20260428_auditoria_inventario_compat_nm_usuario.sql
-- ========================================================

BEGIN;

-- =========================================================
-- AJUSTE DE AUDITORIA (COMPATIVEL COM MOVIMENTACAO.nm_usuario)
-- Contexto:
-- - Alguns ambientes nao possuem movimentacao.cd_usuario.
-- - A auditoria do inventario deve funcionar com nm_usuario.
-- =========================================================

ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS cd_usuario_criacao INTEGER,
  ADD COLUMN IF NOT EXISTS cd_usuario_ultima_alteracao INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_inventario_usuario_criacao'
      AND conrelid = 'public.inventario'::regclass
  ) THEN
    ALTER TABLE public.inventario
      ADD CONSTRAINT fk_inventario_usuario_criacao
      FOREIGN KEY (cd_usuario_criacao)
      REFERENCES public.usuario(cd_usuario)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_inventario_usuario_ultima_alteracao'
      AND conrelid = 'public.inventario'::regclass
  ) THEN
    ALTER TABLE public.inventario
      ADD CONSTRAINT fk_inventario_usuario_ultima_alteracao
      FOREIGN KEY (cd_usuario_ultima_alteracao)
      REFERENCES public.usuario(cd_usuario)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_inventario_usuario_criacao
  ON public.inventario (cd_usuario_criacao);

CREATE INDEX IF NOT EXISTS idx_inventario_usuario_ultima_alteracao
  ON public.inventario (cd_usuario_ultima_alteracao);

CREATE OR REPLACE FUNCTION public.fn_inventario_touch_dt_atualizacao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- So atualiza se a coluna existir no schema atual.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventario'
      AND column_name = 'dt_atualizacao'
  ) THEN
    NEW.dt_atualizacao = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventario_touch_dt_atualizacao ON public.inventario;

CREATE TRIGGER trg_inventario_touch_dt_atualizacao
BEFORE UPDATE ON public.inventario
FOR EACH ROW
EXECUTE FUNCTION public.fn_inventario_touch_dt_atualizacao();

CREATE OR REPLACE FUNCTION public.fn_inventario_auditoria_fill()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_nm_usuario TEXT;
  v_cd_usuario INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.cd_usuario_criacao IS NULL THEN
      SELECT m.nm_usuario
        INTO v_nm_usuario
      FROM public.movimentacao m
      WHERE m.nr_inventario = NEW.nr_inventario
        AND m.nm_usuario IS NOT NULL
        AND BTRIM(m.nm_usuario) <> ''
      ORDER BY m.dt_movimentacao DESC
      LIMIT 1;

      IF v_nm_usuario IS NOT NULL THEN
        SELECT u.cd_usuario
          INTO v_cd_usuario
        FROM public.usuario u
        WHERE LOWER(BTRIM(u.nm_usuario)) = LOWER(BTRIM(v_nm_usuario))
        LIMIT 1;
      ELSE
        v_cd_usuario := NULL;
      END IF;

      NEW.cd_usuario_criacao := v_cd_usuario;
    END IF;

    IF NEW.cd_usuario_ultima_alteracao IS NULL THEN
      NEW.cd_usuario_ultima_alteracao := NEW.cd_usuario_criacao;
    END IF;
  ELSE
    IF NEW.cd_usuario_ultima_alteracao IS NULL THEN
      SELECT m.nm_usuario
        INTO v_nm_usuario
      FROM public.movimentacao m
      WHERE m.nr_inventario = NEW.nr_inventario
        AND m.nm_usuario IS NOT NULL
        AND BTRIM(m.nm_usuario) <> ''
      ORDER BY m.dt_movimentacao DESC
      LIMIT 1;

      IF v_nm_usuario IS NOT NULL THEN
        SELECT u.cd_usuario
          INTO v_cd_usuario
        FROM public.usuario u
        WHERE LOWER(BTRIM(u.nm_usuario)) = LOWER(BTRIM(v_nm_usuario))
        LIMIT 1;
      ELSE
        v_cd_usuario := NULL;
      END IF;

      NEW.cd_usuario_ultima_alteracao :=
        COALESCE(v_cd_usuario, OLD.cd_usuario_ultima_alteracao, OLD.cd_usuario_criacao);
    END IF;

    IF OLD.cd_usuario_criacao IS NOT NULL
       AND NEW.cd_usuario_criacao IS DISTINCT FROM OLD.cd_usuario_criacao THEN
      NEW.cd_usuario_criacao := OLD.cd_usuario_criacao;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventario_auditoria_fill ON public.inventario;

CREATE TRIGGER trg_inventario_auditoria_fill
BEFORE INSERT OR UPDATE ON public.inventario
FOR EACH ROW
EXECUTE FUNCTION public.fn_inventario_auditoria_fill();

-- Backfill legado
WITH primeira_mov AS (
  SELECT DISTINCT ON (m.nr_inventario)
    m.nr_inventario,
    m.nm_usuario
  FROM public.movimentacao m
  WHERE m.nm_usuario IS NOT NULL
    AND BTRIM(m.nm_usuario) <> ''
  ORDER BY m.nr_inventario, m.dt_movimentacao ASC
)
UPDATE public.inventario inv
SET cd_usuario_criacao = u.cd_usuario
FROM primeira_mov pm
JOIN public.usuario u
  ON LOWER(BTRIM(u.nm_usuario)) = LOWER(BTRIM(pm.nm_usuario))
WHERE inv.nr_inventario = pm.nr_inventario
  AND inv.cd_usuario_criacao IS NULL;

UPDATE public.inventario inv
SET cd_usuario_criacao = adm.cd_usuario
FROM (
  SELECT cd_usuario
  FROM public.usuario
  WHERE LOWER(BTRIM(ds_login)) = 'admin'
  LIMIT 1
) adm
WHERE inv.cd_usuario_criacao IS NULL;

UPDATE public.inventario
SET cd_usuario_ultima_alteracao = cd_usuario_criacao
WHERE cd_usuario_ultima_alteracao IS NULL;

COMMIT;
-- ========================================================
-- SOURCE: 20260408_inventario_gerenciamento_full.sql
-- ========================================================

-- Inventario: hierarquia, status operacional, imagem e staging de consolidado mensal
-- Aplicar apos: 20260402_migrate_daniel_to_public.sql

BEGIN;

-- =========================================================
-- 1) EQUIPAMENTO: regra estrutural esperada (tp_hierarquia)
-- =========================================================
ALTER TABLE public.equipamento
  ADD COLUMN IF NOT EXISTS tp_hierarquia VARCHAR(10);

UPDATE public.equipamento
SET tp_hierarquia = COALESCE(tp_hierarquia, 'AMBOS');

ALTER TABLE public.equipamento
  ALTER COLUMN tp_hierarquia SET DEFAULT 'AMBOS';

ALTER TABLE public.equipamento
  ALTER COLUMN tp_hierarquia SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_equipamento_tp_hierarquia'
      AND conrelid = 'public.equipamento'::regclass
  ) THEN
    ALTER TABLE public.equipamento
      DROP CONSTRAINT ck_equipamento_tp_hierarquia;
  END IF;

  ALTER TABLE public.equipamento
    ADD CONSTRAINT ck_equipamento_tp_hierarquia
    CHECK (tp_hierarquia IN ('RAIZ', 'FILHO', 'AMBOS'));
END;
$$;

CREATE INDEX IF NOT EXISTS idx_equipamento_tp_hierarquia
  ON public.equipamento(tp_hierarquia);

-- =========================================================
-- 2) INVENTARIO: auto-relacionamento, status e imagem
-- =========================================================
ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS nr_invent_sup INTEGER NULL;

ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS tp_status VARCHAR(15);

ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS ds_imagem_url VARCHAR;

UPDATE public.inventario
SET tp_status = COALESCE(
  tp_status,
  CASE
    WHEN ie_situacao = 'M' THEN 'MANUTENCAO'
    WHEN ie_situacao = 'I' THEN 'BACKUP'
    ELSE 'ATIVO'
  END
);

ALTER TABLE public.inventario
  ALTER COLUMN tp_status SET DEFAULT 'ATIVO';

ALTER TABLE public.inventario
  ALTER COLUMN tp_status SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_inventario_tp_status'
      AND conrelid = 'public.inventario'::regclass
  ) THEN
    ALTER TABLE public.inventario
      DROP CONSTRAINT ck_inventario_tp_status;
  END IF;

  ALTER TABLE public.inventario
    ADD CONSTRAINT ck_inventario_tp_status
    CHECK (tp_status IN ('ATIVO', 'MANUTENCAO', 'BACKUP', 'DEVOLUCAO'));
END;
$$;

CREATE INDEX IF NOT EXISTS idx_inventario_tp_status
  ON public.inventario(tp_status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_inventario_sup'
      AND conrelid = 'public.inventario'::regclass
  ) THEN
    ALTER TABLE public.inventario
      ADD CONSTRAINT fk_inventario_sup
      FOREIGN KEY (nr_invent_sup)
      REFERENCES public.inventario(nr_inventario)
      ON DELETE SET NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_inventario_sup_not_self'
      AND conrelid = 'public.inventario'::regclass
  ) THEN
    ALTER TABLE public.inventario
      ADD CONSTRAINT ck_inventario_sup_not_self
      CHECK (nr_invent_sup IS NULL OR nr_invent_sup <> nr_inventario);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_inventario_sup
  ON public.inventario(nr_invent_sup);

-- Evita ciclos: A -> B -> C -> A
CREATE OR REPLACE FUNCTION public.fn_inventario_evitar_ciclo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ciclo INTEGER;
BEGIN
  IF NEW.nr_invent_sup IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.nr_invent_sup = NEW.nr_inventario THEN
    RAISE EXCEPTION 'nr_invent_sup nao pode apontar para o proprio registro';
  END IF;

  WITH RECURSIVE cadeia AS (
    SELECT i.nr_inventario, i.nr_invent_sup
    FROM public.inventario i
    WHERE i.nr_inventario = NEW.nr_invent_sup

    UNION ALL

    SELECT p.nr_inventario, p.nr_invent_sup
    FROM public.inventario p
    JOIN cadeia c ON p.nr_inventario = c.nr_invent_sup
  )
  SELECT 1 INTO v_ciclo
  FROM cadeia
  WHERE nr_inventario = NEW.nr_inventario
  LIMIT 1;

  IF v_ciclo = 1 THEN
    RAISE EXCEPTION 'Ciclo hierarquico detectado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventario_evitar_ciclo ON public.inventario;

CREATE TRIGGER trg_inventario_evitar_ciclo
BEFORE INSERT OR UPDATE OF nr_invent_sup ON public.inventario
FOR EACH ROW
EXECUTE FUNCTION public.fn_inventario_evitar_ciclo();

-- Valida regra de negocio combinando tp_hierarquia + tp_status
CREATE OR REPLACE FUNCTION public.fn_inventario_validar_hierarquia_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tp_hierarquia VARCHAR(10);
  v_parent_setor INTEGER;
BEGIN
  SELECT e.tp_hierarquia
    INTO v_tp_hierarquia
  FROM public.equipamento e
  WHERE e.cd_equipamento = NEW.cd_equipamento;

  IF v_tp_hierarquia IS NULL THEN
    RAISE EXCEPTION 'Equipamento % sem tp_hierarquia definido', NEW.cd_equipamento;
  END IF;

  IF v_tp_hierarquia = 'RAIZ' AND NEW.nr_invent_sup IS NOT NULL THEN
    RAISE EXCEPTION 'Equipamento com tp_hierarquia=RAIZ nao pode ter item superior';
  END IF;

  IF v_tp_hierarquia = 'FILHO' AND NEW.tp_status = 'ATIVO' AND NEW.nr_invent_sup IS NULL THEN
    RAISE EXCEPTION 'Equipamento FILHO em status ATIVO exige nr_invent_sup';
  END IF;

  IF NEW.nr_invent_sup IS NOT NULL THEN
    SELECT i.cd_setor
      INTO v_parent_setor
    FROM public.inventario i
    WHERE i.nr_inventario = NEW.nr_invent_sup;

    IF v_parent_setor IS NULL THEN
      RAISE EXCEPTION 'Item superior % nao encontrado', NEW.nr_invent_sup;
    END IF;

    IF NEW.cd_setor <> v_parent_setor THEN
      RAISE EXCEPTION 'Item filho deve permanecer no mesmo setor do item superior';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventario_validar_hierarquia_status ON public.inventario;

CREATE TRIGGER trg_inventario_validar_hierarquia_status
BEFORE INSERT OR UPDATE OF cd_equipamento, nr_invent_sup, tp_status, cd_setor ON public.inventario
FOR EACH ROW
EXECUTE FUNCTION public.fn_inventario_validar_hierarquia_status();

-- =========================================================
-- 3) STAGING CONSOLIDADO MENSAL
--    Estrategia: substituir dados da competencia (MM/YYYY)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.inventario_consolidado_carga (
  nr_carga SERIAL PRIMARY KEY,
  nr_competencia VARCHAR(7) NOT NULL,
  cd_cgc VARCHAR,
  nm_empresa VARCHAR,
  nm_arquivo VARCHAR NOT NULL,
  nr_total_linhas INTEGER NOT NULL DEFAULT 0,
  dt_importacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ds_observacao VARCHAR,
  CONSTRAINT ck_inventario_consolidado_competencia
    CHECK (nr_competencia ~ '^(0[1-9]|1[0-2])/[0-9]{4}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventario_consolidado_competencia_empresa
  ON public.inventario_consolidado_carga(nr_competencia, cd_cgc);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_inventario_consolidado_carga_empresa'
  ) THEN
    ALTER TABLE public.inventario_consolidado_carga
      ADD CONSTRAINT fk_inventario_consolidado_carga_empresa
      FOREIGN KEY (cd_cgc)
      REFERENCES public.empresa(cd_cgc)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.inventario_consolidado_linha (
  nr_linha_consolidado SERIAL PRIMARY KEY,
  nr_carga INTEGER NOT NULL REFERENCES public.inventario_consolidado_carga(nr_carga) ON DELETE CASCADE,
  nr_linha INTEGER NOT NULL,
  cd_cliente VARCHAR,
  nr_loja_cliente VARCHAR,
  nm_cliente VARCHAR,
  nr_cnpj_cliente VARCHAR,
  nr_contrato_legado VARCHAR,
  nr_projeto VARCHAR,
  nr_obra VARCHAR,
  nr_cnpj_remessa VARCHAR,
  nr_nf_remessa VARCHAR,
  dt_remessa TIMESTAMP,
  nr_id_equipamento VARCHAR,
  nr_patrimonio VARCHAR,
  nm_tipo VARCHAR,
  ds_produto VARCHAR,
  nr_quantidade VARCHAR,
  vl_origem VARCHAR,
  vl_unitario VARCHAR,
  vl_bruto VARCHAR,
  vl_acrescimo VARCHAR,
  dt_prev_entr TIMESTAMP,
  dt_ativacao TIMESTAMP,
  nr_dias_locacao VARCHAR,
  dt_aniversario TIMESTAMP,
  nm_indice_reajuste VARCHAR,
  nr_indice_aplicado VARCHAR,
  ds_calculo_reajuste VARCHAR,
  nr_pedido_faturamento VARCHAR,
  vl_total_gerado VARCHAR,
  nr_nf_faturamento VARCHAR,
  dt_faturamento TIMESTAMP,
  nr_cnpj_faturamento VARCHAR,
  nr_qtde_faturamento VARCHAR,
  vl_total_faturamento VARCHAR,
  ds_periodo_faturamento VARCHAR,
  nr_serie VARCHAR,
  ds_observacao_linha VARCHAR,
  nm_hostname VARCHAR,
  nm_local VARCHAR,
  tp_status VARCHAR(15),
  dados_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  dt_cadastro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_inventario_consolidado_linha_status
    CHECK (tp_status IS NULL OR tp_status IN ('ATIVO', 'MANUTENCAO', 'BACKUP', 'DEVOLUCAO'))
);

ALTER TABLE public.inventario_consolidado_linha
  ADD COLUMN IF NOT EXISTS cd_cliente VARCHAR,
  ADD COLUMN IF NOT EXISTS nr_loja_cliente VARCHAR,
  ADD COLUMN IF NOT EXISTS nm_cliente VARCHAR,
  ADD COLUMN IF NOT EXISTS nr_cnpj_cliente VARCHAR,
  ADD COLUMN IF NOT EXISTS nr_contrato_legado VARCHAR,
  ADD COLUMN IF NOT EXISTS nr_projeto VARCHAR,
  ADD COLUMN IF NOT EXISTS nr_obra VARCHAR,
  ADD COLUMN IF NOT EXISTS nr_cnpj_remessa VARCHAR,
  ADD COLUMN IF NOT EXISTS nr_nf_remessa VARCHAR,
  ADD COLUMN IF NOT EXISTS dt_remessa TIMESTAMP,
  ADD COLUMN IF NOT EXISTS nr_id_equipamento VARCHAR,
  ADD COLUMN IF NOT EXISTS nr_patrimonio VARCHAR,
  ADD COLUMN IF NOT EXISTS nm_tipo VARCHAR,
  ADD COLUMN IF NOT EXISTS ds_produto VARCHAR,
  ADD COLUMN IF NOT EXISTS nr_quantidade VARCHAR,
  ADD COLUMN IF NOT EXISTS vl_origem VARCHAR,
  ADD COLUMN IF NOT EXISTS vl_unitario VARCHAR,
  ADD COLUMN IF NOT EXISTS vl_bruto VARCHAR,
  ADD COLUMN IF NOT EXISTS vl_acrescimo VARCHAR,
  ADD COLUMN IF NOT EXISTS dt_prev_entr TIMESTAMP,
  ADD COLUMN IF NOT EXISTS dt_ativacao TIMESTAMP,
  ADD COLUMN IF NOT EXISTS nr_dias_locacao VARCHAR,
  ADD COLUMN IF NOT EXISTS dt_aniversario TIMESTAMP,
  ADD COLUMN IF NOT EXISTS nm_indice_reajuste VARCHAR,
  ADD COLUMN IF NOT EXISTS nr_indice_aplicado VARCHAR,
  ADD COLUMN IF NOT EXISTS ds_calculo_reajuste VARCHAR,
  ADD COLUMN IF NOT EXISTS nr_pedido_faturamento VARCHAR,
  ADD COLUMN IF NOT EXISTS vl_total_gerado VARCHAR,
  ADD COLUMN IF NOT EXISTS nr_nf_faturamento VARCHAR,
  ADD COLUMN IF NOT EXISTS dt_faturamento TIMESTAMP,
  ADD COLUMN IF NOT EXISTS nr_cnpj_faturamento VARCHAR,
  ADD COLUMN IF NOT EXISTS nr_qtde_faturamento VARCHAR,
  ADD COLUMN IF NOT EXISTS vl_total_faturamento VARCHAR,
  ADD COLUMN IF NOT EXISTS ds_periodo_faturamento VARCHAR,
  ADD COLUMN IF NOT EXISTS nr_serie VARCHAR,
  ADD COLUMN IF NOT EXISTS ds_observacao_linha VARCHAR,
  ADD COLUMN IF NOT EXISTS nm_hostname VARCHAR,
  ADD COLUMN IF NOT EXISTS nm_local VARCHAR,
  ADD COLUMN IF NOT EXISTS tp_status VARCHAR(15),
  ADD COLUMN IF NOT EXISTS dados_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dt_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public.inventario_consolidado_carga
  ADD COLUMN IF NOT EXISTS cd_cgc VARCHAR,
  ADD COLUMN IF NOT EXISTS nm_empresa VARCHAR;

UPDATE public.inventario_consolidado_carga AS c
SET nm_empresa = e.nm_empresa
FROM public.empresa AS e
WHERE c.cd_cgc IS NOT NULL
  AND c.cd_cgc = e.cd_cgc
  AND (c.nm_empresa IS NULL OR btrim(c.nm_empresa) = '');

DROP INDEX IF EXISTS uq_inventario_consolidado_competencia;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventario_consolidado_competencia_empresa
  ON public.inventario_consolidado_carga(nr_competencia, cd_cgc);

CREATE INDEX IF NOT EXISTS idx_inventario_consolidado_carga_empresa_importacao
  ON public.inventario_consolidado_carga(cd_cgc, dt_importacao DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_inventario_consolidado_carga_empresa'
  ) THEN
    ALTER TABLE public.inventario_consolidado_carga
      ADD CONSTRAINT fk_inventario_consolidado_carga_empresa
      FOREIGN KEY (cd_cgc)
      REFERENCES public.empresa(cd_cgc)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventario_consolidado_linha_carga_linha
  ON public.inventario_consolidado_linha(nr_carga, nr_linha);

CREATE INDEX IF NOT EXISTS idx_inventario_consolidado_linha_patrimonio
  ON public.inventario_consolidado_linha(LOWER(nr_patrimonio));

CREATE INDEX IF NOT EXISTS idx_inventario_consolidado_linha_hostname
  ON public.inventario_consolidado_linha(LOWER(nm_hostname));

CREATE INDEX IF NOT EXISTS idx_inventario_consolidado_linha_serie
  ON public.inventario_consolidado_linha(LOWER(nr_serie));

CREATE INDEX IF NOT EXISTS idx_inventario_consolidado_linha_id_equipamento
  ON public.inventario_consolidado_linha(LOWER(nr_id_equipamento));

-- =========================================================
-- 4) STORAGE: bucket para imagens do inventario
-- =========================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inventario-imagens',
  'inventario-imagens',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

COMMIT;


-- ========================================================
-- SOURCE: 20260420_setor_piso_modelo_final.sql
-- ========================================================

-- Evolucao consolidada: piso como entidade propria, setor por cd_piso e view de exibicao
-- Esta migration substitui o bloco de transicao anterior.

BEGIN;

-- =========================================================
-- 1) SETOR/INVENTARIO: colunas auxiliares
-- =========================================================
ALTER TABLE public.setor
  ADD COLUMN IF NOT EXISTS nm_localizacao VARCHAR;

CREATE INDEX IF NOT EXISTS idx_setor_localizacao
  ON public.setor (LOWER(BTRIM(COALESCE(nm_localizacao, ''))));

ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS nm_hostname VARCHAR;

ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS nm_mac VARCHAR;

CREATE INDEX IF NOT EXISTS idx_inventario_hostname
  ON public.inventario (LOWER(BTRIM(COALESCE(nm_hostname, ''))));

CREATE INDEX IF NOT EXISTS idx_inventario_mac
  ON public.inventario (LOWER(BTRIM(COALESCE(nm_mac, ''))));

-- =========================================================
-- 2) PISO: entidade canonica
-- =========================================================
CREATE TABLE IF NOT EXISTS public.piso (
  cd_piso SERIAL PRIMARY KEY,
  nm_piso VARCHAR NOT NULL,
  ds_piso VARCHAR,
  ie_situacao CHAR(1) NOT NULL DEFAULT 'A',
  dt_atualizacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_piso_situacao CHECK (ie_situacao IN ('A', 'I'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_piso_nm_piso_ci
  ON public.piso (LOWER(BTRIM(nm_piso)));

CREATE INDEX IF NOT EXISTS idx_piso_situacao
  ON public.piso (ie_situacao);

-- =========================================================
-- 3) SETOR -> PISO: migracao de dados e constraints
-- =========================================================
ALTER TABLE public.setor
  ADD COLUMN IF NOT EXISTS cd_piso INTEGER;

DO $$
DECLARE
  v_has_nm_piso BOOLEAN;
  v_cd_piso_nao_informado INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'setor'
      AND column_name = 'nm_piso'
  ) INTO v_has_nm_piso;

  IF v_has_nm_piso THEN
    EXECUTE $sql$
      INSERT INTO public.piso (nm_piso, ds_piso, ie_situacao)
      SELECT DISTINCT
        COALESCE(NULLIF(BTRIM(s.nm_piso), ''), 'NAO INFORMADO') AS nm_piso,
        NULL AS ds_piso,
        'A' AS ie_situacao
      FROM public.setor s
      ON CONFLICT DO NOTHING
    $sql$;
  END IF;

  INSERT INTO public.piso (nm_piso, ds_piso, ie_situacao)
  SELECT 'NAO INFORMADO', NULL, 'A'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.piso p
    WHERE LOWER(BTRIM(p.nm_piso)) = LOWER(BTRIM('NAO INFORMADO'))
  );

  SELECT p.cd_piso
    INTO v_cd_piso_nao_informado
  FROM public.piso p
  WHERE LOWER(BTRIM(p.nm_piso)) = LOWER(BTRIM('NAO INFORMADO'))
  ORDER BY p.cd_piso
  LIMIT 1;

  IF v_has_nm_piso THEN
    EXECUTE $sql$
      UPDATE public.setor s
      SET cd_piso = p.cd_piso
      FROM public.piso p
      WHERE s.cd_piso IS NULL
        AND LOWER(BTRIM(COALESCE(s.nm_piso, 'NAO INFORMADO'))) = LOWER(BTRIM(p.nm_piso))
    $sql$;
  END IF;

  IF v_cd_piso_nao_informado IS NULL THEN
    RAISE EXCEPTION 'Nao foi possivel localizar/criar piso padrao NAO INFORMADO';
  END IF;

  UPDATE public.setor
  SET cd_piso = v_cd_piso_nao_informado
  WHERE cd_piso IS NULL;
END;
$$;

ALTER TABLE public.setor
  ALTER COLUMN cd_piso SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_setor_piso'
      AND conrelid = 'public.setor'::regclass
  ) THEN
    ALTER TABLE public.setor
      ADD CONSTRAINT fk_setor_piso
      FOREIGN KEY (cd_piso)
      REFERENCES public.piso(cd_piso)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END;
$$;

ALTER TABLE public.setor
  DROP CONSTRAINT IF EXISTS setor_nm_setor_key;

DROP INDEX IF EXISTS public.uq_setor_piso_setor_localizacao;

CREATE UNIQUE INDEX IF NOT EXISTS uq_setor_cd_piso_setor_localizacao
  ON public.setor (
    cd_piso,
    LOWER(BTRIM(nm_setor)),
    LOWER(BTRIM(COALESCE(nm_localizacao, '')))
  );

DROP INDEX IF EXISTS public.idx_setor_piso;

CREATE INDEX IF NOT EXISTS idx_setor_cd_piso
  ON public.setor (cd_piso);

-- =========================================================
-- 4) Limpeza da compatibilidade legada
-- =========================================================
DROP TRIGGER IF EXISTS trg_setor_sync_nm_piso_from_cd_piso ON public.setor;
DROP TRIGGER IF EXISTS trg_piso_propagar_nome_para_setor ON public.piso;
DROP FUNCTION IF EXISTS public.fn_setor_sync_nm_piso_from_cd_piso();
DROP FUNCTION IF EXISTS public.fn_piso_propagar_nome_para_setor();

ALTER TABLE public.setor
  DROP COLUMN IF EXISTS nm_piso;

-- =========================================================
-- 5) View padrao para exibicao: setor + piso
-- =========================================================
CREATE OR REPLACE VIEW public.vw_setor
WITH (security_invoker = true)
AS
SELECT
  s.cd_setor,
  s.cd_piso,
  s.nm_setor,
  s.nm_localizacao,
  p.nm_piso,
  s.ds_setor,
  s.ie_situacao,
  s.dt_atualizacao
FROM public.setor s
JOIN public.piso p
  ON p.cd_piso = s.cd_piso;

GRANT SELECT ON public.vw_setor TO anon, authenticated, service_role;

COMMIT;



-- ========================================================
-- SOURCE: 20260427_auth_rbac_auditoria.sql
-- ========================================================

BEGIN;

-- =========================================================
-- 1) PERFIL (RBAC)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.perfil (
  cd_perfil SERIAL PRIMARY KEY,
  nm_perfil VARCHAR(30) NOT NULL,
  ds_perfil VARCHAR,
  ie_situacao CHAR(1) NOT NULL DEFAULT 'A',
  dt_cadastro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_perfil_situacao CHECK (ie_situacao IN ('A', 'I')),
  CONSTRAINT uq_perfil_nome UNIQUE (nm_perfil)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_perfil_nm_perfil_ci
  ON public.perfil (LOWER(BTRIM(nm_perfil)));

CREATE INDEX IF NOT EXISTS idx_perfil_situacao
  ON public.perfil (ie_situacao);

INSERT INTO public.perfil (nm_perfil, ds_perfil, ie_situacao)
VALUES
  ('ADMIN', 'Acesso total ao sistema e gestao de usuarios', 'A'),
  ('COLABORADOR', 'Operacao do inventario sem gestao de usuarios', 'A'),
  ('VIEWER', 'Acesso somente leitura', 'A')
ON CONFLICT (nm_perfil)
DO UPDATE SET
  ds_perfil = EXCLUDED.ds_perfil,
  ie_situacao = EXCLUDED.ie_situacao;

-- =========================================================
-- 2) USUARIO (autenticacao e vinculo com perfil)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.usuario (
  cd_usuario SERIAL PRIMARY KEY,
  nm_usuario VARCHAR NOT NULL,
  ds_email VARCHAR NOT NULL,
  ds_login VARCHAR NOT NULL,
  ds_senha_hash VARCHAR NOT NULL,
  auth_user_id UUID,
  cd_perfil INTEGER NOT NULL,
  ie_situacao CHAR(1) NOT NULL DEFAULT 'A',
  dt_ultimo_login TIMESTAMP,
  dt_cadastro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dt_atualizacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cd_usuario_criacao INTEGER,
  cd_usuario_ultima_alteracao INTEGER
);

ALTER TABLE public.usuario
  ADD COLUMN IF NOT EXISTS nm_usuario VARCHAR,
  ADD COLUMN IF NOT EXISTS ds_email VARCHAR,
  ADD COLUMN IF NOT EXISTS ds_login VARCHAR,
  ADD COLUMN IF NOT EXISTS ds_senha_hash VARCHAR,
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS cd_perfil INTEGER,
  ADD COLUMN IF NOT EXISTS ie_situacao CHAR(1) DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS dt_ultimo_login TIMESTAMP,
  ADD COLUMN IF NOT EXISTS dt_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS dt_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cd_usuario_criacao INTEGER,
  ADD COLUMN IF NOT EXISTS cd_usuario_ultima_alteracao INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_usuario_perfil'
      AND conrelid = 'public.usuario'::regclass
  ) THEN
    ALTER TABLE public.usuario
      ADD CONSTRAINT fk_usuario_perfil
      FOREIGN KEY (cd_perfil)
      REFERENCES public.perfil(cd_perfil)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_usuario_auth_user'
      AND conrelid = 'public.usuario'::regclass
  ) THEN
    ALTER TABLE public.usuario
      ADD CONSTRAINT fk_usuario_auth_user
      FOREIGN KEY (auth_user_id)
      REFERENCES auth.users(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_usuario_criacao'
      AND conrelid = 'public.usuario'::regclass
  ) THEN
    ALTER TABLE public.usuario
      ADD CONSTRAINT fk_usuario_criacao
      FOREIGN KEY (cd_usuario_criacao)
      REFERENCES public.usuario(cd_usuario)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_usuario_ultima_alteracao'
      AND conrelid = 'public.usuario'::regclass
  ) THEN
    ALTER TABLE public.usuario
      ADD CONSTRAINT fk_usuario_ultima_alteracao
      FOREIGN KEY (cd_usuario_ultima_alteracao)
      REFERENCES public.usuario(cd_usuario)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_usuario_situacao'
      AND conrelid = 'public.usuario'::regclass
  ) THEN
    ALTER TABLE public.usuario
      ADD CONSTRAINT ck_usuario_situacao CHECK (ie_situacao IN ('A', 'I'));
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_login_ci
  ON public.usuario (LOWER(BTRIM(ds_login)));

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_email_ci
  ON public.usuario (LOWER(BTRIM(ds_email)));

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_auth_user_id
  ON public.usuario (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usuario_perfil
  ON public.usuario (cd_perfil);

CREATE INDEX IF NOT EXISTS idx_usuario_situacao
  ON public.usuario (ie_situacao);

-- =========================================================
-- 2.1) USUARIO_PERFIL (vinculos multiplos de perfil)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.usuario_perfil (
  cd_usuario_perfil SERIAL PRIMARY KEY,
  cd_usuario INTEGER NOT NULL REFERENCES public.usuario(cd_usuario) ON UPDATE CASCADE ON DELETE CASCADE,
  cd_perfil INTEGER NOT NULL REFERENCES public.perfil(cd_perfil) ON UPDATE CASCADE ON DELETE RESTRICT,
  ie_situacao CHAR(1) NOT NULL DEFAULT 'A',
  dt_cadastro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_usuario_perfil_situacao CHECK (ie_situacao IN ('A', 'I')),
  CONSTRAINT uq_usuario_perfil UNIQUE (cd_usuario, cd_perfil)
);

CREATE INDEX IF NOT EXISTS idx_usuario_perfil_usuario
  ON public.usuario_perfil (cd_usuario);

CREATE INDEX IF NOT EXISTS idx_usuario_perfil_perfil
  ON public.usuario_perfil (cd_perfil);

INSERT INTO public.usuario_perfil (cd_usuario, cd_perfil, ie_situacao)
SELECT u.cd_usuario, u.cd_perfil, 'A'
FROM public.usuario u
WHERE u.cd_perfil IS NOT NULL
ON CONFLICT (cd_usuario, cd_perfil)
DO UPDATE SET ie_situacao = EXCLUDED.ie_situacao;

CREATE OR REPLACE FUNCTION public.fn_usuario_touch_dt_atualizacao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.dt_atualizacao = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_usuario_touch_dt_atualizacao ON public.usuario;

CREATE TRIGGER trg_usuario_touch_dt_atualizacao
BEFORE UPDATE ON public.usuario
FOR EACH ROW
EXECUTE FUNCTION public.fn_usuario_touch_dt_atualizacao();

-- =========================================================
-- 3) PERFIL_PERMISSAO (matriz de permissoes por recurso/acao)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.perfil_permissao (
  cd_perfil_permissao SERIAL PRIMARY KEY,
  cd_perfil INTEGER NOT NULL REFERENCES public.perfil(cd_perfil) ON UPDATE CASCADE ON DELETE CASCADE,
  nm_recurso VARCHAR(60) NOT NULL,
  nm_acao VARCHAR(20) NOT NULL,
  ie_permitido CHAR(1) NOT NULL DEFAULT 'S',
  dt_cadastro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_perfil_permissao_permitido CHECK (ie_permitido IN ('S', 'N')),
  CONSTRAINT ck_perfil_permissao_acao CHECK (UPPER(BTRIM(nm_acao)) IN ('VIEW', 'CREATE', 'UPDATE', 'DELETE', 'MOVE', 'MANAGE')),
  CONSTRAINT uq_perfil_permissao UNIQUE (cd_perfil, nm_recurso, nm_acao)
);

CREATE INDEX IF NOT EXISTS idx_perfil_permissao_perfil
  ON public.perfil_permissao (cd_perfil);

CREATE INDEX IF NOT EXISTS idx_perfil_permissao_recurso
  ON public.perfil_permissao (LOWER(BTRIM(nm_recurso)), UPPER(BTRIM(nm_acao)));

INSERT INTO public.perfil_permissao (cd_perfil, nm_recurso, nm_acao, ie_permitido)
SELECT p.cd_perfil, x.nm_recurso, x.nm_acao, 'S'
FROM public.perfil p
JOIN (
  VALUES
    ('DASHBOARD', 'VIEW'),
    ('INVENTARIO', 'VIEW'),
    ('INVENTARIO', 'CREATE'),
    ('INVENTARIO', 'UPDATE'),
    ('INVENTARIO', 'DELETE'),
    ('INVENTARIO', 'MOVE'),
    ('SUPRIMENTOS', 'VIEW'),
    ('SUPRIMENTOS', 'UPDATE'),
    ('EMPRESA', 'VIEW'),
    ('EMPRESA', 'CREATE'),
    ('EMPRESA', 'UPDATE'),
    ('EMPRESA', 'DELETE'),
    ('SETOR', 'VIEW'),
    ('SETOR', 'CREATE'),
    ('SETOR', 'UPDATE'),
    ('SETOR', 'DELETE'),
    ('EQUIPAMENTO', 'VIEW'),
    ('EQUIPAMENTO', 'CREATE'),
    ('EQUIPAMENTO', 'UPDATE'),
    ('EQUIPAMENTO', 'DELETE'),
    ('MOVIMENTACAO', 'VIEW'),
    ('MOVIMENTACAO', 'CREATE'),
    ('MOVIMENTACAO', 'MOVE'),
    ('USUARIO', 'VIEW'),
    ('USUARIO', 'CREATE'),
    ('USUARIO', 'UPDATE'),
    ('USUARIO', 'DELETE'),
    ('USUARIO', 'MANAGE'),
    ('PERFIL', 'VIEW'),
    ('PERFIL', 'MANAGE')
) AS x(nm_recurso, nm_acao)
  ON TRUE
WHERE p.nm_perfil = 'ADMIN'
ON CONFLICT (cd_perfil, nm_recurso, nm_acao)
DO UPDATE SET ie_permitido = EXCLUDED.ie_permitido;

INSERT INTO public.perfil_permissao (cd_perfil, nm_recurso, nm_acao, ie_permitido)
SELECT p.cd_perfil, x.nm_recurso, x.nm_acao, 'S'
FROM public.perfil p
JOIN (
  VALUES
    ('DASHBOARD', 'VIEW'),
    ('INVENTARIO', 'VIEW'),
    ('INVENTARIO', 'CREATE'),
    ('INVENTARIO', 'UPDATE'),
    ('INVENTARIO', 'MOVE'),
    ('SUPRIMENTOS', 'VIEW'),
    ('SUPRIMENTOS', 'UPDATE'),
    ('EMPRESA', 'VIEW'),
    ('SETOR', 'VIEW'),
    ('EQUIPAMENTO', 'VIEW'),
    ('MOVIMENTACAO', 'VIEW'),
    ('MOVIMENTACAO', 'CREATE')
) AS x(nm_recurso, nm_acao)
  ON TRUE
WHERE p.nm_perfil = 'COLABORADOR'
ON CONFLICT (cd_perfil, nm_recurso, nm_acao)
DO UPDATE SET ie_permitido = EXCLUDED.ie_permitido;

INSERT INTO public.perfil_permissao (cd_perfil, nm_recurso, nm_acao, ie_permitido)
SELECT p.cd_perfil, x.nm_recurso, x.nm_acao, 'S'
FROM public.perfil p
JOIN (
  VALUES
    ('DASHBOARD', 'VIEW'),
    ('INVENTARIO', 'VIEW'),
    ('SUPRIMENTOS', 'VIEW'),
    ('EMPRESA', 'VIEW'),
    ('SETOR', 'VIEW'),
    ('EQUIPAMENTO', 'VIEW'),
    ('MOVIMENTACAO', 'VIEW')
) AS x(nm_recurso, nm_acao)
  ON TRUE
WHERE p.nm_perfil = 'VIEWER'
ON CONFLICT (cd_perfil, nm_recurso, nm_acao)
DO UPDATE SET ie_permitido = EXCLUDED.ie_permitido;

-- =========================================================
-- 4) AUDITORIA OPERACIONAL (inventario e movimentacao)
-- =========================================================
ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS cd_usuario_criacao INTEGER,
  ADD COLUMN IF NOT EXISTS cd_usuario_ultima_alteracao INTEGER,
  ADD COLUMN IF NOT EXISTS dt_ultima_alteracao TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_inventario_usuario_criacao'
      AND conrelid = 'public.inventario'::regclass
  ) THEN
    ALTER TABLE public.inventario
      ADD CONSTRAINT fk_inventario_usuario_criacao
      FOREIGN KEY (cd_usuario_criacao)
      REFERENCES public.usuario(cd_usuario)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_inventario_usuario_ultima_alteracao'
      AND conrelid = 'public.inventario'::regclass
  ) THEN
    ALTER TABLE public.inventario
      ADD CONSTRAINT fk_inventario_usuario_ultima_alteracao
      FOREIGN KEY (cd_usuario_ultima_alteracao)
      REFERENCES public.usuario(cd_usuario)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_inventario_usuario_criacao
  ON public.inventario (cd_usuario_criacao);

CREATE INDEX IF NOT EXISTS idx_inventario_usuario_ultima_alteracao
  ON public.inventario (cd_usuario_ultima_alteracao);

CREATE OR REPLACE FUNCTION public.fn_inventario_touch_dt_ultima_alteracao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.dt_ultima_alteracao = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventario_touch_dt_ultima_alteracao ON public.inventario;

CREATE TRIGGER trg_inventario_touch_dt_ultima_alteracao
BEFORE UPDATE ON public.inventario
FOR EACH ROW
EXECUTE FUNCTION public.fn_inventario_touch_dt_ultima_alteracao();

ALTER TABLE public.movimentacao
  ADD COLUMN IF NOT EXISTS cd_usuario INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_movimentacao_usuario'
      AND conrelid = 'public.movimentacao'::regclass
  ) THEN
    ALTER TABLE public.movimentacao
      ADD CONSTRAINT fk_movimentacao_usuario
      FOREIGN KEY (cd_usuario)
      REFERENCES public.usuario(cd_usuario)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_movimentacao_usuario
  ON public.movimentacao (cd_usuario);

COMMIT;



-- ========================================================
-- SOURCE: 20260427_usuario_status_ativacao_inativacao.sql
-- ========================================================

BEGIN;

-- =========================================================
-- 1) usuario: status com rastreio de ativacao/inativacao
-- =========================================================
ALTER TABLE public.usuario
  ADD COLUMN IF NOT EXISTS cd_usuario_ativacao INTEGER,
  ADD COLUMN IF NOT EXISTS dt_ativacao TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cd_usuario_inativacao INTEGER,
  ADD COLUMN IF NOT EXISTS dt_inativacao TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ds_motivo_inativacao VARCHAR;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_usuario_ativacao'
      AND conrelid = 'public.usuario'::regclass
  ) THEN
    ALTER TABLE public.usuario
      ADD CONSTRAINT fk_usuario_ativacao
      FOREIGN KEY (cd_usuario_ativacao)
      REFERENCES public.usuario(cd_usuario)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_usuario_inativacao'
      AND conrelid = 'public.usuario'::regclass
  ) THEN
    ALTER TABLE public.usuario
      ADD CONSTRAINT fk_usuario_inativacao
      FOREIGN KEY (cd_usuario_inativacao)
      REFERENCES public.usuario(cd_usuario)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_usuario_ativacao
  ON public.usuario(cd_usuario_ativacao);

CREATE INDEX IF NOT EXISTS idx_usuario_inativacao
  ON public.usuario(cd_usuario_inativacao);

CREATE INDEX IF NOT EXISTS idx_usuario_status_data
  ON public.usuario(ie_situacao, dt_ativacao DESC, dt_inativacao DESC);

UPDATE public.usuario
SET dt_ativacao = COALESCE(dt_ativacao, dt_cadastro)
WHERE ie_situacao = 'A'
  AND dt_ativacao IS NULL;

UPDATE public.usuario
SET dt_inativacao = COALESCE(dt_inativacao, dt_atualizacao, CURRENT_TIMESTAMP)
WHERE ie_situacao = 'I'
  AND dt_inativacao IS NULL;

-- =========================================================
-- 2) Trigger: registra quem/quando ativou ou inativou
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_usuario_controlar_status_auditoria()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.ie_situacao NOT IN ('A', 'I') THEN
    RAISE EXCEPTION 'ie_situacao invalido para usuario: %', NEW.ie_situacao;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.ie_situacao = 'A' THEN
      NEW.dt_ativacao = COALESCE(NEW.dt_ativacao, NEW.dt_cadastro, CURRENT_TIMESTAMP);
      NEW.cd_usuario_ativacao = COALESCE(NEW.cd_usuario_ativacao, NEW.cd_usuario_ultima_alteracao);
    ELSE
      NEW.dt_inativacao = COALESCE(NEW.dt_inativacao, CURRENT_TIMESTAMP);
      NEW.cd_usuario_inativacao = COALESCE(NEW.cd_usuario_inativacao, NEW.cd_usuario_ultima_alteracao);
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.ie_situacao <> OLD.ie_situacao THEN
    IF NEW.ie_situacao = 'I' THEN
      NEW.dt_inativacao = COALESCE(NEW.dt_inativacao, CURRENT_TIMESTAMP);
      NEW.cd_usuario_inativacao = COALESCE(NEW.cd_usuario_inativacao, NEW.cd_usuario_ultima_alteracao);
    ELSE
      NEW.dt_ativacao = COALESCE(NEW.dt_ativacao, CURRENT_TIMESTAMP);
      NEW.cd_usuario_ativacao = COALESCE(NEW.cd_usuario_ativacao, NEW.cd_usuario_ultima_alteracao);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_usuario_controlar_status_auditoria ON public.usuario;

CREATE TRIGGER trg_usuario_controlar_status_auditoria
BEFORE INSERT OR UPDATE OF ie_situacao, cd_usuario_ultima_alteracao ON public.usuario
FOR EACH ROW
EXECUTE FUNCTION public.fn_usuario_controlar_status_auditoria();

-- =========================================================
-- 3) Login: usuario inativo nao autentica
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_usuario_autenticavel(p_login VARCHAR)
RETURNS TABLE (
  cd_usuario INTEGER,
  nm_usuario VARCHAR,
  ds_email VARCHAR,
  ds_login VARCHAR,
  ds_senha_hash VARCHAR,
  cd_perfil INTEGER
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    u.cd_usuario,
    u.nm_usuario,
    u.ds_email,
    u.ds_login,
    u.ds_senha_hash,
    u.cd_perfil
  FROM public.usuario u
  WHERE (
      LOWER(BTRIM(u.ds_login)) = LOWER(BTRIM(p_login))
      OR LOWER(BTRIM(u.ds_email)) = LOWER(BTRIM(p_login))
    )
    AND u.ie_situacao = 'A'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_usuario_registrar_login(p_cd_usuario INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.usuario
  SET dt_ultimo_login = CURRENT_TIMESTAMP
  WHERE cd_usuario = p_cd_usuario
    AND ie_situacao = 'A';

  RETURN FOUND;
END;
$$;

COMMIT;



