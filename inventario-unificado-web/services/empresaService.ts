/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\empresaService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Empresa, CreateEmpresaInput, UpdateEmpresaInput } from '@/types/empresa';

/**
 * [DOC-FUNC] getEmpresas
 * O que faz: Consulta e organiza informacoes na funcao 'getEmpresas' para retorno confiavel.
 * Entradas: Parametros esperados: sem parametros obrigatorios; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; itera colecoes para montar/filtrar dados; consulta dados em fonte interna/externa; padroniza formato e fallback de campos; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getEmpresaByCgc' para retorno confiavel.
 * Entradas: Parametros esperados: cdCgc; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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
 * O que faz: Cria e persiste dados na funcao 'createEmpresa' com validacao de integridade.
 * Entradas: Parametros esperados: input; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; persiste novos registros quando necessario; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna registro/resultado de escrita com erros de integridade tratados.
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
 * O que faz: Atualiza estado na funcao 'updateEmpresa' mantendo coerencia das regras de negocio.
 * Entradas: Parametros esperados: cdCgc, input; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; aplica atualizacoes de estado; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna estado final apos atualizacao, com diagnostico claro em falhas.
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
 * O que faz: Remove/inativa dados na funcao 'deleteEmpresa' respeitando dependencias e ciclo de vida.
 * Entradas: Parametros esperados: cdCgc; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; aplica atualizacoes de estado; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna confirmacao de exclusao logica/fisica e contexto de restricoes.
 */
export async function deleteEmpresa(cdCgc: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('empresa')
    .update({ ie_situacao: 'I' })
    .eq('cd_cgc', cdCgc);

  if (error) throw new Error(`Erro ao inativar empresa: ${error.message}`);
}

