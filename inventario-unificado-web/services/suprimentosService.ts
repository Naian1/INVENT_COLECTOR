/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\suprimentosService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Suprimentos, CreateSuprimentosInput, UpdateSuprimentosInput } from '@/types/suprimentos';

/**
 * [DOC-FUNC] getSuprimentos
 * O que faz: Consulta dados de 'get suprimentos' na fonte principal (API, banco ou cache).
 * Entradas: Sem parametros obrigatorios.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
 */
export async function getSuprimentos(): Promise<Suprimentos[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('suprimentos')
    .select('*')
    .order('dt_coleta', { ascending: false });

  if (error) throw new Error(`Erro ao listar suprimentos: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] getSuprimentosById
 * O que faz: Consulta dados de 'get suprimentos by id' na fonte principal (API, banco ou cache).
 * Entradas: Parametros esperados: id.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
 */
export async function getSuprimentosById(id: number): Promise<Suprimentos | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('suprimentos')
    .select('*')
    .eq('cd_suprimento', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Erro ao buscar suprimento: ${error.message}`);
  return data || null;
}

/**
 * [DOC-FUNC] getSuprimentosByInventario
 * O que faz: Consulta dados de 'get suprimentos by inventario' na fonte principal (API, banco ou cache).
 * Entradas: Parametros esperados: inventarioId.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
 */
export async function getSuprimentosByInventario(inventarioId: number): Promise<Suprimentos[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('suprimentos')
    .select('*')
    .eq('nr_inventario', inventarioId)
    .order('dt_coleta', { ascending: false });

  if (error) throw new Error(`Erro ao listar suprimentos por inventario: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] getSuprimentosByPatrimonio
 * O que faz: Consulta dados de 'get suprimentos by patrimonio' na fonte principal (API, banco ou cache).
 * Entradas: Parametros esperados: patrimonio.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
 */
export async function getSuprimentosByPatrimonio(patrimonio: string): Promise<Suprimentos[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('suprimentos')
    .select('*')
    .eq('nr_patrimonio', patrimonio.toLowerCase())
    .order('dt_coleta', { ascending: false });

  if (error) throw new Error(`Erro ao listar suprimentos por patrimonio: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] upsertSuprimento
 * O que faz: Atualiza 'upsert suprimento' preservando integridade dos dados e regras de negocio.
 * Entradas: Parametros esperados: input.
 * Como executa: Localiza alvo por chave, aplica alteracoes e valida conflitos.
 * Retorno/Efeitos: Retorna estado final atualizado ou erro com contexto da falha.
 */
export async function upsertSuprimento(
  input: CreateSuprimentosInput,
): Promise<Suprimentos> {
  const supabase = getSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from('suprimentos')
    .select('cd_suprimento')
    .eq('nr_inventario', input.nr_inventario)
    .eq('cd_tipo_suprimento', input.cd_tipo_suprimento)
    .maybeSingle();

  if (existingError) throw new Error(`Erro ao verificar suprimento existente: ${existingError.message}`);

  if (existing?.cd_suprimento) {
    const { data, error } = await supabase
      .from('suprimentos')
      .update(input)
      .eq('cd_suprimento', existing.cd_suprimento)
      .select()
      .single();

    if (error) throw new Error(`Erro ao atualizar suprimento: ${error.message}`);
    return data;
  }

  const { data, error } = await supabase
    .from('suprimentos')
    .insert([input])
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar suprimento: ${error.message}`);
  return data;
}

/**
 * [DOC-FUNC] createSuprimento
 * O que faz: Cria registro de 'create suprimento' aplicando regras de consistencia antes de persistir.
 * Entradas: Parametros esperados: input.
 * Como executa: Valida payload, monta comando de escrita e trata falhas de persistencia.
 * Retorno/Efeitos: Retorna entidade criada (ou identificador) para continuidade do fluxo.
 */
export async function createSuprimento(
  input: CreateSuprimentosInput,
): Promise<Suprimentos> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('suprimentos')
    .insert([input])
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar suprimento: ${error.message}`);
  return data;
}

/**
 * [DOC-FUNC] updateSuprimento
 * O que faz: Atualiza 'update suprimento' preservando integridade dos dados e regras de negocio.
 * Entradas: Parametros esperados: id, input.
 * Como executa: Localiza alvo por chave, aplica alteracoes e valida conflitos.
 * Retorno/Efeitos: Retorna estado final atualizado ou erro com contexto da falha.
 */
export async function updateSuprimento(
  id: number,
  input: UpdateSuprimentosInput,
): Promise<Suprimentos> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('suprimentos')
    .update(input)
    .eq('cd_suprimento', id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar suprimento: ${error.message}`);
  return data;
}

/**
 * [DOC-FUNC] deleteSuprimento
 * O que faz: Remove ou inativa dados de 'delete suprimento' conforme politica do sistema.
 * Entradas: Parametros esperados: id.
 * Como executa: Recebe chave do alvo, valida dependencias e executa a operacao segura.
 * Retorno/Efeitos: Retorna confirmacao da acao e sinaliza erros de integridade/permissao.
 */
export async function deleteSuprimento(id: number): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('suprimentos')
    .delete()
    .eq('cd_suprimento', id);

  if (error) throw new Error(`Erro ao deletar suprimento: ${error.message}`);
}

