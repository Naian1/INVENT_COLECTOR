import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Equipamento, CreateEquipamentoInput, UpdateEquipamentoInput } from '@/types/equipamento';

/**
 * Serviço de Equipamentos (modelos/tipos de dispositivos)
 */

export async function getEquipamentos(): Promise<Equipamento[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('equipamento')
    .select('*')
    .eq('ie_situacao', 'A')
    .order('nm_modelo');

  if (error) throw new Error(`Erro ao listar equipamentos: ${error.message}`);
  return data || [];
}

export async function getEquipamentoById(id: number): Promise<Equipamento | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('equipamento')
    .select('*')
    .eq('cd_equipamento', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Erro ao buscar equipamento: ${error.message}`);
  return data || null;
}

export async function getEquipamentosByTipo(tipoId: number): Promise<Equipamento[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('equipamento')
    .select('*')
    .eq('cd_tipo_equipamento', tipoId)
    .eq('ie_situacao', 'A')
    .order('nm_modelo');

  if (error) throw new Error(`Erro ao listar equipamentos por tipo: ${error.message}`);
  return data || [];
}

export async function createEquipamento(input: CreateEquipamentoInput): Promise<Equipamento> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('equipamento')
    .insert([input])
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar equipamento: ${error.message}`);
  return data;
}

export async function updateEquipamento(
  id: number,
  input: UpdateEquipamentoInput,
): Promise<Equipamento> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('equipamento')
    .update(input)
    .eq('cd_equipamento', id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar equipamento: ${error.message}`);
  return data;
}

export async function deleteEquipamento(id: number): Promise<void> {
  // Soft delete - apenas marcar como inativo
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('equipamento')
    .update({ ie_situacao: 'I' })
    .eq('cd_equipamento', id);

  if (error) throw new Error(`Erro ao deletar equipamento: ${error.message}`);
}
