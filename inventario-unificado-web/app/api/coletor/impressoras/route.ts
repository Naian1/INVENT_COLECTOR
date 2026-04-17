import { NextResponse } from "next/server";
import { validateCollectorBearerToken } from "@/lib/security/collectorAuth";
import { listarImpressoras } from "@/services/impressorasService";

export async function GET(request: Request) {
  const authResult = validateCollectorBearerToken(request.headers.get("authorization"));
  if (!authResult.valid) {
    return NextResponse.json(
      { sucesso: false, erro: authResult.error },
      { status: 401 }
    );
  }

  const result = await listarImpressoras();
  if (!result.success) {
    return NextResponse.json(
      { sucesso: false, erro: result.error },
      { status: result.status ?? 500 }
    );
  }

  const defaultCommunity = process.env.COLLECTOR_DEFAULT_SNMP_COMMUNITY?.trim() || "public";
  const impressoras = result.data
    .filter((item) => item.ativo)
    .map((item) => ({
      id: item.id,
      ip: item.ip,
      patrimonio: item.patrimonio,
      modelo: item.modelo,
      fabricante: item.fabricante,
      numero_serie: item.numero_serie,
      hostname: item.hostname,
      setor: item.setor,
      localizacao: item.localizacao,
      ativa: item.ativo,
      comunidade: defaultCommunity
    }));

  return NextResponse.json({
    sucesso: true,
    dados: {
      total: impressoras.length,
      impressoras
    }
  });
}

