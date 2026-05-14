/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\lib\security\collectorAuth.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { timingSafeEqual } from "crypto";

/**
 * [DOC-FUNC] safeCompare
 * O que faz: Executa a responsabilidade principal da funcao 'safeCompare' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: valueA, valueB; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
 */
function safeCompare(valueA: string, valueB: string) {
  const bufferA = Buffer.from(valueA);
  const bufferB = Buffer.from(valueB);

  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * [DOC-FUNC] validateCollectorBearerToken
 * O que faz: Executa a responsabilidade principal da funcao 'validateCollectorBearerToken' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: authorizationHeader; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
 */
export function validateCollectorBearerToken(authorizationHeader: string | null) {
  const expectedToken = process.env.COLLECTOR_API_TOKEN?.trim();

  if (!expectedToken) {
    return {
      valid: false as const,
      error: "COLLECTOR_API_TOKEN não configurado no servidor."
    };
  }

  if (!authorizationHeader?.startsWith("Bearer ")) {
    return {
      valid: false as const,
      error: "Header Authorization inválido. Use Bearer <token>."
    };
  }

  const receivedToken = authorizationHeader.replace("Bearer ", "").trim();

  if (!safeCompare(receivedToken, expectedToken)) {
    return { valid: false as const, error: "Token do coletor inválido." };
  }

  return { valid: true as const };
}

