/**
 * [DOC-FUNC] validarCompetenciaMesAno
 * Objetivo: validar competencia no formato MM/AAAA.
 * Como funciona: aceita meses de 01 a 12 e exige ano com quatro digitos.
 */
export function validarCompetenciaMesAno(valor: string): boolean {
  return /^(0[1-9]|1[0-2])\/[0-9]{4}$/.test(valor.trim());
}

