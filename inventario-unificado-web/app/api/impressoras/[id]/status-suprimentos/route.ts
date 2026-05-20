/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web/app/api/impressoras/[id]/status-suprimentos/route.ts
 * [DOC-CODEMAP] Papel: Rota API que consulta suprimentos e alertas de uma impressora especifica.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/security/apiAuth";
import { buscarStatusSuprimentosImpressora } from "@/services/statusSuprimentosImpressorasService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * [DOC-FUNC] GET
 * O que faz: A funcao 'GET' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request, context. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await authenticateApiRequest(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const result = await buscarStatusSuprimentosImpressora(id);

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
