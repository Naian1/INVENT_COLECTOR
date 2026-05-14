/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\movimentacaoService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Movimentacao, CreateMovimentacaoInput } from '@/types/movimentacao';

/**
 * [DOC-FUNC] getMovimentacoes
 * O que faz: A funcao 'getMovimentacoes' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
export async function getMovimentacoes(): Promise<Movimentacao[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('movimentacao')
    .select('*')
    .order('dt_movimentacao', { ascending: false });

  if (error) throw new Error(`Erro ao listar movimentacoes: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] getMovimentacaoById
 * O que faz: A funcao 'getMovimentacaoById' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: id. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
export async function getMovimentacaoById(id: number): Promise<Movimentacao | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('movimentacao')
    .select('*')
    .eq('nr_movimentacao', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Erro ao buscar movimentacao: ${error.message}`);
  return data || null;
}

/**
 * [DOC-FUNC] getMovimentacoesByInventario
 * O que faz: A funcao 'getMovimentacoesByInventario' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: inventarioId. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
export async function getMovimentacoesByInventario(inventarioId: number): Promise<Movimentacao[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('movimentacao')
    .select('*')
    .eq('nr_inventario', inventarioId)
    .order('dt_movimentacao', { ascending: false });

  if (error) throw new Error(`Erro ao listar movimentacoes por inventario: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] getMovimentacoesByPatrimonio
 * O que faz: A funcao 'getMovimentacoesByPatrimonio' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: patrimonio. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
export async function getMovimentacoesByPatrimonio(patrimonio: string): Promise<Movimentacao[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('movimentacao')
    .select('*')
    .eq('nr_patrimonio', patrimonio.toLowerCase())
    .order('dt_movimentacao', { ascending: false });

  if (error) throw new Error(`Erro ao listar movimentacoes por patrimonio: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] getMovimentacoesBySetor
 * O que faz: A funcao 'getMovimentacoesBySetor' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
export async function getMovimentacoesBySetor(
  setorId: number,
  limit: number = 100,
): Promise<Movimentacao[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('movimentacao')
    .select('*')
    .eq('cd_setor_destino', setorId)
    .order('dt_movimentacao', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Erro ao listar movimentacoes por setor: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] createMovimentacao
 * O que faz: A funcao 'createMovimentacao' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
export async function createMovimentacao(
  input: CreateMovimentacaoInput,
): Promise<Movimentacao> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('movimentacao')
    .insert([input])
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar movimentacao: ${error.message}`);
  return data;
}

/**
 * [DOC-FUNC] getHistoricoEquipamento
 * O que faz: A funcao 'getHistoricoEquipamento' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: patrimonio. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
export async function getHistoricoEquipamento(patrimonio: string): Promise<{
  inventario: any;
  movimentacoes: Movimentacao[];
}> {
  const supabase = getSupabaseServerClient();
  const { data: inv, error: invError } = await supabase
    .from('inventario')
    .select('*')
    .eq('nr_patrimonio', patrimonio.toLowerCase())
    .single();

  if (invError) throw new Error(`Equipamento nao encontrado: ${invError.message}`);

  const movimentacoes = await getMovimentacoesByPatrimonio(patrimonio);

  return {
    inventario: inv,
    movimentacoes,
  };
}

