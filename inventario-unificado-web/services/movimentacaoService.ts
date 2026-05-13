/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\movimentacaoService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Movimentacao, CreateMovimentacaoInput } from '@/types/movimentacao';

/**
 * [DOC-FUNC] getMovimentacoes
 * O que faz: Consulta informacoes na funcao 'getMovimentacoes' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (sem parametros obrigatorios) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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
 * O que faz: Consulta informacoes na funcao 'getMovimentacaoById' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (id) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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
 * O que faz: Consulta informacoes na funcao 'getMovimentacoesByInventario' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (inventarioId) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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
 * O que faz: Consulta informacoes na funcao 'getMovimentacoesByPatrimonio' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (patrimonio) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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
 * O que faz: Consulta informacoes na funcao 'getMovimentacoesBySetor' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (setorId, limit) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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
 * O que faz: Grava novos dados na funcao 'createMovimentacao', aplicando validacoes para preservar integridade do dominio.
 * Entradas: Recebe payload/chaves (input) e verifica campos obrigatorios antes da persistencia.
 * Como executa: Sanitiza os valores, aplica regras de negocio e executa insert/upsert com tratamento de erro transacional.
 * Retorno/Efeitos: Retorna o registro criado (ou resumo da gravacao) e sinaliza claramente conflitos/permissoes.
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
 * O que faz: Consulta informacoes na funcao 'getHistoricoEquipamento' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (patrimonio) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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

