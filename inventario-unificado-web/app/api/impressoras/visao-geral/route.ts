import { NextResponse } from "next/server";
import { listarVisaoGeralImpressoras } from "@/services/visaoGeralImpressorasService";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const incluirNaoOperacionais = url.searchParams.get("incluir_nao_operacionais") === "true";
  const cacheControl = incluirNaoOperacionais
    ? "public, s-maxage=10, stale-while-revalidate=30"
    : "public, s-maxage=20, stale-while-revalidate=60";

  const result = await listarVisaoGeralImpressoras({
    incluir_nao_operacionais: incluirNaoOperacionais
  });

  if (!result.success) {
    return NextResponse.json(
      { sucesso: false, erro: result.error },
      {
        status: result.status ?? 500,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }

  return NextResponse.json(
    {
      sucesso: true,
      dados: result.data
    },
    { headers: { "Cache-Control": cacheControl } }
  );
}
