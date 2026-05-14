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
 * O que faz: A funcao 'POST' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
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

