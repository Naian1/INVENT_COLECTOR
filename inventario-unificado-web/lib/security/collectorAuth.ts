/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\lib\security\collectorAuth.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { timingSafeEqual } from "crypto";

/**
 * [DOC-FUNC] safeCompare
 * O que faz: Consulta e organiza informacoes na funcao 'safeCompare', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: valueA, valueB; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
function safeCompare(valueA: string, valueB: string) {
  const bufferA = Buffer.from(valueA);
  const bufferB = Buffer.from(valueB);

  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * [DOC-FUNC] validateCollectorBearerToken
 * O que faz: Normaliza entradas na funcao 'validateCollectorBearerToken', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: authorizationHeader; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
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

