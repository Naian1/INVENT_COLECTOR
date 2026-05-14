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
 * O que faz: A funcao 'getTiposEquipamento' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'getTipoEquipamentoById' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: id. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'createTipoEquipamento' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
 * Entradas: Recebe os parametros: input. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
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
 * O que faz: A funcao 'updateTipoEquipamento' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
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
 * O que faz: A funcao 'deleteTipoEquipamento' remove ou inativa registros conforme as regras do sistema. O foco e preservar integridade e rastreabilidade durante a operacao.
 * Entradas: Recebe os parametros: id. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
export async function deleteTipoEquipamento(id: number): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('tipo_equipamento')
    .update({ ie_situacao: 'I' })
    .eq('cd_tipo_equipamento', id);

  if (error) throw new Error(`Erro ao inativar tipo de equipamento: ${error.message}`);
}

