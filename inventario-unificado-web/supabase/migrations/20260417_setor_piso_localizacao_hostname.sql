-- Evolucao: setor com piso/localizacao e hostname no inventario
-- Aplicar apos: 20260408_inventario_gerenciamento_full.sql

BEGIN;

-- =========================================================
-- 1) SETOR: permitir hierarquia piso > setor > localizacao
-- =========================================================
ALTER TABLE public.setor
  ADD COLUMN IF NOT EXISTS nm_piso VARCHAR;

ALTER TABLE public.setor
  ADD COLUMN IF NOT EXISTS nm_localizacao VARCHAR;

UPDATE public.setor
SET nm_piso = COALESCE(NULLIF(BTRIM(nm_piso), ''), 'NAO INFORMADO')
WHERE nm_piso IS NULL OR BTRIM(nm_piso) = '';

ALTER TABLE public.setor
  ALTER COLUMN nm_piso SET DEFAULT 'NAO INFORMADO';

ALTER TABLE public.setor
  ALTER COLUMN nm_piso SET NOT NULL;

-- O modelo antigo tinha UNIQUE em nm_setor.
-- Agora permitimos o mesmo setor em pisos/localizacoes diferentes.
ALTER TABLE public.setor
  DROP CONSTRAINT IF EXISTS setor_nm_setor_key;

DROP INDEX IF EXISTS public.uq_setor_piso_setor_localizacao;

CREATE UNIQUE INDEX uq_setor_piso_setor_localizacao
  ON public.setor (
    LOWER(BTRIM(nm_piso)),
    LOWER(BTRIM(nm_setor)),
    LOWER(BTRIM(COALESCE(nm_localizacao, '')))
  );

CREATE INDEX IF NOT EXISTS idx_setor_piso
  ON public.setor (LOWER(BTRIM(nm_piso)));

CREATE INDEX IF NOT EXISTS idx_setor_localizacao
  ON public.setor (LOWER(BTRIM(COALESCE(nm_localizacao, ''))));

-- =========================================================
-- 2) INVENTARIO: hostname por item fisico (opcional)
-- =========================================================
ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS nm_hostname VARCHAR;

CREATE INDEX IF NOT EXISTS idx_inventario_hostname
  ON public.inventario (LOWER(BTRIM(COALESCE(nm_hostname, ''))));

COMMIT;
