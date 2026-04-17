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
