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
 * O que faz: Executa a rotina principal de 'safe compare' no contexto deste modulo.
 * Entradas: Parametros esperados: valueA, valueB.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
 */
function safeCompare(valueA: string, valueB: string) {
  const bufferA = Buffer.from(valueA);
  const bufferB = Buffer.from(valueB);

  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * [DOC-FUNC] getSessionSecret
 * O que faz: Consulta dados de 'get session secret' na fonte principal (API, banco ou cache).
 * Entradas: Sem parametros obrigatorios.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
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
 * O que faz: Consulta dados de 'get session cookie name' na fonte principal (API, banco ou cache).
 * Entradas: Sem parametros obrigatorios.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
 */
export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

/**
 * [DOC-FUNC] getSessionTtlSeconds
 * O que faz: Consulta dados de 'get session ttl seconds' na fonte principal (API, banco ou cache).
 * Entradas: Sem parametros obrigatorios.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
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
 * O que faz: Executa a rotina principal de 'read session token' no contexto deste modulo.
 * Entradas: Parametros esperados: token.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
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
 * O que faz: Executa a rotina principal de 'sha256 hex' no contexto deste modulo.
 * Entradas: Parametros esperados: value.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
 */
function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * [DOC-FUNC] verifyPassword
 * O que faz: Executa a rotina principal de 'verify password' no contexto deste modulo.
 * Entradas: Parametros esperados: inputPassword, storedHash.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
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

