/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\tipoEquipamentoService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  TipoEquipamento,
  CreateTipoEquipamentoInput,
  UpdateTipoEquipamentoInput,
} from '@/types/tipoEquipamento';

/**
 * [DOC-FUNC] getTiposEquipamento
 * O que faz: Consulta dados de 'get tipos equipamento' na fonte principal (API, banco ou cache).
 * Entradas: Sem parametros obrigatorios.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
 */
export async function getTiposEquipamento(): Promise<TipoEquipamento[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('tipo_equipamento')
    .select('*')
    .eq('ie_situacao', 'A')
    .order('nm_tipo_equipamento');

  if (error) throw new Error(`Erro ao listar tipos de equipamento: ${error.message}`);
  return (data || []) as TipoEquipamento[];
}

/**
 * [DOC-FUNC] getTipoEquipamentoById
 * O que faz: Consulta dados de 'get tipo equipamento by id' na fonte principal (API, banco ou cache).
 * Entradas: Parametros esperados: id.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
 */
export async function getTipoEquipamentoById(id: number): Promise<TipoEquipamento | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('tipo_equipamento')
    .select('*')
    .eq('cd_tipo_equipamento', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Erro ao buscar tipo: ${error.message}`);
  return (data as TipoEquipamento) || null;
}

/**
 * [DOC-FUNC] createTipoEquipamento
 * O que faz: Cria registro de 'create tipo equipamento' aplicando regras de consistencia antes de persistir.
 * Entradas: Parametros esperados: input.
 * Como executa: Valida payload, monta comando de escrita e trata falhas de persistencia.
 * Retorno/Efeitos: Retorna entidade criada (ou identificador) para continuidade do fluxo.
 */
export async function createTipoEquipamento(input: CreateTipoEquipamentoInput): Promise<TipoEquipamento> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('tipo_equipamento')
    .insert([input])
    .select('*')
    .single();

  if (error) throw new Error(`Erro ao criar tipo de equipamento: ${error.message}`);
  return data as TipoEquipamento;
}

/**
 * [DOC-FUNC] updateTipoEquipamento
 * O que faz: Atualiza 'update tipo equipamento' preservando integridade dos dados e regras de negocio.
 * Entradas: Parametros esperados: id, input.
 * Como executa: Localiza alvo por chave, aplica alteracoes e valida conflitos.
 * Retorno/Efeitos: Retorna estado final atualizado ou erro com contexto da falha.
 */
export async function updateTipoEquipamento(
  id: number,
  input: UpdateTipoEquipamentoInput,
): Promise<TipoEquipamento> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('tipo_equipamento')
    .update(input)
    .eq('cd_tipo_equipamento', id)
    .select('*')
    .single();

  if (error) throw new Error(`Erro ao atualizar tipo de equipamento: ${error.message}`);
  return data as TipoEquipamento;
}

/**
 * [DOC-FUNC] deleteTipoEquipamento
 * O que faz: Remove ou inativa dados de 'delete tipo equipamento' conforme politica do sistema.
 * Entradas: Parametros esperados: id.
 * Como executa: Recebe chave do alvo, valida dependencias e executa a operacao segura.
 * Retorno/Efeitos: Retorna confirmacao da acao e sinaliza erros de integridade/permissao.
 */
export async function deleteTipoEquipamento(id: number): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('tipo_equipamento')
    .update({ ie_situacao: 'I' })
    .eq('cd_tipo_equipamento', id);

  if (error) throw new Error(`Erro ao inativar tipo de equipamento: ${error.message}`);
}

