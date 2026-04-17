import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Setor, CreateSetorInput, UpdateSetorInput } from '@/types/setor';

/**
 * Serviço de Setores (locais/departamentos)
 */

export async function getSetores(): Promise<Setor[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('setor')
    .select('*')
    .eq('ie_situacao', 'A')
    .order('nm_setor');

  if (error) throw new Error(`Erro ao listar setores: ${error.message}`);
  return data || [];
}

export async function getSetorById(id: number): Promise<Setor | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('setor')
    .select('*')
    .eq('cd_setor', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Erro ao buscar setor: ${error.message}`);
  return data || null;
}

export async function getSetorByName(name: string): Promise<Setor | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('setor')
    .select('*')
    .eq('nm_setor', name)
    .eq('ie_situacao', 'A')
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Erro ao buscar setor por nome: ${error.message}`);
  return data || null;
}

export async function createSetor(input: CreateSetorInput): Promise<Setor> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('setor')
    .insert([input])
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar setor: ${error.message}`);
  return data;
}

export async function updateSetor(
  id: number,
  input: UpdateSetorInput,
): Promise<Setor> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('setor')
    .update(input)
    .eq('cd_setor', id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar setor: ${error.message}`);
  return data;
}

export async function deleteSetor(id: number): Promise<void> {
  // Soft delete
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('setor')
    .update({ ie_situacao: 'I' })
    .eq('cd_setor', id);

  if (error) throw new Error(`Erro ao deletar setor: ${error.message}`);
}
