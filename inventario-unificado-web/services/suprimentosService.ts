import { supabase } from '@/lib/supabase/client';
import { Suprimentos, CreateSuprimentosInput, UpdateSuprimentosInput } from '@/types/suprimentos';

/**
 * Serviço de Suprimentos (estado atual apenas)
 * Operação principal: UPSERT (update se existe, insert se novo)
 */

export async function getSuprimentos(): Promise<Suprimentos[]> {
  const { data, error } = await supabase
    .from('suprimentos')
    .select('*')
    .order('dt_coleta', { ascending: false });

  if (error) throw new Error(`Erro ao listar suprimentos: ${error.message}`);
  return data || [];
}

export async function getSuprimentosById(id: number): Promise<Suprimentos | null> {
  const { data, error } = await supabase
    .from('suprimentos')
    .select('*')
    .eq('cd_suprimento', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Erro ao buscar suprimento: ${error.message}`);
  return data || null;
}

export async function getSuprimentosByInventario(inventarioId: number): Promise<Suprimentos[]> {
  const { data, error } = await supabase
    .from('suprimentos')
    .select('*')
    .eq('nr_inventario', inventarioId)
    .order('dt_coleta', { ascending: false });

  if (error) throw new Error(`Erro ao listar suprimentos por inventário: ${error.message}`);
  return data || [];
}

export async function getSuprimentosByPatrimonio(patrimonio: string): Promise<Suprimentos[]> {
  const { data, error } = await supabase
    .from('suprimentos')
    .select('*')
    .eq('nr_patrimonio', patrimonio.toLowerCase())
    .order('dt_coleta', { ascending: false });

  if (error) throw new Error(`Erro ao listar suprimentos por patrimônio: ${error.message}`);
  return data || [];
}

/**
 * UPSERT suprimento - atualiza ou insere dependendo se já existe
 * This is the main operation for SNMP collector updates
 */
export async function upsertSuprimento(
  input: CreateSuprimentosInput,
): Promise<Suprimentos> {
  // Primeiro, tenta atualizar se existe combinação unique (nr_inventario + cd_tipo_suprimento)
  const { data: existing } = await supabase
    .from('suprimentos')
    .select('cd_suprimento')
    .eq('nr_inventario', input.nr_inventario)
    .eq('cd_tipo_suprimento', input.cd_tipo_suprimento)
    .single();

  if (existing) {
    // Existe - fazer UPDATE
    const { data, error } = await supabase
      .from('suprimentos')
      .update(input)
      .eq('cd_suprimento', existing.cd_suprimento)
      .select()
      .single();

    if (error) throw new Error(`Erro ao atualizar suprimento: ${error.message}`);
    return data;
  } else {
    // Não existe - fazer INSERT
    const { data, error } = await supabase
      .from('suprimentos')
      .insert([input])
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar suprimento: ${error.message}`);
    return data;
  }
}

export async function createSuprimento(
  input: CreateSuprimentosInput,
): Promise<Suprimentos> {
  const { data, error } = await supabase
    .from('suprimentos')
    .insert([input])
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar suprimento: ${error.message}`);
  return data;
}

export async function updateSuprimento(
  id: number,
  input: UpdateSuprimentosInput,
): Promise<Suprimentos> {
  const { data, error } = await supabase
    .from('suprimentos')
    .update(input)
    .eq('cd_suprimento', id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar suprimento: ${error.message}`);
  return data;
}

export async function deleteSuprimento(id: number): Promise<void> {
  const { error } = await supabase
    .from('suprimentos')
    .delete()
    .eq('cd_suprimento', id);

  if (error) throw new Error(`Erro ao deletar suprimento: ${error.message}`);
}
