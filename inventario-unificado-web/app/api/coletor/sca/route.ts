import { NextResponse } from "next/server";
import { listarResumoSca } from "@/services/coletorScaResumoService";

export async function GET() {
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
