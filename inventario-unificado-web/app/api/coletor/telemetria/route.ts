/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\coletor\telemetria\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextResponse } from "next/server";
import { validateCollectorBearerToken } from "@/lib/security/collectorAuth";
import {
  normalizarPayloadColetorPtParaLote,
  payloadAceitoColetorPtSchema
} from "@/lib/validation/coletorSchemasPtBr";
import { ingerirTelemetriaColetorPt } from "@/services/coletorTelemetriaPtService";

/**
 * [DOC-FUNC] POST
 * O que faz: Implementa endpoint HTTP POST 'POST', validando payload e processando persistencia/integracao.
 * Entradas: Parametros esperados: request; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna resultado da operacao de escrita/processamento e efeitos de persistencia quando aplicavel.
 */
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

