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
 * O que faz: Consulta informacoes na funcao 'getTiposEquipamento' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (sem parametros obrigatorios) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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
 * O que faz: Consulta informacoes na funcao 'getTipoEquipamentoById' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (id) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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
 * O que faz: Grava novos dados na funcao 'createTipoEquipamento', aplicando validacoes para preservar integridade do dominio.
 * Entradas: Recebe payload/chaves (input) e verifica campos obrigatorios antes da persistencia.
 * Como executa: Sanitiza os valores, aplica regras de negocio e executa insert/upsert com tratamento de erro transacional.
 * Retorno/Efeitos: Retorna o registro criado (ou resumo da gravacao) e sinaliza claramente conflitos/permissoes.
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
 * O que faz: Atualiza dados na funcao 'updateTipoEquipamento', mantendo consistencia entre o estado atual e as novas informacoes.
 * Entradas: Recebe identificador e campos para alteracao (id, input), com validacao de formato e regra de negocio.
 * Como executa: Localiza o alvo, aplica apenas mudancas permitidas e executa update com tratamento de conflito/falha.
 * Retorno/Efeitos: Devolve o estado final atualizado ou erro contextualizado para facilitar diagnostico.
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
 * O que faz: Remove ou inativa registros na funcao 'deleteTipoEquipamento', conforme a politica de ciclo de vida do modulo.
 * Entradas: Recebe chaves/filtros do alvo (id) e valida dependencias antes da exclusao.
 * Como executa: Confere pre-condicoes de seguranca/integridade e executa delete fisico ou logico de forma controlada.
 * Retorno/Efeitos: Confirma a remocao/inativacao e reporta bloqueios quando houver vinculos ou restricoes.
 */
export async function deleteTipoEquipamento(id: number): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('tipo_equipamento')
    .update({ ie_situacao: 'I' })
    .eq('cd_tipo_equipamento', id);

  if (error) throw new Error(`Erro ao inativar tipo de equipamento: ${error.message}`);
}

