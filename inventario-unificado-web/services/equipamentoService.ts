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
 * O que faz: A funcao 'getEquipamentos' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'getEquipamentoById' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: id. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'getEquipamentosByTipo' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: tipoId. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'createEquipamento' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
 * Entradas: Recebe os parametros: input. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
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
 * O que faz: A funcao 'updateEquipamento' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
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
 * O que faz: A funcao 'deleteEquipamento' remove ou inativa registros conforme as regras do sistema. O foco e preservar integridade e rastreabilidade durante a operacao.
 * Entradas: Recebe os parametros: id. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
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

