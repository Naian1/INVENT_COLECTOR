-- 2026-05-14 - Pendencias de substituicao assistida por telemetria
-- Esta tabela guarda alertas de divergencia de identidade (IP x serie/mac/patrimonio)
-- para aprovacao manual no fluxo de inventario.

create table if not exists public.telemetria_substituicao_pendente (
  id bigserial primary key,
  ie_status text not null default 'PENDENTE' check (ie_status in ('PENDENTE','CONFIRMADO','DESCARTADO')),
  dt_detectado timestamptz not null default now(),
  dt_ultima_detecao timestamptz not null default now(),
  nr_ocorrencias integer not null default 1,

  nr_inventario_referencia integer not null references public.inventario(nr_inventario),
  nr_inventario_substituto integer null references public.inventario(nr_inventario),
  cd_setor_referencia integer null references public.setor(cd_setor),

  nr_ip_detectado text not null,
  nr_patrimonio_esperado text null,
  nr_patrimonio_detectado text null,
  nr_serie_esperada text null,
  nr_serie_detectada text null,
  nr_mac_esperado text null,
  nr_mac_detectado text null,

  ds_motivo text null,
  coletor_id text null,
  payload_evento jsonb null,

  dt_resolucao timestamptz null,
  cd_usuario_resolucao integer null references public.usuario(cd_usuario),
  nm_usuario_resolucao text null,
  ds_resolucao text null,

  unique (nr_inventario_referencia, nr_ip_detectado)
);

create index if not exists idx_telemetria_subs_status_dt
  on public.telemetria_substituicao_pendente (ie_status, dt_ultima_detecao desc);

create index if not exists idx_telemetria_subs_referencia
  on public.telemetria_substituicao_pendente (nr_inventario_referencia);
