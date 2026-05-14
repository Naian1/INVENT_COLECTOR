/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\inventario\consolidado\linhas\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/security/apiAuth';
import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * [DOC-FUNC] validarCompetencia
 * O que faz: A funcao 'validarCompetencia' verifica condicoes de validade do fluxo. Ela retorna um sinal objetivo (ou erro) para decidir se a execucao pode continuar com seguranca.
 * Entradas: Recebe os parametros: competencia. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
 * Retorno/Efeitos: Retorna verdadeiro/falso para orientar o proximo passo do fluxo sem ambiguidade, facilitando leitura e depuracao.
 */
function validarCompetencia(competencia: string): boolean {
  return /^(0[1-9]|1[0-2])\/[0-9]{4}$/.test(competencia);
}

/**
 * [DOC-FUNC] limparTexto
 * O que faz: A funcao 'limparTexto' remove ou inativa registros conforme as regras do sistema. O foco e preservar integridade e rastreabilidade durante a operacao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function limparTexto(value: string | null): string | null {
  if (!value) return null;
  const texto = value.trim();
  return texto ? texto : null;
}

/**
 * [DOC-FUNC] GET
 * O que faz: A funcao 'GET' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) percorre colecoes quando necessario para consolidar ou transformar resultados; 5) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
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

