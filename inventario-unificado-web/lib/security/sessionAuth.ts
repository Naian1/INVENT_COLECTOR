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
 * [DOC-FUNC] getSessionSecret
 * O que faz: A funcao 'getSessionSecret' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'getSessionCookieName' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

/**
 * [DOC-FUNC] getSessionTtlSeconds
 * O que faz: A funcao 'getSessionTtlSeconds' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) persiste alteracoes somente quando as regras de negocio permitem.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
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
 * O que faz: A funcao 'readSessionToken' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: token. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) persiste alteracoes somente quando as regras de negocio permitem; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
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
 * O que faz: A funcao 'sha256Hex' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) persiste alteracoes somente quando as regras de negocio permitem.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * [DOC-FUNC] verifyPassword
 * O que faz: A funcao 'verifyPassword' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: inputPassword, storedHash. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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

