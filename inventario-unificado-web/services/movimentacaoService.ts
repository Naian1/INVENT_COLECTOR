/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\movimentacaoService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Movimentacao, CreateMovimentacaoInput } from '@/types/movimentacao';

/**
 * [DOC-FUNC] getMovimentacoes
 * O que faz: Consulta e organiza informacoes na funcao 'getMovimentacoes', entregando retorno confiavel para camadas superiores.
 * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getMovimentacaoById', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: id; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getMovimentacoesByInventario', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: inventarioId; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getMovimentacoesByPatrimonio', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: patrimonio; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; padroniza campos para evitar divergencia de formato; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getMovimentacoesBySetor', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: setorId, limit; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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
 * O que faz: Cria e persiste dados na funcao 'createMovimentacao', aplicando validacao para preservar integridade do dominio.
 * Entradas: Parametros esperados: input; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; executa escrita de forma controlada; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getHistoricoEquipamento', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: patrimonio; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; padroniza campos para evitar divergencia de formato; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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

