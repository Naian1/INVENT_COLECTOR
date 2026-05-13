/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\lib\printers\naming.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
const UNKNOWN_VALUES = new Set([
  "",
  "desconhecido",
  "unknown",
  "n/a",
  "na",
  "none",
  "null",
  "-"
]);

/**
 * [DOC-FUNC] normalizeWhitespace
 * O que faz: Padroniza dados de 'normalize whitespace' para formato previsivel no restante do fluxo.
 * Entradas: Parametros esperados: value.
 * Como executa: Converte tipos, remove ruido e aplica fallback para valores invalidos.
 * Retorno/Efeitos: Retorna valor saneado pronto para comparacao, armazenamento ou exibicao.
 */
function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * [DOC-FUNC] normalizeIpForLabel
 * O que faz: Padroniza dados de 'normalize ip for label' para formato previsivel no restante do fluxo.
 * Entradas: Parametros esperados: value.
 * Como executa: Converte tipos, remove ruido e aplica fallback para valores invalidos.
 * Retorno/Efeitos: Retorna valor saneado pronto para comparacao, armazenamento ou exibicao.
 */
function normalizeIpForLabel(value: string | null) {
  if (!value) return null;
  return value.replace(/\/32$/, "");
}

/**
 * [DOC-FUNC] sanitizeOptionalText
 * O que faz: Executa a rotina principal de 'sanitize optional text' no contexto deste modulo.
 * Entradas: Parametros esperados: value.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
 */
export function sanitizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = normalizeWhitespace(value);
  if (!cleaned) return null;
  if (UNKNOWN_VALUES.has(cleaned.toLowerCase())) return null;
  return cleaned;
}

/**
 * [DOC-FUNC] normalizeAssetTagForLabel
 * O que faz: Padroniza dados de 'normalize asset tag for label' para formato previsivel no restante do fluxo.
 * Entradas: Parametros esperados: assetTag.
 * Como executa: Converte tipos, remove ruido e aplica fallback para valores invalidos.
 * Retorno/Efeitos: Retorna valor saneado pronto para comparacao, armazenamento ou exibicao.
 */
function normalizeAssetTagForLabel(assetTag: string) {
  const cleaned = normalizeWhitespace(assetTag);
  if (/^pat\b/i.test(cleaned)) return cleaned;
  return `PAT ${cleaned}`;
}

export function buildPrinterDisplayName(input: {
  hostname?: string | null;
  asset_tag?: string | null;
  sector?: string | null;
  model?: string | null;
  ip_address?: string | null;
}) {
  const hostname = sanitizeOptionalText(input.hostname);
  const assetTag = sanitizeOptionalText(input.asset_tag);
  const sector = sanitizeOptionalText(input.sector);
  const model = sanitizeOptionalText(input.model);
  const ipAddress = normalizeIpForLabel(sanitizeOptionalText(input.ip_address));

  if (assetTag && sector) return `${normalizeAssetTagForLabel(assetTag)} - ${sector}`;
  if (model && sector) return `${model} - ${sector}`;
  if (hostname) return hostname;
  if (assetTag) return normalizeAssetTagForLabel(assetTag);
  if (model) return model;
  if (ipAddress) return ipAddress;
  return null;
}

