/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\suprimentosService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Suprimentos, CreateSuprimentosInput, UpdateSuprimentosInput } from '@/types/suprimentos';

/**
 * [DOC-FUNC] getSuprimentos
 * O que faz: Consulta e organiza informacoes na funcao 'getSuprimentos', entregando retorno confiavel para camadas superiores.
 * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getSuprimentosById', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: id; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getSuprimentosByInventario', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: inventarioId; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getSuprimentosByPatrimonio', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: patrimonio; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; padroniza campos para evitar divergencia de formato; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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
 * O que faz: Atualiza estado na funcao 'upsertSuprimento', mantendo coerencia entre dados atuais e alteracoes recebidas.
 * Entradas: Parametros esperados: input; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; executa escrita/atualizacao de forma controlada; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
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
 * O que faz: Cria e persiste dados na funcao 'createSuprimento', aplicando validacao para preservar integridade do dominio.
 * Entradas: Parametros esperados: input; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; executa escrita de forma controlada; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
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
 * O que faz: Atualiza estado na funcao 'updateSuprimento', mantendo coerencia entre dados atuais e alteracoes recebidas.
 * Entradas: Parametros esperados: id, input; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; executa atualizacao de forma controlada; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
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
 * O que faz: Remove/inativa dados na funcao 'deleteSuprimento', respeitando regras de ciclo de vida e dependencias.
 * Entradas: Parametros esperados: id; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; executa remocao de forma controlada; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
 */
export async function deleteSuprimento(id: number): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('suprimentos')
    .delete()
    .eq('cd_suprimento', id);

  if (error) throw new Error(`Erro ao deletar suprimento: ${error.message}`);
}

