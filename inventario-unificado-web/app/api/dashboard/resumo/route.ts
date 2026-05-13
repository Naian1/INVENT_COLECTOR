/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\dashboard\resumo\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/security/apiAuth";
import { buscarResumoDashboard } from "@/services/resumoDashboardService";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.response) return auth.response;

  const resumo = await buscarResumoDashboard();

  return NextResponse.json({
    sucesso: true,
    dados: resumo
  });
}

