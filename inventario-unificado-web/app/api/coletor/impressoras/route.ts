/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\coletor\impressoras\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextResponse } from "next/server";
import { validateCollectorBearerToken } from "@/lib/security/collectorAuth";
import { listarImpressoras } from "@/services/impressorasService";

/**
 * [DOC-FUNC] GET
 * O que faz: A funcao 'GET' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) percorre colecoes quando necessario para consolidar ou transformar resultados; 4) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
 */
export async function GET(request: Request) {
  const authResult = validateCollectorBearerToken(request.headers.get("authorization"));
  if (!authResult.valid) {
    return NextResponse.json(
      { sucesso: false, erro: authResult.error },
      { status: 401 }
    );
  }

  const result = await listarImpressoras();
  if (!result.success) {
    return NextResponse.json(
      { sucesso: false, erro: result.error },
      { status: result.status ?? 500 }
    );
  }

  const defaultCommunity = process.env.COLLECTOR_DEFAULT_SNMP_COMMUNITY?.trim() || "public";
  const impressoras = result.data
    .filter((item) => item.ativo)
    .map((item) => ({
      id: item.id,
      ip: item.ip,
      patrimonio: item.patrimonio,
      modelo: item.modelo,
      fabricante: item.fabricante,
      numero_serie: item.numero_serie,
      hostname: item.hostname,
      setor: item.setor,
      localizacao: item.localizacao,
      ativa: item.ativo,
      comunidade: defaultCommunity
    }));

  return NextResponse.json({
    sucesso: true,
    dados: {
      total: impressoras.length,
      impressoras
    }
  });
}


