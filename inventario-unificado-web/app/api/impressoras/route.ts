import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/security/apiAuth";
import { criarImpressoraSchema } from "@/lib/validation/impressoraSchemas";
import { criarImpressora, listarImpressoras } from "@/services/impressorasService";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.response) return auth.response;

  const result = await listarImpressoras();

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

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request, { requireAdmin: true });
  if (auth.response) return auth.response;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { sucesso: false, erro: "Body JSON invalido." },
      { status: 400 }
    );
  }

  const parsed = criarImpressoraSchema.safeParse(body);
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

  const result = await criarImpressora(parsed.data);
  if (!result.success) {
    return NextResponse.json(
      { sucesso: false, erro: result.error },
      { status: result.status ?? 500 }
    );
  }

  return NextResponse.json(
    {
      sucesso: true,
      dados: result.data
    },
    { status: 201 }
  );
}
