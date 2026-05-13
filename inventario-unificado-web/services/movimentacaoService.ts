/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\movimentacaoService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Movimentacao, CreateMovimentacaoInput } from '@/types/movimentacao';

/**
 * [DOC-FUNC] getMovimentacoes
 * Objetivo: Executa a rotina de 'g et mo vi me nt ac oe s'.
 */
export async function getMovimentacoes(): Promise<Movimentacao[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('movimentacao')
    .select('*')
    .order('dt_movimentacao', { ascending: false });

  if (error) throw new Error(`Erro ao listar movimentacoes: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] getMovimentacaoById
 * Objetivo: Executa a rotina de 'g et mo vi me nt ac ao by id'.
 */
export async function getMovimentacaoById(id: number): Promise<Movimentacao | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('movimentacao')
    .select('*')
    .eq('nr_movimentacao', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Erro ao buscar movimentacao: ${error.message}`);
  return data || null;
}

/**
 * [DOC-FUNC] getMovimentacoesByInventario
 * Objetivo: Executa a rotina de 'g et mo vi me nt ac oe sb yi nv en ta ri o'.
 */
export async function getMovimentacoesByInventario(inventarioId: number): Promise<Movimentacao[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('movimentacao')
    .select('*')
    .eq('nr_inventario', inventarioId)
    .order('dt_movimentacao', { ascending: false });

  if (error) throw new Error(`Erro ao listar movimentacoes por inventario: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] getMovimentacoesByPatrimonio
 * Objetivo: Executa a rotina de 'g et mo vi me nt ac oe sb yp at ri mo ni o'.
 */
export async function getMovimentacoesByPatrimonio(patrimonio: string): Promise<Movimentacao[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('movimentacao')
    .select('*')
    .eq('nr_patrimonio', patrimonio.toLowerCase())
    .order('dt_movimentacao', { ascending: false });

  if (error) throw new Error(`Erro ao listar movimentacoes por patrimonio: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] getMovimentacoesBySetor
 * Objetivo: Executa a rotina de 'g et mo vi me nt ac oe sb ys et or'.
 */
export async function getMovimentacoesBySetor(
  setorId: number,
  limit: number = 100,
): Promise<Movimentacao[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('movimentacao')
    .select('*')
    .eq('cd_setor_destino', setorId)
    .order('dt_movimentacao', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Erro ao listar movimentacoes por setor: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] createMovimentacao
 * Objetivo: Executa a rotina de 'c re at em ov im en ta ca o'.
 */
export async function createMovimentacao(
  input: CreateMovimentacaoInput,
): Promise<Movimentacao> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('movimentacao')
    .insert([input])
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar movimentacao: ${error.message}`);
  return data;
}

/**
 * [DOC-FUNC] getHistoricoEquipamento
 * Objetivo: Executa a rotina de 'g et hi st or ic oe qu ip am en to'.
 */
export async function getHistoricoEquipamento(patrimonio: string): Promise<{
  inventario: any;
  movimentacoes: Movimentacao[];
}> {
  const supabase = getSupabaseServerClient();
  const { data: inv, error: invError } = await supabase
    .from('inventario')
    .select('*')
    .eq('nr_patrimonio', patrimonio.toLowerCase())
    .single();

  if (invError) throw new Error(`Equipamento nao encontrado: ${invError.message}`);

  const movimentacoes = await getMovimentacoesByPatrimonio(patrimonio);

  return {
    inventario: inv,
    movimentacoes,
  };
}

