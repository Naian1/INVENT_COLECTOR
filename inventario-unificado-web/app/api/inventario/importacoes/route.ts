/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\inventario\importacoes\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/security/apiAuth';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type LinhaImportacao = {
  cd_cgc?: string;
  nm_empresa?: string;
  nm_tipo_equipamento?: string;
  nm_equipamento?: string;
  ds_equipamento?: string;
  nm_marca?: string;
  nm_modelo?: string;
  nm_setor?: string;
  ds_setor?: string;
  nr_patrimonio?: string;
  nr_serie?: string;
  nr_ip?: string;
};
const MAX_IMPORT_ROWS = 5000;

/**
 * [DOC-FUNC] txt
 * O que faz: A funcao 'txt' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: v. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function txt(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/**
 * [DOC-FUNC] autoCgc
 * O que faz: A funcao 'autoCgc' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: nomeEmpresa. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function autoCgc(nomeEmpresa: string) {
  return `AUTO-${nomeEmpresa.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 18) || 'EMPRESA'}`;
}

/**
 * [DOC-FUNC] upsertEmpresa
 * O que faz: A funcao 'upsertEmpresa' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
 * Entradas: Recebe os parametros: supabase, row. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
async function upsertEmpresa(supabase: ReturnType<typeof getSupabaseServerClient>, row: LinhaImportacao) {
  const nm_empresa = txt(row.nm_empresa) ?? 'SEM EMPRESA';
  const cd_cgc = txt(row.cd_cgc) ?? autoCgc(nm_empresa);

  const { data: existente } = await supabase
    .from('empresa')
    .select('cd_cgc')
    .eq('cd_cgc', cd_cgc)
    .maybeSingle();

  if (existente?.cd_cgc) return existente.cd_cgc as string;

  const { data, error } = await supabase
    .from('empresa')
    .insert([{ cd_cgc, nm_empresa, ie_situacao: 'A' }])
    .select('cd_cgc')
    .single();

  if (error) throw new Error(`Empresa: ${error.message}`);
  return data.cd_cgc as string;
}

/**
 * [DOC-FUNC] upsertTipo
 * O que faz: A funcao 'upsertTipo' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
 * Entradas: Recebe os parametros: supabase, nomeTipo. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
async function upsertTipo(supabase: ReturnType<typeof getSupabaseServerClient>, nomeTipo: string) {
  const { data: existente } = await supabase
    .from('tipo_equipamento')
    .select('cd_tipo_equipamento')
    .ilike('nm_tipo_equipamento', nomeTipo)
    .maybeSingle();

  if (existente?.cd_tipo_equipamento) return Number(existente.cd_tipo_equipamento);

  const { data, error } = await supabase
    .from('tipo_equipamento')
    .insert([{ nm_tipo_equipamento: nomeTipo, ie_situacao: 'A' }])
    .select('cd_tipo_equipamento')
    .single();

  if (error) throw new Error(`Tipo equipamento: ${error.message}`);
  return Number(data.cd_tipo_equipamento);
}

/**
 * [DOC-FUNC] upsertSetor
 * O que faz: A funcao 'upsertSetor' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
 * Entradas: Recebe os parametros: supabase, nomeSetor, dsSetor?. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
async function upsertSetor(supabase: ReturnType<typeof getSupabaseServerClient>, nomeSetor: string, dsSetor?: string | null) {
  const { data: existente } = await supabase
    .from('setor')
    .select('cd_setor')
    .ilike('nm_setor', nomeSetor)
    .maybeSingle();

  if (existente?.cd_setor) return Number(existente.cd_setor);

  const { data, error } = await supabase
    .from('setor')
    .insert([{ nm_setor: nomeSetor, ds_setor: dsSetor ?? null, ie_situacao: 'A' }])
    .select('cd_setor')
    .single();

  if (error) throw new Error(`Setor: ${error.message}`);
  return Number(data.cd_setor);
}

/**
 * [DOC-FUNC] upsertEquipamento
 * O que faz: A funcao 'upsertEquipamento' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
async function upsertEquipamento(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  params: {
    cd_cgc: string;
    cd_tipo_equipamento: number;
    nm_equipamento: string;
    ds_equipamento: string | null;
    nm_marca: string | null;
    nm_modelo: string | null;
  }
) {
  const { data: existente } = await supabase
    .from('equipamento')
    .select('cd_equipamento')
    .eq('cd_cgc', params.cd_cgc)
    .eq('cd_tipo_equipamento', params.cd_tipo_equipamento)
    .ilike('nm_equipamento', params.nm_equipamento)
    .maybeSingle();

  if (existente?.cd_equipamento) return Number(existente.cd_equipamento);

  const { data, error } = await supabase
    .from('equipamento')
    .insert([
      {
        cd_cgc: params.cd_cgc,
        cd_tipo_equipamento: params.cd_tipo_equipamento,
        nm_equipamento: params.nm_equipamento,
        ds_equipamento: params.ds_equipamento,
        nm_marca: params.nm_marca,
        nm_modelo: params.nm_modelo,
        ie_situacao: 'A',
      },
    ])
    .select('cd_equipamento')
    .single();

  if (error) throw new Error(`Equipamento: ${error.message}`);
  return Number(data.cd_equipamento);
}

/**
 * [DOC-FUNC] upsertInventario
 * O que faz: A funcao 'upsertInventario' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) persiste alteracoes somente quando as regras de negocio permitem; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
async function upsertInventario(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  params: {
    cd_equipamento: number;
    cd_setor: number;
    nr_patrimonio: string | null;
    nr_serie: string | null;
    nr_ip: string | null;
  }
) {
  if (params.nr_patrimonio) {
    const { data: existente } = await supabase
      .from('inventario')
      .select('nr_inventario')
      .ilike('nr_patrimonio', params.nr_patrimonio)
      .maybeSingle();

    if (existente?.nr_inventario) {
      const { error: updateError } = await supabase
        .from('inventario')
        .update({
          cd_equipamento: params.cd_equipamento,
          cd_setor: params.cd_setor,
          nr_serie: params.nr_serie,
          nr_ip: params.nr_ip,
          ie_situacao: 'A',
        })
        .eq('nr_inventario', Number(existente.nr_inventario));

      if (updateError) throw new Error(`Inventario update: ${updateError.message}`);
      return { nr_inventario: Number(existente.nr_inventario), atualizado: true };
    }
  }

  const { data, error } = await supabase
    .from('inventario')
    .insert([
      {
        cd_equipamento: params.cd_equipamento,
        cd_setor: params.cd_setor,
        nr_patrimonio: params.nr_patrimonio,
        nr_serie: params.nr_serie,
        nr_ip: params.nr_ip,
        ie_situacao: 'A',
      },
    ])
    .select('nr_inventario')
    .single();

  if (error) throw new Error(`Inventario insert: ${error.message}`);
  return { nr_inventario: Number(data.nr_inventario), atualizado: false };
}

/**
 * [DOC-FUNC] POST
 * O que faz: A funcao 'POST' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) persiste alteracoes somente quando as regras de negocio permitem; 5) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, { requireAdmin: true });
    if (auth.response) return auth.response;

    const body = await request.json();
    const rows = (body?.rows ?? []) as LinhaImportacao[];

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ erro: 'Nenhuma linha para importar.' }, { status: 400 });
    }

    if (rows.length > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        { erro: `Limite excedido. Envie no maximo ${MAX_IMPORT_ROWS} linhas por importacao.` },
        { status: 413 },
      );
    }

    const supabase = getSupabaseServerClient();

    const resultado = {
      total: rows.length,
      criados: 0,
      atualizados: 0,
      erros: 0,
      detalhes_erros: [] as Array<{ linha: number; erro: string }>,
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const nm_tipo = txt(row.nm_tipo_equipamento) ?? 'OUTRO';
        const nm_equipamento = txt(row.nm_equipamento) ?? txt(row.nm_modelo) ?? 'EQUIPAMENTO';
        const nm_setor = txt(row.nm_setor) ?? 'SEM SETOR';

        const cd_cgc = await upsertEmpresa(supabase, row);
        const cd_tipo_equipamento = await upsertTipo(supabase, nm_tipo);
        const cd_setor = await upsertSetor(supabase, nm_setor, txt(row.ds_setor));
        const cd_equipamento = await upsertEquipamento(supabase, {
          cd_cgc,
          cd_tipo_equipamento,
          nm_equipamento,
          ds_equipamento: txt(row.ds_equipamento),
          nm_marca: txt(row.nm_marca),
          nm_modelo: txt(row.nm_modelo),
        });

        const inv = await upsertInventario(supabase, {
          cd_equipamento,
          cd_setor,
          nr_patrimonio: txt(row.nr_patrimonio),
          nr_serie: txt(row.nr_serie),
          nr_ip: txt(row.nr_ip),
        });

        if (inv.atualizado) resultado.atualizados += 1;
        else resultado.criados += 1;
      } catch (err: any) {
        resultado.erros += 1;
        resultado.detalhes_erros.push({
          linha: i + 1,
          erro: err?.message || 'Erro desconhecido',
        });
      }
    }

    return NextResponse.json({ sucesso: true, dados: resultado });
  } catch (error: any) {
    return NextResponse.json({ erro: error.message || 'Erro ao importar' }, { status: 500 });
  }
}

