/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\dashboard\resumo\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/security/apiAuth";
import { buscarResumoDashboard } from "@/services/resumoDashboardService";

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

  const resumo = await buscarResumoDashboard();

  return NextResponse.json({
    sucesso: true,
    dados: resumo
  });
}

