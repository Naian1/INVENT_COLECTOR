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
 * O que faz: Normaliza entradas na funcao 'normalizeWhitespace', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: value; com validacao de formato e fallback quando necessario.
 * Como executa: Padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
 */
function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * [DOC-FUNC] normalizeIpForLabel
 * O que faz: Normaliza entradas na funcao 'normalizeIpForLabel', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: value; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
 */
function normalizeIpForLabel(value: string | null) {
  if (!value) return null;
  return value.replace(/\/32$/, "");
}

/**
 * [DOC-FUNC] sanitizeOptionalText
 * O que faz: Normaliza entradas na funcao 'sanitizeOptionalText', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: value; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
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
 * O que faz: Normaliza entradas na funcao 'normalizeAssetTagForLabel', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: assetTag; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
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

