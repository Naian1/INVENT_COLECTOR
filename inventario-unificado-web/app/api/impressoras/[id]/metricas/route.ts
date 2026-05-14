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
 * O que faz: A funcao 'getDefaultMonthRange' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'isValidDateString' verifica condicoes de validade do fluxo. Ela retorna um sinal objetivo (ou erro) para decidir se a execucao pode continuar com seguranca.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna verdadeiro/falso para orientar o proximo passo do fluxo sem ambiguidade, facilitando leitura e depuracao.
 */
function isValidDateString(value: string) {
  return !Number.isNaN(Date.parse(value));
}

/**
 * [DOC-FUNC] GET
 * O que faz: A funcao 'GET' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request, context. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
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

