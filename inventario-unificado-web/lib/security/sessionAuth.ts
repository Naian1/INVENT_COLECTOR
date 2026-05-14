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
 * [DOC-FUNC] getSessionSecret
 * O que faz: Consulta e organiza informacoes na funcao 'getSessionSecret' para retorno confiavel.
 * Entradas: Parametros esperados: sem parametros obrigatorios; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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
 * O que faz: Consulta e organiza informacoes na funcao 'getSessionCookieName' para retorno confiavel.
 * Entradas: Parametros esperados: sem parametros obrigatorios; com validacao de formato e fallback quando necessario.
 * Como executa: Executa processamento local em sequencia previsivel.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
 */
export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

/**
 * [DOC-FUNC] getSessionTtlSeconds
 * O que faz: Consulta e organiza informacoes na funcao 'getSessionTtlSeconds' para retorno confiavel.
 * Entradas: Parametros esperados: sem parametros obrigatorios; com validacao de formato e fallback quando necessario.
 * Como executa: Consulta dados em fonte interna/externa; aplica atualizacoes de estado; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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
 * O que faz: Consulta e organiza informacoes na funcao 'readSessionToken' para retorno confiavel.
 * Entradas: Parametros esperados: token; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; consulta dados em fonte interna/externa; aplica atualizacoes de estado; padroniza formato e fallback de campos; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
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
 * O que faz: Executa a responsabilidade principal da funcao 'sha256Hex' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: value; com validacao de formato e fallback quando necessario.
 * Como executa: Aplica atualizacoes de estado.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
 */
function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * [DOC-FUNC] verifyPassword
 * O que faz: Executa a responsabilidade principal da funcao 'verifyPassword' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: inputPassword, storedHash; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
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

