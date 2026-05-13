/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\coletor\impressoras\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextResponse } from "next/server";
import { validateCollectorBearerToken } from "@/lib/security/collectorAuth";
import { listarImpressoras } from "@/services/impressorasService";

/**
 * [DOC-FUNC] GET
 * O que faz: Implementa o endpoint HTTP GET 'GET' para leitura de dados com resposta padronizada.
 * Entradas: Parametros esperados: request; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato; itera listas/objetos para consolidar calculos e mapeamentos.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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


