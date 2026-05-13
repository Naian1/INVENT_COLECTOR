/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\impressoras\visao-geral\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/security/apiAuth";
import { listarVisaoGeralImpressoras } from "@/services/visaoGeralImpressorasService";

/**
 * [DOC-FUNC] GET
 * Objetivo: Executa a rotina de 'g et'.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.response) return auth.response;

  const incluirNaoOperacionais = request.nextUrl.searchParams.get("incluir_nao_operacionais") === "true";
  const cacheControl = "private, no-store";

  const result = await listarVisaoGeralImpressoras({
    incluir_nao_operacionais: incluirNaoOperacionais
  });

  if (!result.success) {
    return NextResponse.json(
      { sucesso: false, erro: result.error },
      {
        status: result.status ?? 500,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }

  return NextResponse.json(
    {
      sucesso: true,
      dados: result.data
    },
    { headers: { "Cache-Control": cacheControl } }
  );
}

