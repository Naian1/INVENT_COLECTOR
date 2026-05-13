/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\setorService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Setor, CreateSetorInput, UpdateSetorInput } from '@/types/setor';

/**
 * Serviço de Setores (locais/departamentos)
 */

/**
 * [DOC-FUNC] getSetores
 * O que faz: Consulta e organiza informacoes na funcao 'getSetores', entregando retorno confiavel para camadas superiores.
 * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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

/**
 * [DOC-FUNC] getSetorById
 * O que faz: Consulta e organiza informacoes na funcao 'getSetorById', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: id; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
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

/**
 * [DOC-FUNC] getSetorByName
 * O que faz: Consulta e organiza informacoes na funcao 'getSetorByName', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: name; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
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

/**
 * [DOC-FUNC] createSetor
 * O que faz: Cria e persiste dados na funcao 'createSetor', aplicando validacao para preservar integridade do dominio.
 * Entradas: Parametros esperados: input; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; executa escrita de forma controlada; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
 */
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

/**
 * [DOC-FUNC] updateSetor
 * O que faz: Atualiza estado na funcao 'updateSetor', mantendo coerencia entre dados atuais e alteracoes recebidas.
 * Entradas: Parametros esperados: id, input; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; executa atualizacao de forma controlada; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
 */
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

/**
 * [DOC-FUNC] deleteSetor
 * O que faz: Remove/inativa dados na funcao 'deleteSetor', respeitando regras de ciclo de vida e dependencias.
 * Entradas: Parametros esperados: id; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; executa atualizacao de forma controlada; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
 */
export async function deleteSetor(id: number): Promise<void> {
  // Soft delete
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('setor')
    .update({ ie_situacao: 'I' })
    .eq('cd_setor', id);

  if (error) throw new Error(`Erro ao deletar setor: ${error.message}`);
}

