/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\dashboardAnaliticoService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listarVisaoGeralImpressoras } from "@/services/visaoGeralImpressorasService";

type AgrupamentoPeriodo = "dia" | "mes";

type LeituraRow = {
  impressora_id: string;
  coletado_em: string;
  contador_total_paginas: number;
};

type ImpressoraVisao = {
  id: string;
  patrimonio: string;
  ip: string;
  modelo: string;
  setor: string;
  localizacao: string | null;
  ultima_coleta_em: string | null;
  contador_paginas_atual: number | null;
  status_atual: string;
  menor_nivel_suprimento: number | null;
  resumo_suprimentos: Array<{
    nome_suprimento: string;
    nivel_percentual: number | null;
    status_suprimento: string;
  }>;
  operacional: boolean;
};

type FaixaHistorica = {
  primeira_coleta: string | null;
  ultima_coleta: string | null;
};

const HISTORICO_PAGINAS_DIAS_MAX = 92;

/**
 * [DOC-FUNC] clamp
 * O que faz: Executa a responsabilidade central da funcao 'clamp', conectando validacao, processamento e retorno de forma didatica.
 * Entradas: Parametros esperados: value, min, max; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Executa um fluxo linear de validacao e processamento local, mantendo resultado previsivel para quem consome a funcao.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora com contrato claro de sucesso e falha.
 */
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * [DOC-FUNC] normalizarFiltro
 * O que faz: Normaliza entradas na funcao 'normalizarFiltro', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: value; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
 */
function normalizarFiltro(value: string) {
  return value.trim().toLowerCase();
}

/**
 * [DOC-FUNC] nomeSetor
 * O que faz: Normaliza entradas na funcao 'nomeSetor', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: value; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
 */
function nomeSetor(value: string | null | undefined) {
  const txt = String(value ?? "").trim();
  return txt || "Sem setor";
}

/**
 * [DOC-FUNC] nomeLocalizacao
 * O que faz: Normaliza entradas na funcao 'nomeLocalizacao', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: value; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
 */
function nomeLocalizacao(value: string | null | undefined) {
  const txt = String(value ?? "").trim();
  return txt || "Sem localizacao";
}

/**
 * [DOC-FUNC] inicioPeriodoIso
 * O que faz: Normaliza entradas na funcao 'inicioPeriodoIso', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: dias; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
 */
function inicioPeriodoIso(dias: number) {
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - dias + 1);
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}

/**
 * [DOC-FUNC] chaveBucket
 * O que faz: Normaliza entradas na funcao 'chaveBucket', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: dataIso, agrupamento; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
 */
function chaveBucket(dataIso: string, agrupamento: AgrupamentoPeriodo) {
  const dt = new Date(dataIso);
  const ano = dt.getUTCFullYear();
  const mes = String(dt.getUTCMonth() + 1).padStart(2, "0");
  if (agrupamento === "mes") return `${ano}-${mes}`;
  const dia = String(dt.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * [DOC-FUNC] buscarLeiturasHistoricas
 * O que faz: Consulta e organiza informacoes na funcao 'buscarLeiturasHistoricas', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: impressoraIds, deIso, ateIso; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; itera listas/objetos para consolidar calculos e mapeamentos.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
async function buscarLeiturasHistoricas(
  impressoraIds: string[],
  deIso: string,
  ateIso: string
) {
  if (!impressoraIds.length) return { rows: [] as LeituraRow[], truncado: false };

  const supabase = getSupabaseServerClient();
  const pageSize = 1000;
  const maxPaginas = 220; // teto defensivo: 220k registros por consulta
  const rows: LeituraRow[] = [];
  let truncado = false;

  for (let pagina = 0; pagina < maxPaginas; pagina += 1) {
    const from = pagina * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("leituras_paginas_impressoras")
      .select("impressora_id,coletado_em,contador_total_paginas")
      .eq("valido", true)
      .in("impressora_id", impressoraIds)
      .gte("coletado_em", deIso)
      .lte("coletado_em", ateIso)
      .order("coletado_em", { ascending: true })
      .range(from, to);

    if (error) {
      return { rows: [] as LeituraRow[], truncado: false, error: error.message };
    }

    const batch = (data ?? []) as LeituraRow[];
    if (!batch.length) break;
    rows.push(...batch);

    if (batch.length < pageSize) break;
    if (pagina === maxPaginas - 1) truncado = true;
  }

  return { rows, truncado };
}

/**
 * [DOC-FUNC] buscarFaixaHistoricaGlobal
 * O que faz: Consulta e organiza informacoes na funcao 'buscarFaixaHistoricaGlobal', entregando retorno confiavel para camadas superiores.
 * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
 * Como executa: Consulta fontes de dados/servicos externos.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
async function buscarFaixaHistoricaGlobal(): Promise<FaixaHistorica> {
  const supabase = getSupabaseServerClient();
  const [{ data: asc }, { data: desc }] = await Promise.all([
    supabase
      .from("leituras_paginas_impressoras")
      .select("coletado_em")
      .eq("valido", true)
      .order("coletado_em", { ascending: true })
      .limit(1),
    supabase
      .from("leituras_paginas_impressoras")
      .select("coletado_em")
      .eq("valido", true)
      .order("coletado_em", { ascending: false })
      .limit(1)
  ]);

  return {
    primeira_coleta: asc?.[0]?.coletado_em ?? null,
    ultima_coleta: desc?.[0]?.coletado_em ?? null
  };
}

/**
 * [DOC-FUNC] buscarDashboardAnalitico
 * O que faz: Consulta e organiza informacoes na funcao 'buscarDashboardAnalitico', entregando retorno confiavel para camadas superiores.
 * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; padroniza campos para evitar divergencia de formato; itera listas/objetos para consolidar calculos e mapeamentos.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
export async function buscarDashboardAnalitico(options?: {
  dias?: number;
  agrupamento?: AgrupamentoPeriodo;
  setor?: string | null;
  localizacao?: string | null;
  de?: string | null;
  ate?: string | null;
}) {
  let dias = clamp(Number(options?.dias ?? 30), 1, HISTORICO_PAGINAS_DIAS_MAX);
  const agrupamento: AgrupamentoPeriodo = options?.agrupamento === "mes" ? "mes" : "dia";
  const setorFiltro = normalizarFiltro(String(options?.setor ?? ""));
  const localizacaoFiltro = normalizarFiltro(String(options?.localizacao ?? ""));
  let modoPeriodo: "relativo" | "custom" = "relativo";

  const visao = await listarVisaoGeralImpressoras();
  if (!visao.success) {
    return {
      success: false as const,
      status: 500,
      error: visao.error ?? "Falha ao carregar visao operacional."
    };
  }

  const operacionais = (visao.data as ImpressoraVisao[]).filter((item) => item.operacional);
  const totalPaginasAcumuladasGeral = operacionais.reduce((acc, item) => {
    const paginas = Number(item.contador_paginas_atual);
    if (!Number.isFinite(paginas) || paginas < 0) return acc;
    return acc + paginas;
  }, 0);
  const setoresDisponiveis = Array.from(new Set(operacionais.map((item) => nomeSetor(item.setor)))).sort(
    (a, b) => a.localeCompare(b)
  );
  const localizacoesDisponiveis = Array.from(
    new Set(operacionais.map((item) => nomeLocalizacao(item.localizacao)))
  ).sort((a, b) => a.localeCompare(b));

  const impressorasFiltradas = operacionais.filter((item) => {
    if (setorFiltro && normalizarFiltro(nomeSetor(item.setor)) !== setorFiltro) return false;
    if (localizacaoFiltro && normalizarFiltro(nomeLocalizacao(item.localizacao)) !== localizacaoFiltro) {
      return false;
    }
    return true;
  });
  const totalPaginasAcumuladasFiltro = impressorasFiltradas.reduce((acc, item) => {
    const paginas = Number(item.contador_paginas_atual);
    if (!Number.isFinite(paginas) || paginas < 0) return acc;
    return acc + paginas;
  }, 0);
  const impressoraMeta = new Map(impressorasFiltradas.map((item) => [item.id, item]));

  let online = 0;
  let offline = 0;
  let warning = 0;
  let error = 0;
  let unknown = 0;
  for (const item of impressorasFiltradas) {
    const status = normalizarFiltro(item.status_atual);
    if (status === "online") online += 1;
    else if (status === "offline") offline += 1;
    else if (status === "warning") warning += 1;
    else if (status === "error") error += 1;
    else unknown += 1;
  }
  const criticos = impressorasFiltradas.filter((item) => {
    const nivel = Number(item.menor_nivel_suprimento);
    return Number.isFinite(nivel) && nivel <= 10;
  }).length;
  const baixos = impressorasFiltradas.filter((item) => {
    const nivel = Number(item.menor_nivel_suprimento);
    return Number.isFinite(nivel) && nivel > 10 && nivel <= 20;
  }).length;

  let deIso = inicioPeriodoIso(dias);
  let ateIso = new Date().toISOString();
  const deCustom = String(options?.de ?? "").trim();
  const ateCustom = String(options?.ate ?? "").trim();
  if (deCustom || ateCustom) {
    if (!deCustom || !ateCustom) {
      return {
        success: false as const,
        status: 400,
        error: "Informe data inicial e final para período personalizado."
      };
    }
    const deDate = new Date(deCustom);
    const ateDate = new Date(ateCustom);
    if (!Number.isFinite(deDate.getTime()) || !Number.isFinite(ateDate.getTime())) {
      return {
        success: false as const,
        status: 400,
        error: "Período personalizado inválido."
      };
    }
    if (ateDate.getTime() < deDate.getTime()) {
      return {
        success: false as const,
        status: 400,
        error: "Data final deve ser maior ou igual à data inicial."
      };
    }
    const diffDays = Math.floor((ateDate.getTime() - deDate.getTime()) / 86400000) + 1;
    if (diffDays > HISTORICO_PAGINAS_DIAS_MAX) {
      return {
        success: false as const,
        status: 400,
        error: `Período máximo permitido é ${HISTORICO_PAGINAS_DIAS_MAX} dias.`
      };
    }
    dias = clamp(diffDays, 1, HISTORICO_PAGINAS_DIAS_MAX);
    deIso = deDate.toISOString();
    ateIso = ateDate.toISOString();
    modoPeriodo = "custom";
  }
  const impressoraIds = impressorasFiltradas.map((item) => item.id);

  const [leituras, faixaHistoricaGlobal] = await Promise.all([
    buscarLeiturasHistoricas(impressoraIds, deIso, ateIso),
    buscarFaixaHistoricaGlobal()
  ]);
  if ("error" in leituras) {
    return {
      success: false as const,
      status: 500,
      error: "Falha ao carregar historico de paginas."
    };
  }

  const bucketTracker = new Map<string, Map<string, { min: number; max: number }>>();
  const trackerPeriodoPorImpressora = new Map<string, { min: number; max: number }>();
  for (const row of leituras.rows) {
    const paginas = Number(row.contador_total_paginas);
    if (!Number.isFinite(paginas)) continue;

    const bucket = chaveBucket(row.coletado_em, agrupamento);
    if (!bucketTracker.has(bucket)) bucketTracker.set(bucket, new Map());

    const porImpressora = bucketTracker.get(bucket) as Map<string, { min: number; max: number }>;
    const atual = porImpressora.get(row.impressora_id);
    if (!atual) {
      porImpressora.set(row.impressora_id, { min: paginas, max: paginas });
      continue;
    }
    if (paginas < atual.min) atual.min = paginas;
    if (paginas > atual.max) atual.max = paginas;

    const atualPeriodo = trackerPeriodoPorImpressora.get(row.impressora_id);
    if (!atualPeriodo) {
      trackerPeriodoPorImpressora.set(row.impressora_id, { min: paginas, max: paginas });
    } else {
      if (paginas < atualPeriodo.min) atualPeriodo.min = paginas;
      if (paginas > atualPeriodo.max) atualPeriodo.max = paginas;
    }
  }

  const paginasPorPeriodo = Array.from(bucketTracker.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([periodo, porImpressora]) => {
      let total = 0;
      for (const faixa of porImpressora.values()) {
        total += Math.max(0, faixa.max - faixa.min);
      }
      return { periodo, total_paginas: total };
    });

  const totalPaginasPeriodo = paginasPorPeriodo.reduce((acc, item) => acc + item.total_paginas, 0);

  const rankingSetoresMap = new Map<
    string,
    { setor: string; total_paginas: number; impressoras_ativas: number }
  >();
  const rankingLocalizacoesMap = new Map<
    string,
    { localizacao: string; total_paginas: number; impressoras_ativas: number }
  >();
  const rankingModelosMap = new Map<
    string,
    { modelo: string; total_paginas: number; impressoras_ativas: number }
  >();
  for (const [impressoraId, faixa] of trackerPeriodoPorImpressora.entries()) {
    const delta = Math.max(0, faixa.max - faixa.min);
    if (delta <= 0) continue;

    const meta = impressoraMeta.get(impressoraId);
    const setor = nomeSetor(meta?.setor);
    const localizacao = nomeLocalizacao(meta?.localizacao);
    const modelo = String(meta?.modelo ?? "").trim() || "Modelo nao informado";
    if (!rankingSetoresMap.has(setor)) {
      rankingSetoresMap.set(setor, {
        setor,
        total_paginas: 0,
        impressoras_ativas: 0
      });
    }
    const atual = rankingSetoresMap.get(setor) as {
      setor: string;
      total_paginas: number;
      impressoras_ativas: number;
    };
    atual.total_paginas += delta;
    atual.impressoras_ativas += 1;

    if (!rankingLocalizacoesMap.has(localizacao)) {
      rankingLocalizacoesMap.set(localizacao, {
        localizacao,
        total_paginas: 0,
        impressoras_ativas: 0
      });
    }
    const atualLocalizacao = rankingLocalizacoesMap.get(localizacao) as {
      localizacao: string;
      total_paginas: number;
      impressoras_ativas: number;
    };
    atualLocalizacao.total_paginas += delta;
    atualLocalizacao.impressoras_ativas += 1;

    if (!rankingModelosMap.has(modelo)) {
      rankingModelosMap.set(modelo, {
        modelo,
        total_paginas: 0,
        impressoras_ativas: 0
      });
    }
    const atualModelo = rankingModelosMap.get(modelo) as {
      modelo: string;
      total_paginas: number;
      impressoras_ativas: number;
    };
    atualModelo.total_paginas += delta;
    atualModelo.impressoras_ativas += 1;
  }
  const rankingSetores = Array.from(rankingSetoresMap.values())
    .sort((a, b) => b.total_paginas - a.total_paginas)
    .slice(0, 12);
  const rankingLocalizacoes = Array.from(rankingLocalizacoesMap.values())
    .sort((a, b) => b.total_paginas - a.total_paginas)
    .slice(0, 12);
  const rankingModelos = Array.from(rankingModelosMap.values())
    .sort((a, b) => b.total_paginas - a.total_paginas)
    .slice(0, 20);

  const suprimentosDelicados = impressorasFiltradas
    .flatMap((impressora) =>
      (impressora.resumo_suprimentos ?? []).map((suprimento) => ({
        patrimonio: impressora.patrimonio,
        modelo: impressora.modelo,
        setor: nomeSetor(impressora.setor),
        localizacao: nomeLocalizacao(impressora.localizacao),
        nome_suprimento: suprimento.nome_suprimento,
        nivel_percentual: Number.isFinite(Number(suprimento.nivel_percentual))
          ? Number(suprimento.nivel_percentual)
          : null,
        status_suprimento: suprimento.status_suprimento
      }))
    )
    .filter((item) => item.nivel_percentual !== null && item.nivel_percentual <= 20)
    .sort((a, b) => Number(a.nivel_percentual) - Number(b.nivel_percentual))
    .slice(0, 20);

  const impressorasComparativoBase = impressorasFiltradas.map((item) => ({
    id: item.id,
    patrimonio: item.patrimonio,
    ip: item.ip,
    modelo: item.modelo,
    setor: nomeSetor(item.setor),
    localizacao: nomeLocalizacao(item.localizacao),
    status_atual: item.status_atual,
    ultima_coleta_em: item.ultima_coleta_em,
    contador_paginas_atual:
      Number.isFinite(Number(item.contador_paginas_atual)) && Number(item.contador_paginas_atual) >= 0
        ? Number(item.contador_paginas_atual)
        : null
  }));

  const impressorasComDadosPeriodo = trackerPeriodoPorImpressora.size;
  const impressorasSemDadosPeriodo = Math.max(0, impressorasFiltradas.length - impressorasComDadosPeriodo);
  const coberturaPeriodoPercentual =
    impressorasFiltradas.length > 0
      ? Math.round((impressorasComDadosPeriodo / impressorasFiltradas.length) * 100)
      : 0;

  return {
    success: true as const,
    data: {
      gerado_em: new Date().toISOString(),
      filtros: {
        dias,
        dias_maximo_historico: HISTORICO_PAGINAS_DIAS_MAX,
        agrupamento,
        setor: setorFiltro || "todos",
        localizacao: localizacaoFiltro || "todos",
        modo_periodo: modoPeriodo,
        de: modoPeriodo === "custom" ? deIso : null,
        ate: modoPeriodo === "custom" ? ateIso : null
      },
      setores_disponiveis: setoresDisponiveis,
      localizacoes_disponiveis: localizacoesDisponiveis,
      resumo: {
        total_impressoras: impressorasFiltradas.length,
        online,
        offline,
        warning,
        error,
        unknown,
        suprimentos_criticos: criticos,
        suprimentos_baixos: baixos,
        paginas_acumuladas_total_filtro: totalPaginasAcumuladasFiltro,
        paginas_periodo_total: totalPaginasPeriodo,
        paginas_acumuladas_total_geral: totalPaginasAcumuladasGeral,
        impressoras_com_dados_periodo: impressorasComDadosPeriodo,
        impressoras_sem_dados_periodo: impressorasSemDadosPeriodo,
        cobertura_periodo_percentual: coberturaPeriodoPercentual
      },
      faixa_historica_global: faixaHistoricaGlobal,
      paginas_por_periodo: paginasPorPeriodo,
      ranking_setores: rankingSetores,
      ranking_localizacoes: rankingLocalizacoes,
      ranking_modelos: rankingModelos,
      impressoras_comparativo_base: impressorasComparativoBase,
      suprimentos_delicados: suprimentosDelicados,
      historico_truncado: leituras.truncado
    }
  };
}

