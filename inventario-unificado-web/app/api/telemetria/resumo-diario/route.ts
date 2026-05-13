/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\telemetria\resumo-diario\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";

import { authenticateApiRequest } from "@/lib/security/apiAuth";
import { buscarResumoTelemetriaDiaria } from "@/services/telemetriaDiariaService";

/**
 * [DOC-FUNC] GET
 * O que faz: Consulta dados de 'get' na fonte principal (API, banco ou cache).
 * Entradas: Parametros esperados: request.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.response) return auth.response;

  // Filtros opcionais chegam via query string e sao validados na camada de servico.
  const dias = Number(request.nextUrl.searchParams.get("dias") ?? 30);
  const de = request.nextUrl.searchParams.get("de");
  const ate = request.nextUrl.searchParams.get("ate");
  const setor = request.nextUrl.searchParams.get("setor");
  const localizacao = request.nextUrl.searchParams.get("localizacao");
  const modelo = request.nextUrl.searchParams.get("modelo");

  const result = await buscarResumoTelemetriaDiaria({
    dias,
    de,
    ate,
    setor,
    localizacao,
    modelo,
  });

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

