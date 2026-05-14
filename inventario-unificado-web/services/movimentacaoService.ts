/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\movimentacaoService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Movimentacao, CreateMovimentacaoInput } from '@/types/movimentacao';

/**
 * [DOC-FUNC] getMovimentacoes
 * O que faz: Consulta e organiza informacoes na funcao 'getMovimentacoes' para retorno confiavel.
 * Entradas: Parametros esperados: sem parametros obrigatorios; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getMovimentacaoById' para retorno confiavel.
 * Entradas: Parametros esperados: id; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getMovimentacoesByInventario' para retorno confiavel.
 * Entradas: Parametros esperados: inventarioId; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getMovimentacoesByPatrimonio' para retorno confiavel.
 * Entradas: Parametros esperados: patrimonio; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; padroniza formato e fallback de campos; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getMovimentacoesBySetor' para retorno confiavel.
 * Entradas: Parametros esperados: setorId, limit; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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
 * O que faz: Cria e persiste dados na funcao 'createMovimentacao' com validacao de integridade.
 * Entradas: Parametros esperados: input; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; persiste novos registros quando necessario; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna registro/resultado de escrita com erros de integridade tratados.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getHistoricoEquipamento' para retorno confiavel.
 * Entradas: Parametros esperados: patrimonio; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; padroniza formato e fallback de campos; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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

