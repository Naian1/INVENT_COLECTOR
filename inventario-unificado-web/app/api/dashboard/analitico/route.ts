import { NextResponse } from "next/server";
import { buscarDashboardAnalitico } from "@/services/dashboardAnaliticoService";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dias = Number(url.searchParams.get("dias") ?? 30);
  const agrupamento = url.searchParams.get("agrupamento") === "mes" ? "mes" : "dia";
  const setor = url.searchParams.get("setor");
  const localizacao = url.searchParams.get("localizacao");

  const result = await buscarDashboardAnalitico({
    dias,
    agrupamento,
    setor,
    localizacao
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
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
  );
}
