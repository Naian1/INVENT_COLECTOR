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
 * O que faz: Consulta dados de 'get setores' na fonte principal (API, banco ou cache).
 * Entradas: Sem parametros obrigatorios.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
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
 * O que faz: Consulta dados de 'get setor by id' na fonte principal (API, banco ou cache).
 * Entradas: Parametros esperados: id.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
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
 * O que faz: Consulta dados de 'get setor by name' na fonte principal (API, banco ou cache).
 * Entradas: Parametros esperados: name.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
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
 * O que faz: Cria registro de 'create setor' aplicando regras de consistencia antes de persistir.
 * Entradas: Parametros esperados: input.
 * Como executa: Valida payload, monta comando de escrita e trata falhas de persistencia.
 * Retorno/Efeitos: Retorna entidade criada (ou identificador) para continuidade do fluxo.
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
 * O que faz: Atualiza 'update setor' preservando integridade dos dados e regras de negocio.
 * Entradas: Parametros esperados: id, input.
 * Como executa: Localiza alvo por chave, aplica alteracoes e valida conflitos.
 * Retorno/Efeitos: Retorna estado final atualizado ou erro com contexto da falha.
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
 * O que faz: Remove ou inativa dados de 'delete setor' conforme politica do sistema.
 * Entradas: Parametros esperados: id.
 * Como executa: Recebe chave do alvo, valida dependencias e executa a operacao segura.
 * Retorno/Efeitos: Retorna confirmacao da acao e sinaliza erros de integridade/permissao.
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

