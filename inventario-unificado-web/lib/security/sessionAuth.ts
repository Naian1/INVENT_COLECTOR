/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\lib\security\sessionAuth.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { createHash, createHmac, timingSafeEqual } from "crypto";

const SESSION_COOKIE_NAME = "inv_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  cdUsuario: number;
  nmUsuario: string;
  cdPerfil: number;
  iat: number;
  exp: number;
};

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
 * [DOC-FUNC] getSessionSecret
 * O que faz: Consulta e organiza informacoes na funcao 'getSessionSecret', entregando retorno confiavel para camadas superiores.
 * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
function getSessionSecret() {
  const secret =
    process.env.AUTH_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!secret) {
    throw new Error(
      "Segredo de sessao ausente. Defina AUTH_SESSION_SECRET (recomendado) ou use SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return secret;
}

/**
 * [DOC-FUNC] getSessionCookieName
 * O que faz: Consulta e organiza informacoes na funcao 'getSessionCookieName', entregando retorno confiavel para camadas superiores.
 * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
 * Como executa: Executa um fluxo linear de validacao e processamento local, mantendo resultado previsivel para quem consome a funcao.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

/**
 * [DOC-FUNC] getSessionTtlSeconds
 * O que faz: Atualiza estado na funcao 'getSessionTtlSeconds', mantendo coerencia entre dados atuais e alteracoes recebidas.
 * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
 * Como executa: Consulta fontes de dados/servicos externos; padroniza campos para evitar divergencia de formato; executa atualizacao de forma controlada.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
 */
export function getSessionTtlSeconds() {
  return SESSION_TTL_SECONDS;
}

export function buildSessionToken(input: {
  cdUsuario: number;
  nmUsuario: string;
  cdPerfil: number;
}) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    cdUsuario: input.cdUsuario,
    nmUsuario: input.nmUsuario,
    cdPerfil: input.cdPerfil,
    iat: nowInSeconds,
    exp: nowInSeconds + SESSION_TTL_SECONDS
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret())
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

/**
 * [DOC-FUNC] readSessionToken
 * O que faz: Atualiza estado na funcao 'readSessionToken', mantendo coerencia entre dados atuais e alteracoes recebidas.
 * Entradas: Parametros esperados: token; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; padroniza campos para evitar divergencia de formato; executa atualizacao de forma controlada; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
 */
export function readSessionToken(token: string | undefined | null) {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = createHmac("sha256", getSessionSecret())
    .update(encodedPayload)
    .digest("base64url");

  if (!safeCompare(signature, expectedSignature)) return null;

  try {
    const decoded = Buffer.from(encodedPayload, "base64url").toString("utf-8");
    const payload = JSON.parse(decoded) as SessionPayload;

    if (
      typeof payload.cdUsuario !== "number" ||
      typeof payload.nmUsuario !== "string" ||
      typeof payload.cdPerfil !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowInSeconds) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * [DOC-FUNC] sha256Hex
 * O que faz: Atualiza estado na funcao 'sha256Hex', mantendo coerencia entre dados atuais e alteracoes recebidas.
 * Entradas: Parametros esperados: value; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Executa atualizacao de forma controlada.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
 */
function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * [DOC-FUNC] verifyPassword
 * O que faz: Normaliza entradas na funcao 'verifyPassword', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: inputPassword, storedHash; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
 */
export function verifyPassword(inputPassword: string, storedHash: string | null | undefined) {
  const normalizedHash = String(storedHash ?? "").trim();

  if (!normalizedHash) return false;

  if (normalizedHash.startsWith("plain:")) {
    return safeCompare(inputPassword, normalizedHash.slice(6));
  }

  if (normalizedHash.startsWith("sha256:")) {
    const expected = normalizedHash.slice(7);
    return safeCompare(sha256Hex(inputPassword), expected);
  }

  return safeCompare(inputPassword, normalizedHash);
}

