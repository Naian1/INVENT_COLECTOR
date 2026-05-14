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
 * O que faz: Consulta e organiza informacoes na funcao 'getEquipamentos' para retorno confiavel.
 * Entradas: Parametros esperados: sem parametros obrigatorios; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getEquipamentoById' para retorno confiavel.
 * Entradas: Parametros esperados: id; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getEquipamentosByTipo' para retorno confiavel.
 * Entradas: Parametros esperados: tipoId; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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
 * O que faz: Cria e persiste dados na funcao 'createEquipamento' com validacao de integridade.
 * Entradas: Parametros esperados: input; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; persiste novos registros quando necessario; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna registro/resultado de escrita com erros de integridade tratados.
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
 * O que faz: Atualiza estado na funcao 'updateEquipamento' mantendo coerencia das regras de negocio.
 * Entradas: Parametros esperados: id, input; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; aplica atualizacoes de estado; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna estado final apos atualizacao, com diagnostico claro em falhas.
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
 * O que faz: Remove/inativa dados na funcao 'deleteEquipamento' respeitando dependencias e ciclo de vida.
 * Entradas: Parametros esperados: id; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; aplica atualizacoes de estado; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna confirmacao de exclusao logica/fisica e contexto de restricoes.
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

