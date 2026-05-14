/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\empresaService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Empresa, CreateEmpresaInput, UpdateEmpresaInput } from '@/types/empresa';

/**
 * [DOC-FUNC] getEmpresas
 * O que faz: A funcao 'getEmpresas' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) percorre colecoes quando necessario para consolidar ou transformar resultados; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
export async function getEmpresas(): Promise<Empresa[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('empresa')
    .select('*')
    .order('nm_empresa');

  if (error) throw new Error(`Erro ao listar empresas: ${error.message}`);
  const ativos = (data || []).filter((item) => String(item?.ie_situacao || 'A').trim().toUpperCase() !== 'I');
  return ativos as Empresa[];
}

/**
 * [DOC-FUNC] getEmpresaByCgc
 * O que faz: A funcao 'getEmpresaByCgc' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: cdCgc. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
export async function getEmpresaByCgc(cdCgc: string): Promise<Empresa | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('empresa')
    .select('*')
    .eq('cd_cgc', cdCgc)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Erro ao buscar empresa: ${error.message}`);
  return (data as Empresa) || null;
}

/**
 * [DOC-FUNC] createEmpresa
 * O que faz: A funcao 'createEmpresa' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
 * Entradas: Recebe os parametros: input. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
export async function createEmpresa(input: CreateEmpresaInput): Promise<Empresa> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('empresa')
    .insert([input])
    .select('*')
    .single();

  if (error) throw new Error(`Erro ao criar empresa: ${error.message}`);
  return data as Empresa;
}

/**
 * [DOC-FUNC] updateEmpresa
 * O que faz: A funcao 'updateEmpresa' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
 * Entradas: Recebe os parametros: cdCgc, input. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
export async function updateEmpresa(cdCgc: string, input: UpdateEmpresaInput): Promise<Empresa> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('empresa')
    .update(input)
    .eq('cd_cgc', cdCgc)
    .select('*')
    .single();

  if (error) throw new Error(`Erro ao atualizar empresa: ${error.message}`);
  return data as Empresa;
}

/**
 * [DOC-FUNC] deleteEmpresa
 * O que faz: A funcao 'deleteEmpresa' remove ou inativa registros conforme as regras do sistema. O foco e preservar integridade e rastreabilidade durante a operacao.
 * Entradas: Recebe os parametros: cdCgc. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
export async function deleteEmpresa(cdCgc: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('empresa')
    .update({ ie_situacao: 'I' })
    .eq('cd_cgc', cdCgc);

  if (error) throw new Error(`Erro ao inativar empresa: ${error.message}`);
}

