import { supabase } from '@/lib/supabase/client';
import { Movimentacao, CreateMovimentacaoInput } from '@/types/movimentacao';

/**
 * Serviço de Movimentações (auditoria de mudanças de setor)
 */

export async function getMovimentacoes(): Promise<Movimentacao[]> {
  const { data, error } = await supabase
    .from('movimentacao')
    .select('*')
    .order('dt_movimentacao', { ascending: false });

  if (error) throw new Error(`Erro ao listar movimentações: ${error.message}`);
  return data || [];
}

export async function getMovimentacaoById(id: number): Promise<Movimentacao | null> {
  const { data, error } = await supabase
    .from('movimentacao')
    .select('*')
    .eq('nr_movimentacao', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Erro ao buscar movimentação: ${error.message}`);
  return data || null;
}

export async function getMovimentacoesByInventario(inventarioId: number): Promise<Movimentacao[]> {
  const { data, error } = await supabase
    .from('movimentacao')
    .select('*')
    .eq('nr_inventario', inventarioId)
    .order('dt_movimentacao', { ascending: false });

  if (error) throw new Error(`Erro ao listar movimentações por inventário: ${error.message}`);
  return data || [];
}

export async function getMovimentacoesByPatrimonio(patrimonio: string): Promise<Movimentacao[]> {
  const { data, error } = await supabase
    .from('movimentacao')
    .select('*')
    .eq('nr_patrimonio', patrimonio.toLowerCase())
    .order('dt_movimentacao', { ascending: false });

  if (error) throw new Error(`Erro ao listar movimentações por patrimônio: ${error.message}`);
  return data || [];
}

export async function getMovimentacoesBySetor(
  setorId: number,
  limit: number = 100,
): Promise<Movimentacao[]> {
  const { data, error } = await supabase
    .from('movimentacao')
    .select('*')
    .eq('cd_setor_destino', setorId)
    .order('dt_movimentacao', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Erro ao listar movimentações por setor: ${error.message}`);
  return data || [];
}

export async function createMovimentacao(
  input: CreateMovimentacaoInput,
): Promise<Movimentacao> {
  const { data, error } = await supabase
    .from('movimentacao')
    .insert([input])
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar movimentação: ${error.message}`);
  return data;
}

/**
 * Busca histórico completo de movimentações de um equipamento
 */
export async function getHistoricoEquipamento(patrimonio: string): Promise<{
  inventario: any;
  movimentacoes: Movimentacao[];
}> {
  // Buscar inventário
  const { data: inv, error: invError } = await supabase
    .from('inventario')
    .select('*')
    .eq('nr_patrimonio', patrimonio.toLowerCase())
    .single();

  if (invError) throw new Error(`Equipamento não encontrado: ${invError.message}`);

  // Buscar movimentações
  const moverementacoes = await getMovimentacoesByPatrimonio(patrimonio);

  return {
    inventario: inv,
    movimentacoes: moverementacoes,
  };
}
