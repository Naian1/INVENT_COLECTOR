/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\inventario\consolidado\linhas\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/security/apiAuth';
import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * [DOC-FUNC] validarCompetencia
 * O que faz: Executa a responsabilidade central da funcao 'validarCompetencia', conectando validacao, processamento e retorno de forma didatica.
 * Entradas: Parametros esperados: competencia; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Executa um fluxo linear de validacao e processamento local, mantendo resultado previsivel para quem consome a funcao.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora com contrato claro de sucesso e falha.
 */
function validarCompetencia(competencia: string): boolean {
  return /^(0[1-9]|1[0-2])\/[0-9]{4}$/.test(competencia);
}

/**
 * [DOC-FUNC] limparTexto
 * O que faz: Normaliza entradas na funcao 'limparTexto', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: value; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
 */
function limparTexto(value: string | null): string | null {
  if (!value) return null;
  const texto = value.trim();
  return texto ? texto : null;
}

/**
 * [DOC-FUNC] GET
 * O que faz: Implementa o endpoint HTTP GET 'GET' para leitura de dados com resposta padronizada.
 * Entradas: Parametros esperados: request; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; padroniza campos para evitar divergencia de formato; itera listas/objetos para consolidar calculos e mapeamentos; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const params = request.nextUrl.searchParams;
    const competenciaParam = limparTexto(params.get('competencia'));
    const patrimonio = limparTexto(params.get('patrimonio'));
    const serie = limparTexto(params.get('serie'));
    const limite = Number(params.get('limite') || 200);

    if (competenciaParam && !validarCompetencia(competenciaParam)) {
      return NextResponse.json({ error: 'Competencia invalida. Use MM/AAAA.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data: cargas, error: cargasError } = await supabase
      .from('inventario_consolidado_carga')
      .select('nr_carga, nr_competencia, nm_arquivo, nr_total_linhas, dt_importacao')
      .order('dt_importacao', { ascending: false })
      .limit(24);

    if (cargasError) {
      throw new Error(cargasError.message);
    }

    const listaCargas = (cargas || []).map((carga) => ({
      nr_carga: Number(carga.nr_carga),
      nr_competencia: String(carga.nr_competencia),
      nm_arquivo: String(carga.nm_arquivo || ''),
      nr_total_linhas: Number(carga.nr_total_linhas || 0),
      dt_importacao: String(carga.dt_importacao || ''),
    }));

    if (listaCargas.length === 0) {
      return NextResponse.json({
        cargas: [],
        cargaSelecionada: null,
        filtros: {
          competencia: competenciaParam,
          patrimonio,
          serie,
        },
        linhas: [],
      });
    }

    const cargaSelecionada = competenciaParam
      ? listaCargas.find((item) => item.nr_competencia === competenciaParam) || null
      : listaCargas[0];

    if (!cargaSelecionada) {
      return NextResponse.json({
        cargas: listaCargas,
        cargaSelecionada: null,
        filtros: {
          competencia: competenciaParam,
          patrimonio,
          serie,
        },
        linhas: [],
      });
    }

    let query = supabase
      .from('inventario_consolidado_linha')
      .select(
        'nr_linha, nr_patrimonio, nr_serie, nr_id_equipamento, nm_tipo, ds_produto, nm_cliente, nm_local, tp_status, nr_nf_faturamento, dt_faturamento',
      )
      .eq('nr_carga', cargaSelecionada.nr_carga)
      .order('nr_linha', { ascending: true })
      .limit(Math.max(1, Math.min(1000, limite)));

    if (patrimonio) {
      query = query.ilike('nr_patrimonio', `%${patrimonio}%`);
    }

    if (serie) {
      query = query.ilike('nr_serie', `%${serie}%`);
    }

    const { data: linhas, error: linhasError } = await query;

    if (linhasError) {
      throw new Error(linhasError.message);
    }

    return NextResponse.json({
      cargas: listaCargas,
      cargaSelecionada,
      filtros: {
        competencia: cargaSelecionada.nr_competencia,
        patrimonio,
        serie,
      },
      linhas: linhas || [],
    });
  } catch (error: any) {
    console.error('[GET /api/inventario/consolidado/linhas]', error);
    return NextResponse.json(
      { error: error.message || 'Falha ao consultar linhas do consolidado.' },
      { status: 500 },
    );
  }
}

