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
 * O que faz: Normaliza valores na funcao 'normalizeWhitespace', reduzindo variacoes de formato antes do processamento principal.
 * Entradas: Recebe dados possivelmente incompletos ou heterogeneos (value) e trata nulos, strings vazias e tipos mistos.
 * Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
 * Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
 */
function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * [DOC-FUNC] normalizeIpForLabel
 * O que faz: Normaliza valores na funcao 'normalizeIpForLabel', reduzindo variacoes de formato antes do processamento principal.
 * Entradas: Recebe dados possivelmente incompletos ou heterogeneos (value) e trata nulos, strings vazias e tipos mistos.
 * Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
 * Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
 */
function normalizeIpForLabel(value: string | null) {
  if (!value) return null;
  return value.replace(/\/32$/, "");
}

/**
 * [DOC-FUNC] sanitizeOptionalText
 * O que faz: Normaliza valores na funcao 'sanitizeOptionalText', reduzindo variacoes de formato antes do processamento principal.
 * Entradas: Recebe dados possivelmente incompletos ou heterogeneos (value) e trata nulos, strings vazias e tipos mistos.
 * Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
 * Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
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
 * O que faz: Normaliza valores na funcao 'normalizeAssetTagForLabel', reduzindo variacoes de formato antes do processamento principal.
 * Entradas: Recebe dados possivelmente incompletos ou heterogeneos (assetTag) e trata nulos, strings vazias e tipos mistos.
 * Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
 * Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
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

