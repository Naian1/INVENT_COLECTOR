/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\dashboard\analitico\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/security/apiAuth";
import { buscarDashboardAnalitico } from "@/services/dashboardAnaliticoService";

/**
 * [DOC-FUNC] GET
 * O que faz: Implementa endpoint HTTP GET 'GET', retornando dados de forma segura e padronizada.
 * Entradas: Parametros esperados: request; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna resposta de leitura tipada/padronizada ou erro claro de validacao/autorizacao/acesso.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.response) return auth.response;

  const dias = Number(request.nextUrl.searchParams.get("dias") ?? 30);
  const agrupamento = request.nextUrl.searchParams.get("agrupamento") === "mes" ? "mes" : "dia";
  const setor = request.nextUrl.searchParams.get("setor");
  const localizacao = request.nextUrl.searchParams.get("localizacao");
  const de = request.nextUrl.searchParams.get("de");
  const ate = request.nextUrl.searchParams.get("ate");

  const result = await buscarDashboardAnalitico({
    dias,
    agrupamento,
    setor,
    localizacao,
    de,
    ate
  });

  if (!result.success) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: result.error
      },
      { status: result.status ?? 500 }
    );
  }

  return NextResponse.json(
    {
      sucesso: true,
      dados: result.data
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

