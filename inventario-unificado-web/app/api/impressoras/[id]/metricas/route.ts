/**
 * [DOC-CODEMAP] Arquivo: 
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/security/apiAuth";
import { buscarImpressoraPorId } from "@/services/impressorasService";
import { buscarMetricasImpressoraPorPeriodo } from "@/services/metricasImpressorasService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * [DOC-FUNC] getDefaultMonthRange
 * O que faz: Consulta e organiza informacoes na funcao 'getDefaultMonthRange' para retorno confiavel.
 * Entradas: Parametros esperados: sem parametros obrigatorios; com validacao de formato e fallback quando necessario.
 * Como executa: Padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
 */
function getDefaultMonthRange() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    de: monthStart.toISOString(),
    ate: now.toISOString()
  };
}

/**
 * [DOC-FUNC] isValidDateString
 * O que faz: Avalia condicoes de controle na funcao 'isValidDateString' para permitir ou bloquear o proximo passo.
 * Entradas: Parametros esperados: value; com validacao de formato e fallback quando necessario.
 * Como executa: Padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna verdadeiro/falso para conduzir o fluxo de negocio de forma segura.
 */
function isValidDateString(value: string) {
  return !Number.isNaN(Date.parse(value));
}

/**
 * [DOC-FUNC] GET
 * O que faz: Implementa endpoint HTTP GET 'GET', retornando dados de forma segura e padronizada.
 * Entradas: Parametros esperados: request, context; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna resposta de leitura tipada/padronizada ou erro claro de validacao/autorizacao/acesso.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await authenticateApiRequest(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;

  const impressora = await buscarImpressoraPorId(id);
  if (!impressora.success) {
    return NextResponse.json(
      { sucesso: false, erro: impressora.error },
      { status: impressora.status ?? 500 }
    );
  }

  const { searchParams } = request.nextUrl;
  const defaults = getDefaultMonthRange();

  const de = searchParams.get("de") ?? searchParams.get("from") ?? defaults.de;
  const ate = searchParams.get("ate") ?? searchParams.get("to") ?? defaults.ate;

  if (!isValidDateString(de) || !isValidDateString(ate)) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: "Parametros de/ate invalidos. Use ISO 8601 (ex: 2026-03-01T00:00:00Z)."
      },
      { status: 400 }
    );
  }

  if (new Date(de).getTime() > new Date(ate).getTime()) {
    return NextResponse.json(
      { sucesso: false, erro: "O parametro de nao pode ser maior que ate." },
      { status: 400 }
    );
  }

  const metricas = await buscarMetricasImpressoraPorPeriodo(id, de, ate);
  if (!metricas.success) {
    return NextResponse.json(
      { sucesso: false, erro: metricas.error },
      { status: metricas.status ?? 500 }
    );
  }

  return NextResponse.json({
    sucesso: true,
    dados: metricas.data
  });
}

