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
 * Objetivo: Executa a rotina de 's af ec om pa re'.
 */
function safeCompare(valueA: string, valueB: string) {
  const bufferA = Buffer.from(valueA);
  const bufferB = Buffer.from(valueB);

  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * [DOC-FUNC] getSessionSecret
 * Objetivo: Executa a rotina de 'g et se ss io ns ec re t'.
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
 * Objetivo: Executa a rotina de 'g et se ss io nc oo ki en am e'.
 */
export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

/**
 * [DOC-FUNC] getSessionTtlSeconds
 * Objetivo: Executa a rotina de 'g et se ss io nt tl se co nd s'.
 */
export function getSessionTtlSeconds() {
  return SESSION_TTL_SECONDS;
}

/**
 * [DOC-FUNC] buildSessionToken
 * Objetivo: Executa a rotina de 'b ui ld se ss io nt ok en'.
 */
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
 * Objetivo: Executa a rotina de 'r ea ds es si on to ke n'.
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
 * Objetivo: Executa a rotina de 's ha256 he x'.
 */
function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * [DOC-FUNC] verifyPassword
 * Objetivo: Executa a rotina de 'v er if yp as sw or d'.
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

