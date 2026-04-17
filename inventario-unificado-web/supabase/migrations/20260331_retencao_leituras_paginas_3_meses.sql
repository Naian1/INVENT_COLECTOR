-- Migration desativada.
-- A retencao de 3 meses agora faz parte do arquivo unico
-- 20260327_schema_unico_completo_datado.sql.
do $$
begin
  raise notice 'Retencao de paginas ja integrada em 20260327_schema_unico_completo_datado.sql';
end;
$$;
