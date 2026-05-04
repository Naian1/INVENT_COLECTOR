import { NextRequest, NextResponse } from "next/server";

import { authenticateApiRequest } from "@/lib/security/apiAuth";
import { buscarResumoTelemetriaDiaria } from "@/services/telemetriaDiariaService";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.response) return auth.response;

  const dias = Number(request.nextUrl.searchParams.get("dias") ?? 30);
  const result = await buscarResumoTelemetriaDiaria({ dias });

  if (!result.success) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: result.error,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      sucesso: true,
      dados: result.data,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
