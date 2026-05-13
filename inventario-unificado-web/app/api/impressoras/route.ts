/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\impressoras\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/security/apiAuth";
import { criarImpressoraSchema } from "@/lib/validation/impressoraSchemas";
import { criarImpressora, listarImpressoras } from "@/services/impressorasService";

/**
 * [DOC-FUNC] GET
 * O que faz: Implementa o endpoint HTTP GET 'GET' para leitura de dados com resposta padronizada.
 * Entradas: Parametros esperados: request; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
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

/**
 * [DOC-FUNC] POST
 * O que faz: Implementa o endpoint HTTP POST 'POST' para receber payload, validar regras e processar/gravar dados.
 * Entradas: Parametros esperados: request; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
 */
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

