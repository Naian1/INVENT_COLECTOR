import { NextResponse } from "next/server";
import { buscarImpressoraPorId } from "@/services/impressorasService";
import { buscarMetricasImpressoraPorPeriodo } from "@/services/metricasImpressorasService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function getDefaultMonthRange() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    de: monthStart.toISOString(),
    ate: now.toISOString()
  };
}

function isValidDateString(value: string) {
  return !Number.isNaN(Date.parse(value));
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const impressora = await buscarImpressoraPorId(id);
  if (!impressora.success) {
    return NextResponse.json(
      { sucesso: false, erro: impressora.error },
      { status: impressora.status ?? 500 }
    );
  }

  const { searchParams } = new URL(request.url);
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
