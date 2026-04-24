import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Empresa, CreateEmpresaInput, UpdateEmpresaInput } from '@/types/empresa';

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

export async function deleteEmpresa(cdCgc: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('empresa')
    .update({ ie_situacao: 'I' })
    .eq('cd_cgc', cdCgc);

  if (error) throw new Error(`Erro ao inativar empresa: ${error.message}`);
}
