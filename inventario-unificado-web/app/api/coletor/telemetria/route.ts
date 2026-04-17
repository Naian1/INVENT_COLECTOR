import { NextResponse } from "next/server";
import { validateCollectorBearerToken } from "@/lib/security/collectorAuth";
import {
  normalizarPayloadColetorPtParaLote,
  payloadAceitoColetorPtSchema
} from "@/lib/validation/coletorSchemasPtBr";
import { ingerirTelemetriaColetorPt } from "@/services/coletorTelemetriaPtService";

export async function POST(request: Request) {
  const authResult = validateCollectorBearerToken(request.headers.get("authorization"));
  if (!authResult.valid) {
    return NextResponse.json(
      { sucesso: false, erro: authResult.error },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { sucesso: false, erro: "Body JSON invalido." },
      { status: 400 }
    );
  }

  const parsed = payloadAceitoColetorPtSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: "Payload do coletor invalido.",
        detalhes: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const payloadNormalizado = normalizarPayloadColetorPtParaLote(parsed.data);
  const result = await ingerirTelemetriaColetorPt(payloadNormalizado);

  if (result.eventos_processados === 0 && result.erros.length > 0) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: "Nenhum evento foi processado.",
        dados: result
      },
      { status: 422 }
    );
  }

  if (result.erros.length > 0) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: "Parte dos eventos falhou no processamento.",
        dados: result
      },
      { status: 207 }
    );
  }

  return NextResponse.json(
    {
      sucesso: true,
      dados: result
    },
    { status: 200 }
  );
}
