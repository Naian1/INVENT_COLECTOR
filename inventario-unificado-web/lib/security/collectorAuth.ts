/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\lib\security\collectorAuth.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { timingSafeEqual } from "crypto";

/**
 * [DOC-FUNC] safeCompare
 * O que faz: A funcao 'safeCompare' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: valueA, valueB. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function safeCompare(valueA: string, valueB: string) {
  const bufferA = Buffer.from(valueA);
  const bufferB = Buffer.from(valueB);

  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * [DOC-FUNC] validateCollectorBearerToken
 * O que faz: A funcao 'validateCollectorBearerToken' verifica condicoes de validade do fluxo. Ela retorna um sinal objetivo (ou erro) para decidir se a execucao pode continuar com seguranca.
 * Entradas: Recebe os parametros: authorizationHeader. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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

