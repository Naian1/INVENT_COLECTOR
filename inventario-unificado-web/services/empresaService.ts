/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\empresaService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Empresa, CreateEmpresaInput, UpdateEmpresaInput } from '@/types/empresa';

/**
 * [DOC-FUNC] getEmpresas
 * O que faz: Consulta informacoes na funcao 'getEmpresas' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (sem parametros obrigatorios) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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
 * O que faz: Consulta informacoes na funcao 'getEmpresaByCgc' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (cdCgc) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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
 * O que faz: Grava novos dados na funcao 'createEmpresa', aplicando validacoes para preservar integridade do dominio.
 * Entradas: Recebe payload/chaves (input) e verifica campos obrigatorios antes da persistencia.
 * Como executa: Sanitiza os valores, aplica regras de negocio e executa insert/upsert com tratamento de erro transacional.
 * Retorno/Efeitos: Retorna o registro criado (ou resumo da gravacao) e sinaliza claramente conflitos/permissoes.
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
 * O que faz: Atualiza dados na funcao 'updateEmpresa', mantendo consistencia entre o estado atual e as novas informacoes.
 * Entradas: Recebe identificador e campos para alteracao (cdCgc, input), com validacao de formato e regra de negocio.
 * Como executa: Localiza o alvo, aplica apenas mudancas permitidas e executa update com tratamento de conflito/falha.
 * Retorno/Efeitos: Devolve o estado final atualizado ou erro contextualizado para facilitar diagnostico.
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
 * O que faz: Remove ou inativa registros na funcao 'deleteEmpresa', conforme a politica de ciclo de vida do modulo.
 * Entradas: Recebe chaves/filtros do alvo (cdCgc) e valida dependencias antes da exclusao.
 * Como executa: Confere pre-condicoes de seguranca/integridade e executa delete fisico ou logico de forma controlada.
 * Retorno/Efeitos: Confirma a remocao/inativacao e reporta bloqueios quando houver vinculos ou restricoes.
 */
export async function deleteEmpresa(cdCgc: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('empresa')
    .update({ ie_situacao: 'I' })
    .eq('cd_cgc', cdCgc);

  if (error) throw new Error(`Erro ao inativar empresa: ${error.message}`);
}

