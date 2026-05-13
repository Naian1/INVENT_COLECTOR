/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\inventario\consolidado\linhas\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/security/apiAuth';
import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * [DOC-FUNC] validarCompetencia
 * O que faz: Orquestra a etapa 'validarCompetencia' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
 * Entradas: Trabalha com os parametros declarados (competencia) e com contexto local carregado durante a execucao.
 * Como executa: Encadeia avaliacoes condicionais, tratamento explicito de excecoes, garantindo continuidade do processamento mesmo com entradas variaveis.
 * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
 */
function validarCompetencia(competencia: string): boolean {
  return /^(0[1-9]|1[0-2])\/[0-9]{4}$/.test(competencia);
}

/**
 * [DOC-FUNC] limparTexto
 * O que faz: Normaliza valores na funcao 'limparTexto', reduzindo variacoes de formato antes do processamento principal.
 * Entradas: Recebe dados possivelmente incompletos ou heterogeneos (value) e trata nulos, strings vazias e tipos mistos.
 * Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
 * Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
 */
function limparTexto(value: string | null): string | null {
  if (!value) return null;
  const texto = value.trim();
  return texto ? texto : null;
}

/**
 * [DOC-FUNC] GET
 * O que faz: Implementa o endpoint HTTP GET 'GET', usado para leitura de dados pela interface e por integracoes.
 * Entradas: Le query params, cabecalhos/autenticacao e contexto da requisicao; assinatura local: request.
 * Como executa: Valida filtros recebidos, consulta servicos/repositorios, trata erros de dominio e padroniza o payload de resposta.
 * Retorno/Efeitos: Devolve JSON com status HTTP coerente (200/4xx/5xx), sem gravacao de estado no fluxo principal.
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

