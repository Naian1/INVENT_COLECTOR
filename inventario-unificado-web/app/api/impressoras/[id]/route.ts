import { NextResponse } from "next/server";
import { atualizarImpressoraSchema } from "@/lib/validation/impressoraSchemas";
import {
  buscarImpressoraPorId,
  atualizarImpressora
} from "@/services/impressorasService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const result = await buscarImpressoraPorId(id);

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

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const existente = await buscarImpressoraPorId(id);
  if (!existente.success) {
    return NextResponse.json(
      { sucesso: false, erro: existente.error },
      { status: existente.status ?? 500 }
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

  const parsed = atualizarImpressoraSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: "Payload invalido.",
        detalhes: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const result = await atualizarImpressora(id, parsed.data);
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
