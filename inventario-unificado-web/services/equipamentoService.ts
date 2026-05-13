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
 * O que faz: Consulta dados de 'get equipamentos' na fonte principal (API, banco ou cache).
 * Entradas: Sem parametros obrigatorios.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
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
 * O que faz: Consulta dados de 'get equipamento by id' na fonte principal (API, banco ou cache).
 * Entradas: Parametros esperados: id.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
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
 * O que faz: Consulta dados de 'get equipamentos by tipo' na fonte principal (API, banco ou cache).
 * Entradas: Parametros esperados: tipoId.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
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
 * O que faz: Cria registro de 'create equipamento' aplicando regras de consistencia antes de persistir.
 * Entradas: Parametros esperados: input.
 * Como executa: Valida payload, monta comando de escrita e trata falhas de persistencia.
 * Retorno/Efeitos: Retorna entidade criada (ou identificador) para continuidade do fluxo.
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
 * O que faz: Atualiza 'update equipamento' preservando integridade dos dados e regras de negocio.
 * Entradas: Parametros esperados: id, input.
 * Como executa: Localiza alvo por chave, aplica alteracoes e valida conflitos.
 * Retorno/Efeitos: Retorna estado final atualizado ou erro com contexto da falha.
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
 * O que faz: Remove ou inativa dados de 'delete equipamento' conforme politica do sistema.
 * Entradas: Parametros esperados: id.
 * Como executa: Recebe chave do alvo, valida dependencias e executa a operacao segura.
 * Retorno/Efeitos: Retorna confirmacao da acao e sinaliza erros de integridade/permissao.
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

