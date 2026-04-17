import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  TipoEquipamento,
  CreateTipoEquipamentoInput,
  UpdateTipoEquipamentoInput,
} from '@/types/tipoEquipamento';

export async function getTiposEquipamento(): Promise<TipoEquipamento[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('tipo_equipamento')
    .select('*')
    .eq('ie_situacao', 'A')
    .order('nm_tipo_equipamento');

  if (error) throw new Error(`Erro ao listar tipos de equipamento: ${error.message}`);
  return (data || []) as TipoEquipamento[];
}

export async function getTipoEquipamentoById(id: number): Promise<TipoEquipamento | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('tipo_equipamento')
    .select('*')
    .eq('cd_tipo_equipamento', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Erro ao buscar tipo: ${error.message}`);
  return (data as TipoEquipamento) || null;
}

export async function createTipoEquipamento(input: CreateTipoEquipamentoInput): Promise<TipoEquipamento> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('tipo_equipamento')
    .insert([input])
    .select('*')
    .single();

  if (error) throw new Error(`Erro ao criar tipo de equipamento: ${error.message}`);
  return data as TipoEquipamento;
}

export async function updateTipoEquipamento(
  id: number,
  input: UpdateTipoEquipamentoInput,
): Promise<TipoEquipamento> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('tipo_equipamento')
    .update(input)
    .eq('cd_tipo_equipamento', id)
    .select('*')
    .single();

  if (error) throw new Error(`Erro ao atualizar tipo de equipamento: ${error.message}`);
  return data as TipoEquipamento;
}

export async function deleteTipoEquipamento(id: number): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('tipo_equipamento')
    .update({ ie_situacao: 'I' })
    .eq('cd_tipo_equipamento', id);

  if (error) throw new Error(`Erro ao inativar tipo de equipamento: ${error.message}`);
}
