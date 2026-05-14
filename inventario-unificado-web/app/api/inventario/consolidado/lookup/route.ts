/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\inventario\consolidado\lookup\route.ts
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
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const params = request.nextUrl.searchParams;
    const patrimonio = limparTexto(params.get('patrimonio'));
    const competencia = limparTexto(params.get('competencia'));

    if (!patrimonio) {
      return NextResponse.json({ error: 'Informe o patrimonio para busca.' }, { status: 400 });
    }

    if (competencia && !validarCompetencia(competencia)) {
      return NextResponse.json({ error: 'Competencia invalida. Use MM/AAAA.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    let cargaSelecionada: { nr_carga: number; nr_competencia: string } | null = null;

    if (competencia) {
      const { data, error } = await supabase
        .from('inventario_consolidado_carga')
        .select('nr_carga, nr_competencia')
        .eq('nr_competencia', competencia)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (data?.nr_carga) {
        cargaSelecionada = {
          nr_carga: Number(data.nr_carga),
          nr_competencia: String(data.nr_competencia),
        };
      }
    } else {
      const { data, error } = await supabase
        .from('inventario_consolidado_carga')
        .select('nr_carga, nr_competencia')
        .order('dt_importacao', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (data?.nr_carga) {
        cargaSelecionada = {
          nr_carga: Number(data.nr_carga),
          nr_competencia: String(data.nr_competencia),
        };
      }
    }

    if (!cargaSelecionada) {
      return NextResponse.json({ encontrado: false, motivo: 'Sem consolidado cadastrado.' });
    }

    const { data: linhas, error: linhasError } = await supabase
      .from('inventario_consolidado_linha')
      .select(
        'nr_linha, nr_patrimonio, nr_serie, nm_tipo, ds_produto, nr_id_equipamento, nm_cliente, nm_local, tp_status',
      )
      .eq('nr_carga', cargaSelecionada.nr_carga)
      .ilike('nr_patrimonio', `%${patrimonio}%`)
      .order('nr_linha', { ascending: true })
      .limit(10);

    if (linhasError) {
      throw new Error(linhasError.message);
    }

    if (!linhas || linhas.length === 0) {
      return NextResponse.json({
        encontrado: false,
        competencia: cargaSelecionada.nr_competencia,
        motivo: 'Patrimonio nao encontrado na competencia selecionada.',
      });
    }

    const correspondenciaExata =
      linhas.find(
        (item) =>
          String(item.nr_patrimonio || '').trim().toUpperCase() === patrimonio.toUpperCase(),
      ) || linhas[0];

    return NextResponse.json({
      encontrado: true,
      competencia: cargaSelecionada.nr_competencia,
      item: correspondenciaExata,
      candidatos: linhas,
    });
  } catch (error: any) {
    console.error('[GET /api/inventario/consolidado/lookup]', error);
    return NextResponse.json({ error: error.message || 'Falha ao buscar patrimonio.' }, { status: 500 });
  }
}

