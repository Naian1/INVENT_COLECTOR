/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\visaoGeralImpressorasService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ResultadoServico } from "@/services/impressorasService";
import type { ImpressoraVisaoGeral, SuprimentoResumo } from "@/types/impressora";

type ImpressoraRow = {
  id: string;
  patrimonio: string;
  ip: string;
  setor: string;
  localizacao: string | null;
  modelo: string;
  fabricante: string | null;
  numero_serie: string | null;
  hostname: string | null;
  ativo: boolean;
  ultima_coleta_em: string | null;
};

type StatusRow = {
  impressora_id: string;
  status: string;
  coletado_em: string;
};

type LeituraRow = {
  impressora_id: string;
  contador_total_paginas: number;
  coletado_em: string;
};

type SuprimentoRow = {
  impressora_id: string;
  coletado_em: string;
  chave_suprimento: string;
  nome_suprimento: string;
  nivel_percentual: number | null;
  status_suprimento: string;
};

type CategoriaImpressoraRow = {
  id: string;
  nome: string;
};

type LinhaInventarioRow = {
  id: string;
  categoria_id: string;
  setor: string | null;
  localizacao: string | null;
  ativo: boolean;
};

type CampoCategoriaRow = {
  id: string;
  categoria_id: string;
  tipo_semantico: string;
  ativo: boolean;
};

type LinhaValorRow = {
  linha_id: string;
  campo_id: string;
  valor_texto: string | null;
  valor_numero: number | null;
  valor_booleano: boolean | null;
  valor_data: string | null;
  valor_ip: string | null;
  valor_json: unknown;
};

const LIMITE_MAXIMO_ROWS_QUERY = 1000;
const STATUS_HISTORY_WINDOW = 4;
const STATUS_OFFLINE_CONFIRM_MINUTES = 18;
const STATUS_OFFLINE_HARD_MINUTES = 120;
const STATUS_RECENT_ONLINE_GRACE_MINUTES = 75;
const STATUS_STALE_WARNING_MINUTES = 45;
const STATUS_STALE_OFFLINE_MINUTES = 180;

/**
 * [DOC-FUNC] normalizarIp
 * O que faz: A funcao 'normalizarIp' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizarIp(value: string) {
  return value.replace(/\/32$/, "");
}

/**
 * [DOC-FUNC] toFiniteNumber
 * O que faz: A funcao 'toFiniteNumber' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * [DOC-FUNC] limparTexto
 * O que faz: A funcao 'limparTexto' remove ou inativa registros conforme as regras do sistema. O foco e preservar integridade e rastreabilidade durante a operacao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function limparTexto(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
  return v.length ? v : null;
}

/**
 * [DOC-FUNC] extrairValorTexto
 * O que faz: A funcao 'extrairValorTexto' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: row. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function extrairValorTexto(row: LinhaValorRow) {
  if (row.valor_texto !== null && row.valor_texto !== undefined) return limparTexto(row.valor_texto);
  if (row.valor_numero !== null && row.valor_numero !== undefined) return limparTexto(String(row.valor_numero));
  if (row.valor_booleano !== null && row.valor_booleano !== undefined) return row.valor_booleano ? "true" : "false";
  if (row.valor_data !== null && row.valor_data !== undefined) return limparTexto(row.valor_data);
  if (row.valor_ip !== null && row.valor_ip !== undefined) return limparTexto(normalizarIp(String(row.valor_ip)));
  if (row.valor_json !== null && row.valor_json !== undefined) return limparTexto(JSON.stringify(row.valor_json));
  return null;
}

/**
 * [DOC-FUNC] pickSemantico
 * O que faz: A funcao 'pickSemantico' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function pickSemantico(
  bag: Map<string, string>,
  semanticos: string[]
) {
  for (const sem of semanticos) {
    const value = limparTexto(bag.get(sem) ?? null);
    if (value) return value;
  }
  return null;
}

/**
 * [DOC-FUNC] normalizarTextoComparacao
 * O que faz: A funcao 'normalizarTextoComparacao' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizarTextoComparacao(value: string | null | undefined) {
  const txt = limparTexto(value);
  return txt ? txt.toLowerCase() : null;
}

/**
 * [DOC-FUNC] clamp
 * O que faz: A funcao 'clamp' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: value, min, max. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * [DOC-FUNC] normalizarStatusOperacional
 * O que faz: A funcao 'normalizarStatusOperacional' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizarStatusOperacional(value: unknown): string {
  const status = String(value ?? "").trim().toLowerCase();
  if (!status) return "unknown";
  if (["ok", "online", "ativo", "up"].includes(status)) return "online";
  if (["offline", "down", "inativo"].includes(status)) return "offline";
  if (["erro", "error", "critical", "critico"].includes(status)) return "error";
  if (["warning", "warn", "alerta"].includes(status)) return "warning";
  return "unknown";
}

/**
 * [DOC-FUNC] parseDateMs
 * O que faz: A funcao 'parseDateMs' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function parseDateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

/**
 * [DOC-FUNC] minutesSince
 * O que faz: A funcao 'minutesSince' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function minutesSince(value: string | null | undefined): number | null {
  const ts = parseDateMs(value);
  if (ts === null) return null;
  const diff = Date.now() - ts;
  if (!Number.isFinite(diff)) return null;
  return diff / 60000;
}

/**
 * [DOC-FUNC] isOfflineLikeStatus
 * O que faz: A funcao 'isOfflineLikeStatus' verifica condicoes de validade do fluxo. Ela retorna um sinal objetivo (ou erro) para decidir se a execucao pode continuar com seguranca.
 * Entradas: Recebe os parametros: status. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna verdadeiro/falso para orientar o proximo passo do fluxo sem ambiguidade, facilitando leitura e depuracao.
 */
function isOfflineLikeStatus(status: string): boolean {
  return ["offline", "error"].includes(status);
}

/**
 * [DOC-FUNC] isOnlineLikeStatus
 * O que faz: A funcao 'isOnlineLikeStatus' verifica condicoes de validade do fluxo. Ela retorna um sinal objetivo (ou erro) para decidir se a execucao pode continuar com seguranca.
 * Entradas: Recebe os parametros: status. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) percorre colecoes quando necessario para consolidar ou transformar resultados; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna verdadeiro/falso para orientar o proximo passo do fluxo sem ambiguidade, facilitando leitura e depuracao.
 */
function isOnlineLikeStatus(status: string): boolean {
  return ["online", "warning"].includes(status);
}

function resolverStatusOperacionalConfiavel(
  rows: Array<{ status: string; coletado_em: string | null }>,
  fallbackStatus?: string | null,
  fallbackTimestamp?: string | null
): string {
  const history = rows
    .map((row) => ({
      status: normalizarStatusOperacional(row.status),
      coletado_em: limparTexto(row.coletado_em),
    }))
    .filter((row) => Boolean(row.status));
  const fallback = normalizarStatusOperacional(fallbackStatus ?? "");

  if (!history.length) {
    const fallbackAgeMin = minutesSince(fallbackTimestamp ?? null);
    if (fallbackAgeMin !== null) {
      if (fallbackAgeMin >= STATUS_STALE_OFFLINE_MINUTES) return "offline";
      if (fallbackAgeMin >= STATUS_STALE_WARNING_MINUTES) return "warning";
    }
    return fallback || "unknown";
  }

  const latest = history[0];
  const latestAgeMin = minutesSince(latest.coletado_em ?? fallbackTimestamp ?? null);
  const recentWindow = history.slice(0, STATUS_HISTORY_WINDOW);

  if (latest.status === "online") {
    if (latestAgeMin !== null) {
      if (latestAgeMin >= STATUS_STALE_OFFLINE_MINUTES) return "offline";
      if (latestAgeMin > STATUS_OFFLINE_HARD_MINUTES) return "warning";
    }
    return "online";
  }

  if (latest.status === "warning") return "warning";
  if (latest.status === "unknown") {
    if (latestAgeMin !== null) {
      if (latestAgeMin >= STATUS_STALE_OFFLINE_MINUTES) return "offline";
      if (latestAgeMin >= STATUS_STALE_WARNING_MINUTES) return "warning";
    }
    return fallback || "unknown";
  }

  if (latest.status === "error") {
    if (latestAgeMin !== null && latestAgeMin >= STATUS_OFFLINE_HARD_MINUTES) {
      return "offline";
    }
    return "warning";
  }

  if (latest.status === "offline") {
    let consecutiveOffline = 0;
    for (const item of recentWindow) {
      if (isOfflineLikeStatus(item.status)) {
        consecutiveOffline += 1;
        continue;
      }
      break;
    }

    const hasRecentOnline = recentWindow.some((item) => isOnlineLikeStatus(item.status));
    if (latestAgeMin !== null && latestAgeMin < STATUS_OFFLINE_CONFIRM_MINUTES) {
      return "warning";
    }
    if (
      hasRecentOnline &&
      latestAgeMin !== null &&
      latestAgeMin <= STATUS_RECENT_ONLINE_GRACE_MINUTES
    ) {
      return "warning";
    }
    if (consecutiveOffline >= 2) return "offline";
    if (latestAgeMin !== null && latestAgeMin >= STATUS_OFFLINE_HARD_MINUTES) return "offline";
    return "warning";
  }

  return fallback || latest.status || "unknown";
}

/**
 * [DOC-FUNC] carregarPendentesInventario
 * O que faz: A funcao 'carregarPendentesInventario' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) percorre colecoes quando necessario para consolidar ou transformar resultados; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
async function carregarPendentesInventario(
  operacionais: ImpressoraVisaoGeral[]
): Promise<ResultadoServico<ImpressoraVisaoGeral[]>> {
  const supabase = getSupabaseServerClient();

  const patrimonioOps = new Set<string>();
  const ipOps = new Set<string>();
  for (const row of operacionais) {
    const pat = normalizarTextoComparacao(row.patrimonio);
    if (pat) patrimonioOps.add(pat);
    const ip = normalizarTextoComparacao(normalizarIp(row.ip));
    if (ip) ipOps.add(ip);
  }

  const { data: categorias, error: categoriasError } = await supabase
    .from("categorias_inventario")
    .select("id,nome")
    .eq("ativo", true)
    .ilike("nome", "%impress%");

  if (categoriasError) {
    return {
      success: false,
      status: 500,
      error: "Falha ao carregar categorias de impressoras do inventario."
    };
  }

  if (!categorias || categorias.length === 0) {
    return { success: true, data: [] };
  }

  const categoriaIds = categorias.map((row) => String(row.id));

  const { data: linhas, error: linhasError } = await supabase
    .from("linhas_inventario")
    .select("id,categoria_id,setor,localizacao,ativo")
    .in("categoria_id", categoriaIds)
    .eq("ativo", true);

  if (linhasError) {
    return {
      success: false,
      status: 500,
      error: "Falha ao carregar linhas de inventario para impressoras."
    };
  }

  if (!linhas || linhas.length === 0) {
    return { success: true, data: [] };
  }

  const linhaIds = linhas.map((row) => String(row.id));

  const { data: campos, error: camposError } = await supabase
    .from("categoria_campos")
    .select("id,categoria_id,tipo_semantico,ativo")
    .in("categoria_id", categoriaIds)
    .eq("ativo", true)
    .in("tipo_semantico", [
      "patrimonio",
      "impressora_patrimonio",
      "ip",
      "impressora_ip",
      "modelo",
      "impressora_modelo",
      "fabricante",
      "numero_serie",
      "hostname",
      "setor",
      "localizacao"
    ]);

  if (camposError) {
    return {
      success: false,
      status: 500,
      error: "Falha ao carregar campos semanticos das categorias de impressora."
    };
  }

  if (!campos || campos.length === 0) {
    return { success: true, data: [] };
  }

  const campoIds = campos.map((row) => String(row.id));
  const campoSemanticoMap = new Map<string, string>();
  for (const campo of campos as CampoCategoriaRow[]) {
    campoSemanticoMap.set(String(campo.id), String(campo.tipo_semantico));
  }

  const { data: valores, error: valoresError } = await supabase
    .from("linha_valores_campos")
    .select("linha_id,campo_id,valor_texto,valor_numero,valor_booleano,valor_data,valor_ip,valor_json")
    .in("linha_id", linhaIds)
    .in("campo_id", campoIds);

  if (valoresError) {
    return {
      success: false,
      status: 500,
      error: "Falha ao carregar valores das linhas de impressoras no inventario."
    };
  }

  const valorSemanticoPorLinha = new Map<string, Map<string, string>>();
  for (const row of (valores ?? []) as LinhaValorRow[]) {
    const linhaId = String(row.linha_id);
    const sem = campoSemanticoMap.get(String(row.campo_id));
    if (!sem) continue;

    const valor = extrairValorTexto(row);
    if (!valor) continue;

    if (!valorSemanticoPorLinha.has(linhaId)) {
      valorSemanticoPorLinha.set(linhaId, new Map<string, string>());
    }
    const bag = valorSemanticoPorLinha.get(linhaId) as Map<string, string>;
    if (!bag.has(sem)) {
      bag.set(sem, valor);
    }
  }

  const categoriasMap = new Map<string, string>();
  for (const cat of categorias as CategoriaImpressoraRow[]) {
    categoriasMap.set(String(cat.id), String(cat.nome));
  }

  const pendentes: ImpressoraVisaoGeral[] = [];
  for (const linha of linhas as LinhaInventarioRow[]) {
    const linhaId = String(linha.id);
    const bag = valorSemanticoPorLinha.get(linhaId) ?? new Map<string, string>();

    const patrimonio = pickSemantico(bag, ["impressora_patrimonio", "patrimonio"]);
    const ip = pickSemantico(bag, ["impressora_ip", "ip"]);
    const modelo = pickSemantico(bag, ["impressora_modelo", "modelo"]);
    const fabricante = pickSemantico(bag, ["fabricante"]);
    const numeroSerie = pickSemantico(bag, ["numero_serie"]);
    const hostname = pickSemantico(bag, ["hostname"]);
    const setor = pickSemantico(bag, ["setor"]) ?? limparTexto(linha.setor) ?? categoriasMap.get(String(linha.categoria_id)) ?? "Inventario";
    const localizacao = pickSemantico(bag, ["localizacao"]) ?? limparTexto(linha.localizacao);

    const patNorm = normalizarTextoComparacao(patrimonio);
    const ipNorm = normalizarTextoComparacao(ip ? normalizarIp(ip) : null);
    if (!patNorm && !ipNorm) continue;

    const jaOperacional = (patNorm && patrimonioOps.has(patNorm)) || (ipNorm && ipOps.has(ipNorm));
    if (jaOperacional) continue;

    pendentes.push({
      id: `pendente:${linhaId}`,
      patrimonio: patrimonio ?? "",
      ip: ip ? normalizarIp(ip) : "",
      setor,
      localizacao: localizacao ?? null,
      modelo: modelo ?? "",
      fabricante: fabricante ?? null,
      numero_serie: numeroSerie ?? null,
      hostname: hostname ?? null,
      ativo: true,
      ultima_coleta_em: null,
      status_atual: "nao_operacional",
      contador_paginas_atual: null,
      menor_nivel_suprimento: null,
      resumo_suprimentos: [],
      operacional: false,
      origem_linha_id: linhaId,
      display_name_legacy: null
    });
  }

  return { success: true, data: pendentes };
}

/**
 * [DOC-FUNC] listarVisaoGeralImpressoras
 * O que faz: A funcao 'listarVisaoGeralImpressoras' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) percorre colecoes quando necessario para consolidar ou transformar resultados; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
export async function listarVisaoGeralImpressoras(options?: {
  incluir_nao_operacionais?: boolean;
}): Promise<ResultadoServico<ImpressoraVisaoGeral[]>> {
  const supabase = getSupabaseServerClient();
  const incluirNaoOperacionais = options?.incluir_nao_operacionais === true;

  const { data: impressoras, error: impressorasError } = await supabase
    .from("impressoras")
    .select("id,patrimonio,ip,setor,localizacao,modelo,fabricante,numero_serie,hostname,ativo,ultima_coleta_em")
    .order("setor", { ascending: true })
    .order("ip", { ascending: true });

  if (impressorasError) {
    return { success: false, status: 500, error: "Erro ao buscar impressoras." };
  }

  const impressorasRows = (impressoras ?? []) as ImpressoraRow[];
  if (impressorasRows.length === 0 && !incluirNaoOperacionais) {
    return { success: true, data: [] };
  }

  const impressoraIds = impressorasRows.map((row) => row.id);
  const limiteStatusInicial = clamp(
    impressoraIds.length * (STATUS_HISTORY_WINDOW + 2),
    220,
    LIMITE_MAXIMO_ROWS_QUERY
  );
  const limiteLeituraInicial = clamp(impressoraIds.length * 2, 160, 700);
  const limiteSuprimentoInicial = clamp(impressoraIds.length * 6, 240, 900);

  const [
    { data: statusRows, error: statusError },
    { data: leituraRows, error: leituraError },
    { data: suprimentoRows, error: suprimentoError }
  ] = await Promise.all([
    impressoraIds.length
      ? supabase
          .from("telemetria_impressoras")
          .select("impressora_id,status,coletado_em")
          .in("impressora_id", impressoraIds)
          .order("coletado_em", { ascending: false })
          .limit(Math.min(limiteStatusInicial, LIMITE_MAXIMO_ROWS_QUERY))
      : Promise.resolve({ data: [], error: null }),
    impressoraIds.length
      ? supabase
          .from("leituras_paginas_impressoras")
          .select("impressora_id,contador_total_paginas,coletado_em")
          .eq("valido", true)
          .in("impressora_id", impressoraIds)
          .order("coletado_em", { ascending: false })
          .limit(Math.min(limiteLeituraInicial, LIMITE_MAXIMO_ROWS_QUERY))
      : Promise.resolve({ data: [], error: null }),
    impressoraIds.length
      ? supabase
          .from("suprimentos_impressoras")
          .select("impressora_id,coletado_em,chave_suprimento,nome_suprimento,nivel_percentual,status_suprimento")
          .eq("valido", true)
          .in("impressora_id", impressoraIds)
          .order("coletado_em", { ascending: false })
          .limit(Math.min(limiteSuprimentoInicial, LIMITE_MAXIMO_ROWS_QUERY))
      : Promise.resolve({ data: [], error: null })
  ]);

  if (statusError || leituraError || suprimentoError) {
    return {
      success: false,
      status: 500,
      error: "Erro ao montar visao geral das impressoras."
    };
  }

  const latestStatusByImpressora = new Map<string, StatusRow>();
  const statusHistoryByImpressora = new Map<string, Array<{ status: string; coletado_em: string | null }>>();
  /**
   * [DOC-FUNC] registrarStatus
   * O que faz: A funcao 'registrarStatus' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
   * Entradas: Recebe os parametros: rows. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  const registrarStatus = (rows: StatusRow[]) => {
    for (const row of rows) {
      if (!latestStatusByImpressora.has(row.impressora_id)) {
        latestStatusByImpressora.set(row.impressora_id, row);
      }

      if (!statusHistoryByImpressora.has(row.impressora_id)) {
        statusHistoryByImpressora.set(row.impressora_id, []);
      }
      const bucket = statusHistoryByImpressora.get(row.impressora_id) as Array<{
        status: string;
        coletado_em: string | null;
      }>;
      if (bucket.length < STATUS_HISTORY_WINDOW + 2) {
        bucket.push({
          status: String(row.status || "unknown"),
          coletado_em: limparTexto(row.coletado_em)
        });
      }
    }
  };
  registrarStatus((statusRows ?? []) as StatusRow[]);

  const latestLeituraByImpressora = new Map<string, LeituraRow>();
  for (const row of (leituraRows ?? []) as LeituraRow[]) {
    if (!latestLeituraByImpressora.has(row.impressora_id)) {
      latestLeituraByImpressora.set(row.impressora_id, row);
    }
  }

  const snapshotSuprimentosByImpressora = new Map<
    string,
    {
      coletado_em: string;
      resumo: SuprimentoResumo[];
      menor_nivel: number | null;
      chaves: Set<string>;
    }
  >();

  /**
   * [DOC-FUNC] registrarSuprimentos
   * O que faz: A funcao 'registrarSuprimentos' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
   * Entradas: Recebe os parametros: rows. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) percorre colecoes quando necessario para consolidar ou transformar resultados; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  const registrarSuprimentos = (rows: SuprimentoRow[]) => {
    for (const row of rows) {
      const atual = snapshotSuprimentosByImpressora.get(row.impressora_id);
      const nivel = toFiniteNumber(row.nivel_percentual);

      if (!atual) {
        snapshotSuprimentosByImpressora.set(row.impressora_id, {
          coletado_em: row.coletado_em,
          resumo: [
            {
              chave_suprimento: row.chave_suprimento,
              nome_suprimento: row.nome_suprimento,
              nivel_percentual: nivel,
              status_suprimento: row.status_suprimento
            }
          ],
          menor_nivel: nivel,
          chaves: new Set([row.chave_suprimento])
        });
        continue;
      }

      if (new Date(row.coletado_em).getTime() > new Date(atual.coletado_em).getTime()) {
        atual.coletado_em = row.coletado_em;
      }

      if (atual.chaves.has(row.chave_suprimento)) {
        continue;
      }
      atual.chaves.add(row.chave_suprimento);

      atual.resumo.push({
        chave_suprimento: row.chave_suprimento,
        nome_suprimento: row.nome_suprimento,
        nivel_percentual: nivel,
        status_suprimento: row.status_suprimento
      });

      if (nivel !== null && (atual.menor_nivel === null || nivel < atual.menor_nivel)) {
        atual.menor_nivel = nivel;
      }
    }
  };

  registrarSuprimentos((suprimentoRows ?? []) as SuprimentoRow[]);

  const idsSemStatus = impressoraIds.filter((id) => !latestStatusByImpressora.has(id));
  const idsSemLeitura = impressoraIds.filter((id) => !latestLeituraByImpressora.has(id));
  const idsSemSuprimentos = impressoraIds.filter((id) => !snapshotSuprimentosByImpressora.has(id));

  if (idsSemStatus.length || idsSemLeitura.length || idsSemSuprimentos.length) {
    const [
      { data: statusFallbackRows, error: statusFallbackError },
      { data: leituraFallbackRows, error: leituraFallbackError },
      { data: suprimentoFallbackRows, error: suprimentoFallbackError }
    ] = await Promise.all([
      idsSemStatus.length
        ? supabase
            .from("telemetria_impressoras")
            .select("impressora_id,status,coletado_em")
            .in("impressora_id", idsSemStatus)
            .order("coletado_em", { ascending: false })
            .limit(Math.min(clamp(idsSemStatus.length * 3, 60, LIMITE_MAXIMO_ROWS_QUERY), LIMITE_MAXIMO_ROWS_QUERY))
        : Promise.resolve({ data: [], error: null }),
      idsSemLeitura.length
        ? supabase
            .from("leituras_paginas_impressoras")
            .select("impressora_id,contador_total_paginas,coletado_em")
            .eq("valido", true)
            .in("impressora_id", idsSemLeitura)
            .order("coletado_em", { ascending: false })
            .limit(Math.min(clamp(idsSemLeitura.length * 3, 60, LIMITE_MAXIMO_ROWS_QUERY), LIMITE_MAXIMO_ROWS_QUERY))
        : Promise.resolve({ data: [], error: null }),
      idsSemSuprimentos.length
        ? supabase
            .from("suprimentos_impressoras")
            .select("impressora_id,coletado_em,chave_suprimento,nome_suprimento,nivel_percentual,status_suprimento")
            .eq("valido", true)
            .in("impressora_id", idsSemSuprimentos)
            .order("coletado_em", { ascending: false })
            .limit(Math.min(clamp(idsSemSuprimentos.length * 10, 120, LIMITE_MAXIMO_ROWS_QUERY), LIMITE_MAXIMO_ROWS_QUERY))
        : Promise.resolve({ data: [], error: null })
    ]);

    if (statusFallbackError || leituraFallbackError || suprimentoFallbackError) {
      return {
        success: false,
        status: 500,
        error: "Erro ao montar visao geral das impressoras."
      };
    }

    registrarStatus((statusFallbackRows ?? []) as StatusRow[]);

    for (const row of (leituraFallbackRows ?? []) as LeituraRow[]) {
      if (!latestLeituraByImpressora.has(row.impressora_id)) {
        latestLeituraByImpressora.set(row.impressora_id, row);
      }
    }

    registrarSuprimentos((suprimentoFallbackRows ?? []) as SuprimentoRow[]);
  }

  const visaoOperacional: ImpressoraVisaoGeral[] = impressorasRows.map((impressora) => {
    const latestStatus = latestStatusByImpressora.get(impressora.id);
    const statusHistory = statusHistoryByImpressora.get(impressora.id) ?? [];
    const latestLeitura = latestLeituraByImpressora.get(impressora.id);
    const latestSuprimentos = snapshotSuprimentosByImpressora.get(impressora.id);
    const ultimaColeta = limparTexto(impressora.ultima_coleta_em) ?? limparTexto(latestStatus?.coletado_em) ?? null;
    const statusAtual = resolverStatusOperacionalConfiavel(
      statusHistory,
      latestStatus?.status ?? "unknown",
      ultimaColeta
    );

    return {
      id: impressora.id,
      patrimonio: impressora.patrimonio,
      ip: normalizarIp(impressora.ip),
      setor: impressora.setor,
      localizacao: impressora.localizacao ?? null,
      modelo: impressora.modelo,
      fabricante: impressora.fabricante ?? null,
      numero_serie: impressora.numero_serie ?? null,
      hostname: impressora.hostname ?? null,
      ativo: impressora.ativo,
      ultima_coleta_em: ultimaColeta,
      status_atual: statusAtual,
      contador_paginas_atual: latestLeitura ? Number(latestLeitura.contador_total_paginas) : null,
      menor_nivel_suprimento: latestSuprimentos?.menor_nivel ?? null,
      resumo_suprimentos: latestSuprimentos?.resumo ?? [],
      operacional: true,
      origem_linha_id: null,
      display_name_legacy: null
    };
  });

  if (!incluirNaoOperacionais) {
    return { success: true, data: visaoOperacional };
  }

  const pendentes = await carregarPendentesInventario(visaoOperacional);
  if (!pendentes.success) {
    return pendentes;
  }

  const merged = [...visaoOperacional, ...pendentes.data].sort((a, b) => {
    if (a.operacional !== b.operacional) return a.operacional ? -1 : 1;
    const setorCmp = String(a.setor ?? "").localeCompare(String(b.setor ?? ""));
    if (setorCmp !== 0) return setorCmp;
    return String(a.ip ?? "").localeCompare(String(b.ip ?? ""));
  });

  return { success: true, data: merged };
}

