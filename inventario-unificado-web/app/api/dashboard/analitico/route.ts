/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\dashboard\analitico\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/security/apiAuth";
import { buscarDashboardAnalitico } from "@/services/dashboardAnaliticoService";

/**
 * [DOC-FUNC] GET
 * O que faz: Implementa o endpoint HTTP GET 'GET' para leitura de dados com resposta padronizada.
 * Entradas: Parametros esperados: request; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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

