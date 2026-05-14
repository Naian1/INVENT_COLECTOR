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
 * O que faz: A funcao 'normalizeWhitespace' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * [DOC-FUNC] normalizeIpForLabel
 * O que faz: A funcao 'normalizeIpForLabel' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizeIpForLabel(value: string | null) {
  if (!value) return null;
  return value.replace(/\/32$/, "");
}

/**
 * [DOC-FUNC] sanitizeOptionalText
 * O que faz: A funcao 'sanitizeOptionalText' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'normalizeAssetTagForLabel' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: assetTag. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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

