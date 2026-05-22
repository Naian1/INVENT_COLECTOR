const numberFormatterPtBr = new Intl.NumberFormat('pt-BR');
const currencyFormatterBrl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
});

/**
 * [DOC-FUNC] formatarNumeroPtBr
 * Objetivo: formatar numeros no padrao brasileiro sem alterar o valor recebido.
 * Como funciona: delega para Intl.NumberFormat usando locale pt-BR.
 */
export function formatarNumeroPtBr(value: number): string {
  return numberFormatterPtBr.format(value);
}

/**
 * [DOC-FUNC] formatarInteiroNaoNegativoPtBr
 * Objetivo: formatar indicadores que nunca devem aparecer negativos ou quebrados.
 * Como funciona: converte valores invalidos para zero, arredonda e limita o minimo em zero.
 */
export function formatarInteiroNaoNegativoPtBr(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return numberFormatterPtBr.format(Math.max(0, Math.round(n)));
}

/**
 * [DOC-FUNC] formatarMoedaBrl
 * Objetivo: formatar valores monetarios em reais.
 * Como funciona: valores invalidos viram zero para evitar "NaN" na interface.
 */
export function formatarMoedaBrl(value: number): string {
  if (!Number.isFinite(value)) return currencyFormatterBrl.format(0);
  return currencyFormatterBrl.format(value);
}

/**
 * [DOC-FUNC] formatarMoedaBrlNaoNegativa
 * Objetivo: formatar valores monetarios de indicadores, impedindo exibicao negativa acidental.
 * Como funciona: valores invalidos viram zero e valores negativos sao limitados a zero.
 */
export function formatarMoedaBrlNaoNegativa(value: number): string {
  if (!Number.isFinite(value)) return currencyFormatterBrl.format(0);
  return currencyFormatterBrl.format(Math.max(0, value));
}

