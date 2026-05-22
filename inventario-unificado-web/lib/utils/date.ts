type FormatDateTimeOptions = {
  timeZone?: string;
  assumeUtcWhenMissing?: boolean;
};

/**
 * [DOC-FUNC] parseDateTime
 * Objetivo: converter texto de data/hora em Date de forma tolerante para dados vindos do banco e da telemetria.
 * Como funciona: aceita ISO com timezone; quando solicitado, trata strings sem timezone como UTC para preservar leituras da coleta.
 */
export function parseDateTime(value: string | null | undefined, options: FormatDateTimeOptions = {}): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(raw);
  const normalized = options.assumeUtcWhenMissing && !hasTimezone ? `${raw}Z` : raw;
  const data = new Date(normalized);

  return Number.isNaN(data.getTime()) ? null : data;
}

/**
 * [DOC-FUNC] formatarDataHoraPtBr
 * Objetivo: exibir data/hora no padrao brasileiro usado nas telas administrativas.
 * Como funciona: valida a data antes de formatar e retorna "-" quando o valor esta vazio ou invalido.
 */
export function formatarDataHoraPtBr(
  value: string | null | undefined,
  options: FormatDateTimeOptions = {},
): string {
  const data = parseDateTime(value, options);
  if (!data) return '-';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  }).format(data);
}

/**
 * [DOC-FUNC] formatarDataHoraUtcPtBr
 * Objetivo: formatar leituras de telemetria que podem chegar sem timezone explicito.
 * Como funciona: quando a string nao informa timezone, assume UTC, preservando a regra antiga da tela de impressoras.
 */
export function formatarDataHoraUtcPtBr(value: string | null | undefined): string {
  return formatarDataHoraPtBr(value, { assumeUtcWhenMissing: true });
}
