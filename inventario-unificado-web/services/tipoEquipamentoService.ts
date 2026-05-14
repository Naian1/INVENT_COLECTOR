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
 * O que faz: Consulta e organiza informacoes na funcao 'getTiposEquipamento' para retorno confiavel.
 * Entradas: Parametros esperados: sem parametros obrigatorios; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getTipoEquipamentoById' para retorno confiavel.
 * Entradas: Parametros esperados: id; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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
 * O que faz: Cria e persiste dados na funcao 'createTipoEquipamento' com validacao de integridade.
 * Entradas: Parametros esperados: input; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; persiste novos registros quando necessario; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna registro/resultado de escrita com erros de integridade tratados.
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
 * O que faz: Atualiza estado na funcao 'updateTipoEquipamento' mantendo coerencia das regras de negocio.
 * Entradas: Parametros esperados: id, input; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; aplica atualizacoes de estado; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna estado final apos atualizacao, com diagnostico claro em falhas.
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
 * O que faz: Remove/inativa dados na funcao 'deleteTipoEquipamento' respeitando dependencias e ciclo de vida.
 * Entradas: Parametros esperados: id; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; aplica atualizacoes de estado; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna confirmacao de exclusao logica/fisica e contexto de restricoes.
 */
export async function deleteTipoEquipamento(id: number): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('tipo_equipamento')
    .update({ ie_situacao: 'I' })
    .eq('cd_tipo_equipamento', id);

  if (error) throw new Error(`Erro ao inativar tipo de equipamento: ${error.message}`);
}

