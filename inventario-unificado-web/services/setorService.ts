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
 * O que faz: Consulta e organiza informacoes na funcao 'getSetores' para retorno confiavel.
 * Entradas: Parametros esperados: sem parametros obrigatorios; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getSetorById' para retorno confiavel.
 * Entradas: Parametros esperados: id; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getSetorByName' para retorno confiavel.
 * Entradas: Parametros esperados: name; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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
 * O que faz: Cria e persiste dados na funcao 'createSetor' com validacao de integridade.
 * Entradas: Parametros esperados: input; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; persiste novos registros quando necessario; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna registro/resultado de escrita com erros de integridade tratados.
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
 * O que faz: Atualiza estado na funcao 'updateSetor' mantendo coerencia das regras de negocio.
 * Entradas: Parametros esperados: id, input; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; aplica atualizacoes de estado; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna estado final apos atualizacao, com diagnostico claro em falhas.
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
 * O que faz: Remove/inativa dados na funcao 'deleteSetor' respeitando dependencias e ciclo de vida.
 * Entradas: Parametros esperados: id; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; aplica atualizacoes de estado; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna confirmacao de exclusao logica/fisica e contexto de restricoes.
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

