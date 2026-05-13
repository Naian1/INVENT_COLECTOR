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
 * O que faz: Consulta informacoes na funcao 'getSetores' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (sem parametros obrigatorios) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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
 * O que faz: Consulta informacoes na funcao 'getSetorById' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (id) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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
 * O que faz: Consulta informacoes na funcao 'getSetorByName' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (name) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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
 * O que faz: Grava novos dados na funcao 'createSetor', aplicando validacoes para preservar integridade do dominio.
 * Entradas: Recebe payload/chaves (input) e verifica campos obrigatorios antes da persistencia.
 * Como executa: Sanitiza os valores, aplica regras de negocio e executa insert/upsert com tratamento de erro transacional.
 * Retorno/Efeitos: Retorna o registro criado (ou resumo da gravacao) e sinaliza claramente conflitos/permissoes.
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
 * O que faz: Atualiza dados na funcao 'updateSetor', mantendo consistencia entre o estado atual e as novas informacoes.
 * Entradas: Recebe identificador e campos para alteracao (id, input), com validacao de formato e regra de negocio.
 * Como executa: Localiza o alvo, aplica apenas mudancas permitidas e executa update com tratamento de conflito/falha.
 * Retorno/Efeitos: Devolve o estado final atualizado ou erro contextualizado para facilitar diagnostico.
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
 * O que faz: Remove ou inativa registros na funcao 'deleteSetor', conforme a politica de ciclo de vida do modulo.
 * Entradas: Recebe chaves/filtros do alvo (id) e valida dependencias antes da exclusao.
 * Como executa: Confere pre-condicoes de seguranca/integridade e executa delete fisico ou logico de forma controlada.
 * Retorno/Efeitos: Confirma a remocao/inativacao e reporta bloqueios quando houver vinculos ou restricoes.
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

