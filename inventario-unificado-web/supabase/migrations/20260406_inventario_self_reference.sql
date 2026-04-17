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
