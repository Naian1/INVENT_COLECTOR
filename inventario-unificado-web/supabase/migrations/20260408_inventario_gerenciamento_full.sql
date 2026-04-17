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
  nm_arquivo VARCHAR NOT NULL,
  nr_total_linhas INTEGER NOT NULL DEFAULT 0,
  dt_importacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ds_observacao VARCHAR,
  CONSTRAINT ck_inventario_consolidado_competencia
    CHECK (nr_competencia ~ '^(0[1-9]|1[0-2])/[0-9]{4}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventario_consolidado_competencia
  ON public.inventario_consolidado_carga(nr_competencia);

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
