/**
 * [DOC-CODEMAP] Arquivo: 
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/security/apiAuth";
import { buscarStatusSuprimentosImpressora } from "@/services/statusSuprimentosImpressorasService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * [DOC-FUNC] GET
 * O que faz: Implementa o endpoint HTTP GET 'GET' para leitura de dados com resposta padronizada.
 * Entradas: Parametros esperados: request, context; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await authenticateApiRequest(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const result = await buscarStatusSuprimentosImpressora(id);

  if (!result.success) {
    return NextResponse.json(
      { sucesso: false, erro: result.error },
      { status: result.status ?? 500 }
    );
  }

  return NextResponse.json({
    sucesso: true,
    dados: result.data
  });
}

