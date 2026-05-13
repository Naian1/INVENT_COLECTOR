/**
 * [DOC-CODEMAP] Arquivo: 
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/security/apiAuth";
import { atualizarImpressoraSchema } from "@/lib/validation/impressoraSchemas";
import {
  buscarImpressoraPorId,
  atualizarImpressora
} from "@/services/impressorasService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * [DOC-FUNC] GET
 * O que faz: Implementa o endpoint HTTP GET 'GET' para leitura de dados com resposta padronizada.
 * Entradas: Parametros esperados: request, context; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await authenticateApiRequest(request);
  if (auth.response) return auth.response;

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

/**
 * [DOC-FUNC] PATCH
 * O que faz: Implementa o endpoint HTTP PATCH 'PATCH' para mutar estado com seguranca e consistencia.
 * Entradas: Parametros esperados: request, context; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato; executa atualizacao de forma controlada; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await authenticateApiRequest(request, { requireAdmin: true });
  if (auth.response) return auth.response;

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

