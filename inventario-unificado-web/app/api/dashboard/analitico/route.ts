/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\dashboard\analitico\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/security/apiAuth";
import { buscarDashboardAnalitico } from "@/services/dashboardAnaliticoService";

/**
 * [DOC-FUNC] GET
 * O que faz: A funcao 'GET' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.response) return auth.response;

  const dias = Number(request.nextUrl.searchParams.get("dias") ?? 30);
  const agrupamento = request.nextUrl.searchParams.get("agrupamento") === "mes" ? "mes" : "dia";
  const setor = request.nextUrl.searchParams.get("setor");
  const localizacao = request.nextUrl.searchParams.get("localizacao");
  const de = request.nextUrl.searchParams.get("de");
  const ate = request.nextUrl.searchParams.get("ate");

  const result = await buscarDashboardAnalitico({
    dias,
    agrupamento,
    setor,
    localizacao,
    de,
    ate
  });

  if (!result.success) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: result.error
      },
      { status: result.status ?? 500 }
    );
  }

  return NextResponse.json(
    {
      sucesso: true,
      dados: result.data
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

