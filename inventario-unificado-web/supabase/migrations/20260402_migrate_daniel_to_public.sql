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
