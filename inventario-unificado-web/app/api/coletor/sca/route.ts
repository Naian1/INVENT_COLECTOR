import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/security/apiAuth";
import { listarResumoSca } from "@/services/coletorScaResumoService";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request, { requireAdmin: true });
  if (auth.response) return auth.response;

  const result = await listarResumoSca();

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
