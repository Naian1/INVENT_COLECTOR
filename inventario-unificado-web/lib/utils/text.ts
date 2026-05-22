const VALORES_DESCONHECIDOS_PADRAO = new Set([
  '',
  'desconhecido',
  'unknown',
  'n/a',
  'na',
  'none',
  'null',
  '-',
]);

/**
 * [DOC-FUNC] normalizarTextoBusca
 * Objetivo: transforma qualquer valor em texto comparavel para filtros e buscas simples.
 * Como funciona: converte nulo/undefined em string vazia, remove acentos e coloca tudo em minusculo.
 * Observacao: nao aplica trim por padrao para preservar o comportamento das funcoes antigas das telas.
 */
export function normalizarTextoBusca(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * [DOC-FUNC] limparTextoOuNulo
 * Objetivo: limpar campos opcionais vindos de formulario, planilha ou banco.
 * Como funciona: transforma o valor em string, remove espacos das pontas e retorna null quando nao sobra conteudo.
 */
export function limparTextoOuNulo(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

/**
 * [DOC-FUNC] limparTextoOuIndefinido
 * Objetivo: mesma limpeza de limparTextoOuNulo, mas retornando undefined para contratos que ja usam undefined.
 * Como funciona: reaproveita a limpeza central e converte null para undefined.
 */
export function limparTextoOuIndefinido(value: unknown): string | undefined {
  return limparTextoOuNulo(value) ?? undefined;
}

/**
 * [DOC-FUNC] limparTextoDesconhecidoOuNulo
 * Objetivo: limpar texto e descartar marcadores sem valor real, como "unknown", "n/a" e "-".
 * Como funciona: primeiro limpa o texto; depois compara em minusculo contra uma lista padrao de valores vazios.
 */
export function limparTextoDesconhecidoOuNulo(value: unknown): string | null {
  const text = limparTextoOuNulo(value);
  if (!text) return null;
  return VALORES_DESCONHECIDOS_PADRAO.has(text.toLowerCase()) ? null : text;
}

/**
 * [DOC-FUNC] limparTextoDesconhecidoOuIndefinido
 * Objetivo: versao com undefined para services que montam payloads opcionais.
 * Como funciona: reaproveita a limpeza com descarte de valores desconhecidos e converte null para undefined.
 */
export function limparTextoDesconhecidoOuIndefinido(value: unknown): string | undefined {
  return limparTextoDesconhecidoOuNulo(value) ?? undefined;
}

/**
 * [DOC-FUNC] limparTextoInventarioOuIndefinido
 * Objetivo: limpar textos do inventario que tambem usam "sem setor" como marcador de ausencia.
 * Como funciona: reaproveita a lista padrao de valores desconhecidos e acrescenta o marcador especifico do inventario.
 */
export function limparTextoInventarioOuIndefinido(value: unknown): string | undefined {
  const text = limparTextoDesconhecidoOuNulo(value);
  if (!text) return undefined;
  return text.toLowerCase() === 'sem setor' ? undefined : text;
}
