/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\suprimentosService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Suprimentos, CreateSuprimentosInput, UpdateSuprimentosInput } from '@/types/suprimentos';

/**
 * [DOC-FUNC] getSuprimentos
 * O que faz: A funcao 'getSuprimentos' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'getSuprimentosById' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: id. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'getSuprimentosByInventario' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: inventarioId. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'getSuprimentosByPatrimonio' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: patrimonio. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'upsertSuprimento' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
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
 * O que faz: A funcao 'createSuprimento' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
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
 * O que faz: A funcao 'updateSuprimento' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
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
 * O que faz: A funcao 'deleteSuprimento' remove ou inativa registros conforme as regras do sistema. O foco e preservar integridade e rastreabilidade durante a operacao.
 * Entradas: Recebe os parametros: id. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
export async function deleteSuprimento(id: number): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('suprimentos')
    .delete()
    .eq('cd_suprimento', id);

  if (error) throw new Error(`Erro ao deletar suprimento: ${error.message}`);
}

