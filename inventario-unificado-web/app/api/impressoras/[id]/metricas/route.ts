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
 * O que faz: Consulta e organiza informacoes na funcao 'getDefaultMonthRange', entregando retorno confiavel para camadas superiores.
 * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
 * Como executa: Padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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
 * O que faz: Avalia condicoes de controle na funcao 'isValidDateString' para decidir se o fluxo pode avancar.
 * Entradas: Parametros esperados: value; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna verdadeiro/falso para controlar a continuidade do fluxo nas proximas etapas.
 */
function isValidDateString(value: string) {
  return !Number.isNaN(Date.parse(value));
}

/**
 * [DOC-FUNC] GET
 * O que faz: Implementa o endpoint HTTP GET 'GET' para leitura de dados com resposta padronizada.
 * Entradas: Parametros esperados: request, context; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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

