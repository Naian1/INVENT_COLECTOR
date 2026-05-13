/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\suprimentosService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Suprimentos, CreateSuprimentosInput, UpdateSuprimentosInput } from '@/types/suprimentos';

/**
 * [DOC-FUNC] getSuprimentos
 * Objetivo: Executa a rotina de 'g et su pr im en to s'.
 */
export async function getSuprimentos(): Promise<Suprimentos[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('suprimentos')
    .select('*')
    .order('dt_coleta', { ascending: false });

  if (error) throw new Error(`Erro ao listar suprimentos: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] getSuprimentosById
 * Objetivo: Executa a rotina de 'g et su pr im en to sb yi d'.
 */
export async function getSuprimentosById(id: number): Promise<Suprimentos | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('suprimentos')
    .select('*')
    .eq('cd_suprimento', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Erro ao buscar suprimento: ${error.message}`);
  return data || null;
}

/**
 * [DOC-FUNC] getSuprimentosByInventario
 * Objetivo: Executa a rotina de 'g et su pr im en to sb yi nv en ta ri o'.
 */
export async function getSuprimentosByInventario(inventarioId: number): Promise<Suprimentos[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('suprimentos')
    .select('*')
    .eq('nr_inventario', inventarioId)
    .order('dt_coleta', { ascending: false });

  if (error) throw new Error(`Erro ao listar suprimentos por inventario: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] getSuprimentosByPatrimonio
 * Objetivo: Executa a rotina de 'g et su pr im en to sb yp at ri mo ni o'.
 */
export async function getSuprimentosByPatrimonio(patrimonio: string): Promise<Suprimentos[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('suprimentos')
    .select('*')
    .eq('nr_patrimonio', patrimonio.toLowerCase())
    .order('dt_coleta', { ascending: false });

  if (error) throw new Error(`Erro ao listar suprimentos por patrimonio: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] upsertSuprimento
 * Objetivo: Executa a rotina de 'u ps er ts up ri me nt o'.
 */
export async function upsertSuprimento(
  input: CreateSuprimentosInput,
): Promise<Suprimentos> {
  const supabase = getSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from('suprimentos')
    .select('cd_suprimento')
    .eq('nr_inventario', input.nr_inventario)
    .eq('cd_tipo_suprimento', input.cd_tipo_suprimento)
    .maybeSingle();

  if (existingError) throw new Error(`Erro ao verificar suprimento existente: ${existingError.message}`);

  if (existing?.cd_suprimento) {
    const { data, error } = await supabase
      .from('suprimentos')
      .update(input)
      .eq('cd_suprimento', existing.cd_suprimento)
      .select()
      .single();

    if (error) throw new Error(`Erro ao atualizar suprimento: ${error.message}`);
    return data;
  }

  const { data, error } = await supabase
    .from('suprimentos')
    .insert([input])
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar suprimento: ${error.message}`);
  return data;
}

/**
 * [DOC-FUNC] createSuprimento
 * Objetivo: Executa a rotina de 'c re at es up ri me nt o'.
 */
export async function createSuprimento(
  input: CreateSuprimentosInput,
): Promise<Suprimentos> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('suprimentos')
    .insert([input])
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar suprimento: ${error.message}`);
  return data;
}

/**
 * [DOC-FUNC] updateSuprimento
 * Objetivo: Executa a rotina de 'u pd at es up ri me nt o'.
 */
export async function updateSuprimento(
  id: number,
  input: UpdateSuprimentosInput,
): Promise<Suprimentos> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('suprimentos')
    .update(input)
    .eq('cd_suprimento', id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar suprimento: ${error.message}`);
  return data;
}

/**
 * [DOC-FUNC] deleteSuprimento
 * Objetivo: Executa a rotina de 'd el et es up ri me nt o'.
 */
export async function deleteSuprimento(id: number): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('suprimentos')
    .delete()
    .eq('cd_suprimento', id);

  if (error) throw new Error(`Erro ao deletar suprimento: ${error.message}`);
}

