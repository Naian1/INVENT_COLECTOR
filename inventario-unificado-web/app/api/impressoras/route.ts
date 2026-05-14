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
 * O que faz: Implementa endpoint HTTP GET 'GET', retornando dados de forma segura e padronizada.
 * Entradas: Parametros esperados: request; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos.
 * Retorno/Efeitos: Retorna resposta de leitura tipada/padronizada ou erro claro de validacao/autorizacao/acesso.
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
 * O que faz: Implementa endpoint HTTP POST 'POST', validando payload e processando persistencia/integracao.
 * Entradas: Parametros esperados: request; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna resultado da operacao de escrita/processamento e efeitos de persistencia quando aplicavel.
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

