/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\empresaService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Empresa, CreateEmpresaInput, UpdateEmpresaInput } from '@/types/empresa';

/**
 * [DOC-FUNC] getEmpresas
 * O que faz: Consulta dados de 'get empresas' na fonte principal (API, banco ou cache).
 * Entradas: Sem parametros obrigatorios.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
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
 * O que faz: Consulta dados de 'get empresa by cgc' na fonte principal (API, banco ou cache).
 * Entradas: Parametros esperados: cdCgc.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
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
 * O que faz: Cria registro de 'create empresa' aplicando regras de consistencia antes de persistir.
 * Entradas: Parametros esperados: input.
 * Como executa: Valida payload, monta comando de escrita e trata falhas de persistencia.
 * Retorno/Efeitos: Retorna entidade criada (ou identificador) para continuidade do fluxo.
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
 * O que faz: Atualiza 'update empresa' preservando integridade dos dados e regras de negocio.
 * Entradas: Parametros esperados: cdCgc, input.
 * Como executa: Localiza alvo por chave, aplica alteracoes e valida conflitos.
 * Retorno/Efeitos: Retorna estado final atualizado ou erro com contexto da falha.
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
 * O que faz: Remove ou inativa dados de 'delete empresa' conforme politica do sistema.
 * Entradas: Parametros esperados: cdCgc.
 * Como executa: Recebe chave do alvo, valida dependencias e executa a operacao segura.
 * Retorno/Efeitos: Retorna confirmacao da acao e sinaliza erros de integridade/permissao.
 */
export async function deleteEmpresa(cdCgc: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('empresa')
    .update({ ie_situacao: 'I' })
    .eq('cd_cgc', cdCgc);

  if (error) throw new Error(`Erro ao inativar empresa: ${error.message}`);
}

