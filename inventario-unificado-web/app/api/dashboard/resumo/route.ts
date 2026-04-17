import { NextResponse } from "next/server";
import { buscarResumoDashboard } from "@/services/resumoDashboardService";

export async function GET() {
  const resumo = await buscarResumoDashboard();

  return NextResponse.json({
    sucesso: true,
    dados: resumo
  });
}
