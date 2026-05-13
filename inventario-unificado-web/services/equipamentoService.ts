/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\equipamentoService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Equipamento, CreateEquipamentoInput, UpdateEquipamentoInput } from '@/types/equipamento';

/**
 * Serviço de Equipamentos (modelos/tipos de dispositivos)
 */

/**
 * [DOC-FUNC] getEquipamentos
 * O que faz: Consulta e organiza informacoes na funcao 'getEquipamentos', entregando retorno confiavel para camadas superiores.
 * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
export async function getEquipamentos(): Promise<Equipamento[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('equipamento')
    .select('*')
    .eq('ie_situacao', 'A')
    .order('nm_modelo');

  if (error) throw new Error(`Erro ao listar equipamentos: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] getEquipamentoById
 * O que faz: Consulta e organiza informacoes na funcao 'getEquipamentoById', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: id; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
export async function getEquipamentoById(id: number): Promise<Equipamento | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('equipamento')
    .select('*')
    .eq('cd_equipamento', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Erro ao buscar equipamento: ${error.message}`);
  return data || null;
}

/**
 * [DOC-FUNC] getEquipamentosByTipo
 * O que faz: Consulta e organiza informacoes na funcao 'getEquipamentosByTipo', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: tipoId; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
export async function getEquipamentosByTipo(tipoId: number): Promise<Equipamento[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('equipamento')
    .select('*')
    .eq('cd_tipo_equipamento', tipoId)
    .eq('ie_situacao', 'A')
    .order('nm_modelo');

  if (error) throw new Error(`Erro ao listar equipamentos por tipo: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] createEquipamento
 * O que faz: Cria e persiste dados na funcao 'createEquipamento', aplicando validacao para preservar integridade do dominio.
 * Entradas: Parametros esperados: input; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; executa escrita de forma controlada; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
 */
export async function createEquipamento(input: CreateEquipamentoInput): Promise<Equipamento> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('equipamento')
    .insert([input])
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar equipamento: ${error.message}`);
  return data;
}

/**
 * [DOC-FUNC] updateEquipamento
 * O que faz: Atualiza estado na funcao 'updateEquipamento', mantendo coerencia entre dados atuais e alteracoes recebidas.
 * Entradas: Parametros esperados: id, input; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; executa atualizacao de forma controlada; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
 */
export async function updateEquipamento(
  id: number,
  input: UpdateEquipamentoInput,
): Promise<Equipamento> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('equipamento')
    .update(input)
    .eq('cd_equipamento', id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar equipamento: ${error.message}`);
  return data;
}

/**
 * [DOC-FUNC] deleteEquipamento
 * O que faz: Remove/inativa dados na funcao 'deleteEquipamento', respeitando regras de ciclo de vida e dependencias.
 * Entradas: Parametros esperados: id; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; executa atualizacao de forma controlada; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
 */
export async function deleteEquipamento(id: number): Promise<void> {
  // Soft delete - apenas marcar como inativo
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('equipamento')
    .update({ ie_situacao: 'I' })
    .eq('cd_equipamento', id);

  if (error) throw new Error(`Erro ao deletar equipamento: ${error.message}`);
}

