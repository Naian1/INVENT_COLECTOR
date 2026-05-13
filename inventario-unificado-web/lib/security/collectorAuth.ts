/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\lib\security\collectorAuth.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { timingSafeEqual } from "crypto";

/**
 * [DOC-FUNC] safeCompare
 * O que faz: Orquestra a etapa 'safeCompare' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
 * Entradas: Trabalha com os parametros declarados (valueA, valueB) e com contexto local carregado durante a execucao.
 * Como executa: Encadeia avaliacoes condicionais, garantindo continuidade do processamento mesmo com entradas variaveis.
 * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
 */
function safeCompare(valueA: string, valueB: string) {
  const bufferA = Buffer.from(valueA);
  const bufferB = Buffer.from(valueB);

  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * [DOC-FUNC] validateCollectorBearerToken
 * O que faz: Orquestra a etapa 'validateCollectorBearerToken' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
 * Entradas: Trabalha com os parametros declarados (authorizationHeader) e com contexto local carregado durante a execucao.
 * Como executa: Encadeia avaliacoes condicionais, garantindo continuidade do processamento mesmo com entradas variaveis.
 * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
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

