import { NextResponse } from "next/server";
import { buscarStatusSuprimentosImpressora } from "@/services/statusSuprimentosImpressorasService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
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
