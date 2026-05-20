/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\components\PainelDashboard.tsx
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusFeedback } from "@/components/StatusFeedback";
import { supabase } from "@/lib/supabase/client";

type DashboardData = {
  gerado_em: string;
  filtros: {
    dias: number;
    dias_maximo_historico?: number;
    agrupamento: "dia" | "mes";
    setor: string;
    localizacao: string;
    modo_periodo?: "relativo" | "custom";
    de?: string | null;
    ate?: string | null;
  };
  setores_disponiveis: string[];
  localizacoes_disponiveis: string[];
  resumo: {
    total_impressoras: number;
    online: number;
    offline: number;
    warning?: number;
    error?: number;
    unknown?: number;
    suprimentos_criticos: number;
    suprimentos_baixos: number;
    paginas_acumuladas_total_filtro: number;
    paginas_periodo_total: number;
    paginas_acumuladas_total_geral: number;
    impressoras_com_dados_periodo?: number;
    impressoras_sem_dados_periodo?: number;
    cobertura_periodo_percentual?: number;
  };
  faixa_historica_global: {
    primeira_coleta: string | null;
    ultima_coleta: string | null;
  };
  paginas_por_periodo: Array<{
    periodo: string;
    total_paginas: number;
  }>;
  ranking_setores: Array<{
    setor: string;
    total_paginas: number;
    impressoras_ativas: number;
  }>;
  ranking_localizacoes: Array<{
    localizacao: string;
    total_paginas: number;
    impressoras_ativas: number;
  }>;
  ranking_modelos?: Array<{
    modelo: string;
    total_paginas: number;
    impressoras_ativas: number;
  }>;
  impressoras_comparativo_base?: Array<{
    id: string;
    patrimonio: string;
    ip: string;
    modelo: string;
    setor: string;
    localizacao: string;
    status_atual: string;
    ultima_coleta_em: string | null;
    contador_paginas_atual: number | null;
  }>;
  suprimentos_delicados: Array<{
    patrimonio: string;
    modelo: string;
    setor: string;
    localizacao: string;
    nome_suprimento: string;
    nivel_percentual: number | null;
    status_suprimento: string;
  }>;
  historico_truncado: boolean;
};

type ChartPoint = {
  label: string;
  value: number;
  x: number;
  y: number;
};

const BILHETAGEM_STORAGE_KEY = "ntech_dashboard_bilhetagem_v1";
const PERIODO_PERSONALIZADO = "custom";
const DIAS_MAX_PADRAO = 92;
const CHART_WIDTH = 960;
const CHART_HEIGHT = 256;
const CHART_PADDING_X = 24;
const CHART_PADDING_TOP = 16;
const CHART_PADDING_BOTTOM = 34;
const BILHETAGEM_BASE_STORAGE_KEY = "ntech_dashboard_bilhetagem_base_v1";

type BilhetagemBaseItem = {
  quantidade: number;
  data_envio: string | null;
};

type BilhetagemBaseStorage = {
  by_patrimonio: Record<string, BilhetagemBaseItem>;
  by_ip: Record<string, BilhetagemBaseItem>;
  ultima_importacao_em: string | null;
  tarifas_por_modelo?: Record<string, number>;
};

/**
 * [DOC-FUNC] invokePrintFunction
 * Objetivo: calcula e exibe indicadores de impressao, custos e suprimentos para o painel.
 * Entradas: usa os parametros da assinatura e/ou estado ja carregado pela tela/servico.
 * Como executa: busca dados consolidados, aplica regras de delta diario/pagecount e entrega numeros prontos para graficos e cards; quando algo falha, propaga mensagem contextualizada para facilitar suporte e apresentacao.
 * Saida/Efeito: devolve dados prontos para a proxima etapa ou renderiza/atualiza a interface sem alterar a regra de negocio principal.
 */
async function invokePrintFunction<T>(action: string, payload?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("inventory-print", {
    body: { action, payload: payload ?? {} },
  });

  if (!error && data?.ok) {
    return data.data as T;
  }

  const reason = error?.message || data?.error || `Falha ao executar ${action}.`;
  throw new Error(reason);
}

/**
 * [DOC-FUNC] formatNumber
 * O que faz: A funcao 'formatNumber' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

/**
 * [DOC-FUNC] formatCurrency
 * O que faz: A funcao 'formatCurrency' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * [DOC-FUNC] formatNivel
 * O que faz: A funcao 'formatNivel' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function formatNivel(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  return `${Math.round(value)}%`;
}

/**
 * [DOC-FUNC] formatDateTime
 * O que faz: A funcao 'formatDateTime' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function formatDateTime(value: string | null) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("pt-BR");
}

/**
 * [DOC-FUNC] normalizarModeloKey
 * O que faz: A funcao 'normalizarModeloKey' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizarModeloKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * [DOC-FUNC] normalizarPatrimonioKey
 * O que faz: A funcao 'normalizarPatrimonioKey' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizarPatrimonioKey(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

/**
 * [DOC-FUNC] normalizarIpKey
 * O que faz: A funcao 'normalizarIpKey' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizarIpKey(value: string) {
  return value.trim().replace(/\/32$/, "");
}

/**
 * [DOC-FUNC] formatDateInput
 * O que faz: A funcao 'formatDateInput' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: date. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * [DOC-FUNC] parseDataReferencia
 * O que faz: A funcao 'parseDataReferencia' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function parseDataReferencia(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const br = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (br) {
    const dd = Number(br[1]);
    const mm = Number(br[2]);
    const yy = Number(br[3].length === 2 ? `20${br[3]}` : br[3]);
    if (Number.isFinite(dd) && Number.isFinite(mm) && Number.isFinite(yy)) {
      const dt = new Date(yy, mm - 1, dd);
      if (Number.isFinite(dt.getTime())) return formatDateInput(dt);
    }
  }

  const dt = new Date(raw);
  if (!Number.isNaN(dt.getTime())) return formatDateInput(dt);
  return raw;
}

/**
 * [DOC-FUNC] formatDataReferencia
 * O que faz: A funcao 'formatDataReferencia' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function formatDataReferencia(value: string | null) {
  if (!value) return "-";
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return `${iso[3]}/${iso[2]}/${iso[1]}`;
  }
  return value;
}

/**
 * [DOC-FUNC] parseTarifaNumber
 * O que faz: A funcao 'parseTarifaNumber' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function parseTarifaNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 0 ? value : null;
  }

  let text = String(value ?? "").trim();
  if (!text) return null;
  text = text.replace(/R\$/gi, "").replace(/\s/g, "");

  if (text.includes(".") && text.includes(",")) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }

  text = text.replace(/[^0-9.-]/g, "");
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

/**
 * [DOC-FUNC] parseContadorNumber
 * O que faz: A funcao 'parseContadorNumber' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function parseContadorNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 0 ? Math.round(value) : null;
  }

  let text = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/[^\d,.-]/g, "");

  if (!text || text === "-" || text === "--") return null;

  const hasDot = text.includes(".");
  const hasComma = text.includes(",");

  if (hasDot && hasComma) {
    const lastDot = text.lastIndexOf(".");
    const lastComma = text.lastIndexOf(",");
    const lastSep = Math.max(lastDot, lastComma);
    const fractionalSize = text.length - lastSep - 1;

    if (fractionalSize <= 2) {
      if (lastComma > lastDot) {
        text = text.replace(/\./g, "").replace(",", ".");
      } else {
        text = text.replace(/,/g, "");
      }
    } else {
      text = text.replace(/[.,]/g, "");
    }
  } else if (hasComma) {
    const commas = text.match(/,/g)?.length ?? 0;
    const lastComma = text.lastIndexOf(",");
    const fractionalSize = text.length - lastComma - 1;
    if (commas > 1 || fractionalSize === 3) {
      text = text.replace(/,/g, "");
    } else if (fractionalSize <= 2) {
      text = text.replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (hasDot) {
    const dots = text.match(/\./g)?.length ?? 0;
    const lastDot = text.lastIndexOf(".");
    const fractionalSize = text.length - lastDot - 1;
    if (dots > 1 || fractionalSize === 3) {
      text = text.replace(/\./g, "");
    }
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

/**
 * [DOC-FUNC] normalizarCabecalhoPlanilha
 * O que faz: A funcao 'normalizarCabecalhoPlanilha' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizarCabecalhoPlanilha(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * [DOC-FUNC] toIsoRangeBoundary
 * O que faz: A funcao 'toIsoRangeBoundary' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: dateInput, endOfDay. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
 * Retorno/Efeitos: Retorna verdadeiro/falso para orientar o proximo passo do fluxo sem ambiguidade, facilitando leitura e depuracao.
 */
function toIsoRangeBoundary(dateInput: string, endOfDay: boolean) {
  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  const dt = new Date(`${dateInput}${suffix}`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

/**
 * [DOC-FUNC] montarGraficoLinhas
 * O que faz: A funcao 'montarGraficoLinhas' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: points. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) percorre colecoes quando necessario para consolidar ou transformar resultados.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function montarGraficoLinhas(points: ChartPoint[]) {
  if (!points.length) {
    return {
      linePath: "",
      areaPath: "",
      gridLinesY: [] as number[],
      xLabels: [] as ChartPoint[],
    };
  }

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");

  const last = points[points.length - 1];
  const areaPath = [
    linePath,
    `L ${last.x.toFixed(1)} ${(CHART_HEIGHT - CHART_PADDING_BOTTOM).toFixed(1)}`,
    `L ${points[0].x.toFixed(1)} ${(CHART_HEIGHT - CHART_PADDING_BOTTOM).toFixed(1)}`,
    "Z",
  ].join(" ");

  const chartTop = CHART_PADDING_TOP;
  const chartBottom = CHART_HEIGHT - CHART_PADDING_BOTTOM;
  const yTicks = 4;
  const gridLinesY = Array.from({ length: yTicks + 1 }, (_, index) =>
    chartTop + ((chartBottom - chartTop) / yTicks) * index
  );

  const maxLabels = 8;
  const step = Math.max(1, Math.ceil(points.length / maxLabels));
  const xLabels = points.filter((_, index) => index % step === 0 || index === points.length - 1);

  return {
    linePath,
    areaPath,
    gridLinesY,
    xLabels,
  };
}

/**
 * [DOC-FUNC] importarTarifasPorArquivo
 * O que faz: A funcao 'importarTarifasPorArquivo' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: file. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) percorre colecoes quando necessario para consolidar ou transformar resultados.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
async function importarTarifasPorArquivo(file: File) {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    return {} as Record<string, number>;
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  if (!rows.length) return {} as Record<string, number>;

  const firstRow = rows[0].map((value) => String(value ?? "").trim().toLowerCase());
  const modeloIdxHeader = firstRow.findIndex((cell) => cell.includes("modelo") || cell.includes("model"));
  const valorIdxHeader = firstRow.findIndex((cell) =>
    ["valor", "preco", "preço", "custo", "tarifa", "valor_por_pagina"].some((token) =>
      cell.includes(token)
    )
  );

  const modeloIdx = modeloIdxHeader >= 0 ? modeloIdxHeader : 0;
  const valorIdx = valorIdxHeader >= 0 ? valorIdxHeader : 1;
  const startRow = modeloIdxHeader >= 0 && valorIdxHeader >= 0 ? 1 : 0;

  const parsed: Record<string, number> = {};
  for (let index = startRow; index < rows.length; index += 1) {
    const row = rows[index];
    const modelo = normalizarModeloKey(String(row?.[modeloIdx] ?? ""));
    const valor = parseTarifaNumber(row?.[valorIdx]);
    if (!modelo || valor === null) continue;
    parsed[modelo] = valor;
  }

  return parsed;
}

/**
 * [DOC-FUNC] importarBaseBilhetagemPorArquivo
 * O que faz: A funcao 'importarBaseBilhetagemPorArquivo' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: file. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
async function importarBaseBilhetagemPorArquivo(file: File): Promise<BilhetagemBaseStorage> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    return {
      by_patrimonio: {},
      by_ip: {},
      ultima_importacao_em: new Date().toISOString(),
      tarifas_por_modelo: {},
    };
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  if (!rows.length) {
    return {
      by_patrimonio: {},
      by_ip: {},
      ultima_importacao_em: new Date().toISOString(),
      tarifas_por_modelo: {},
    };
  }

  /**
   * [DOC-FUNC] findColumn
   * O que faz: A funcao 'findColumn' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
   * Entradas: Recebe os parametros: headers, predicates. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) percorre colecoes quando necessario para consolidar ou transformar resultados.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  const findColumn = (headers: string[], predicates: string[]) =>
    headers.findIndex((cell) => predicates.some((token) => cell.includes(token)));

  const maxHeaderScan = Math.min(rows.length, 40);
  let headerRowIndex = 0;
  let patrimonioIdx = -1;
  let ipIdx = -1;
  let dataIdx = -1;
  let modeloIdx = -1;
  let quantidadeIdxDireta = -1;
  let finalPbIdx = -1;
  let finalColorIdx = -1;
  let producaoPbIdx = -1;
  let producaoColorIdx = -1;
  let valorUnitPbIdx = -1;
  let valorUnitColorIdx = -1;
  let bestScore = -1;

  for (let rowIndex = 0; rowIndex < maxHeaderScan; rowIndex += 1) {
    const header = (rows[rowIndex] ?? []).map(normalizarCabecalhoPlanilha);
    const patrCandidate = findColumn(header, ["patrimonio", "nr patrimonio", "n patrimonio"]);
    const ipCandidate = findColumn(header, [" ip", "ip ", "ip do equipamento", "endereco ip", "ip"]);
    const dataCandidate = findColumn(header, [
      "data leitura",
      "data",
      "envio",
      "competencia",
      "referencia",
    ]);
    const modeloCandidate = findColumn(header, ["modelo", "model"]);
    const quantidadeDiretaCandidate = findColumn(header, [
      "qtde",
      "quantidade",
      "contador",
      "contagem",
      "total paginas",
      "page count",
      "pagecount",
    ]);
    const finalPbCandidate = findColumn(header, [
      "final p&b",
      "final pb",
      "final preto",
      "final mono",
    ]);
    const finalColorCandidate = findColumn(header, ["final color", "final cor"]);
    const producaoPbCandidate = findColumn(header, [
      "producao p&b",
      "producao pb",
      "producao preto",
      "producao mono",
    ]);
    const producaoColorCandidate = findColumn(header, ["producao color", "producao cor"]);
    const valorUnitPbCandidate = findColumn(header, [
      "valor unit. p&b",
      "valor unit p&b",
      "valor unit pb",
      "valor unitario p&b",
      "valor unitario pb",
    ]);
    const valorUnitColorCandidate = findColumn(header, [
      "valor unit. color",
      "valor unit color",
      "valor unitario color",
      "valor unit. cor",
      "valor unit cor",
    ]);

    const temIdentificador = patrCandidate >= 0 || ipCandidate >= 0;
    const temQuantidade =
      quantidadeDiretaCandidate >= 0 ||
      finalPbCandidate >= 0 ||
      finalColorCandidate >= 0 ||
      producaoPbCandidate >= 0 ||
      producaoColorCandidate >= 0;

    if (!temIdentificador || !temQuantidade) continue;

    const score =
      (patrCandidate >= 0 ? 3 : 0) +
      (ipCandidate >= 0 ? 2 : 0) +
      (modeloCandidate >= 0 ? 1 : 0) +
      (quantidadeDiretaCandidate >= 0 ? 3 : 0) +
      (finalPbCandidate >= 0 ? 2 : 0) +
      (valorUnitPbCandidate >= 0 || valorUnitColorCandidate >= 0 ? 2 : 0) +
      (producaoPbCandidate >= 0 ? 1 : 0);

    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = rowIndex;
      patrimonioIdx = patrCandidate;
      ipIdx = ipCandidate;
      dataIdx = dataCandidate;
      modeloIdx = modeloCandidate;
      quantidadeIdxDireta = quantidadeDiretaCandidate;
      finalPbIdx = finalPbCandidate;
      finalColorIdx = finalColorCandidate;
      producaoPbIdx = producaoPbCandidate;
      producaoColorIdx = producaoColorCandidate;
      valorUnitPbIdx = valorUnitPbCandidate;
      valorUnitColorIdx = valorUnitColorCandidate;
    }
  }

  const startRow = headerRowIndex + 1;
  const byPatrimonio: Record<string, BilhetagemBaseItem> = {};
  const byIp: Record<string, BilhetagemBaseItem> = {};
  const tarifaByModeloStats = new Map<string, { custoTotal: number; paginasTotal: number; somaTarifas: number; amostrasTarifa: number }>();

  /**
   * [DOC-FUNC] registrarTarifaModelo
   * O que faz: A funcao 'registrarTarifaModelo' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
   * Entradas: Recebe os parametros: modeloKey, tarifa, pesoPaginas?. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) percorre colecoes quando necessario para consolidar ou transformar resultados.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  const registrarTarifaModelo = (modeloKey: string, tarifa: number, pesoPaginas?: number) => {
    if (!modeloKey || !Number.isFinite(tarifa) || tarifa < 0) return;
    const safePeso = Number.isFinite(Number(pesoPaginas)) && Number(pesoPaginas) > 0 ? Number(pesoPaginas) : 0;

    const atual = tarifaByModeloStats.get(modeloKey) ?? {
      custoTotal: 0,
      paginasTotal: 0,
      somaTarifas: 0,
      amostrasTarifa: 0,
    };
    atual.somaTarifas += tarifa;
    atual.amostrasTarifa += 1;
    if (safePeso > 0) {
      atual.custoTotal += tarifa * safePeso;
      atual.paginasTotal += safePeso;
    }
    tarifaByModeloStats.set(modeloKey, atual);
  };

  for (let index = startRow; index < rows.length; index += 1) {
    const row = rows[index];
    const patrimonio = patrimonioIdx >= 0 ? normalizarPatrimonioKey(String(row?.[patrimonioIdx] ?? "")) : "";
    const ip = ipIdx >= 0 ? normalizarIpKey(String(row?.[ipIdx] ?? "").trim()) : "";
    const dataEnvio = dataIdx >= 0 ? parseDataReferencia(row?.[dataIdx]) : null;

    if (!patrimonio && !ip) continue;
    if (patrimonio === "TOTAL" || patrimonio === "SOMA") continue;

    let quantidade: number | null = null;
    const modeloKey =
      modeloIdx >= 0 ? normalizarModeloKey(String(row?.[modeloIdx] ?? "")) : "";
    const valorUnitPb = valorUnitPbIdx >= 0 ? parseTarifaNumber(row?.[valorUnitPbIdx]) : null;
    const valorUnitColor = valorUnitColorIdx >= 0 ? parseTarifaNumber(row?.[valorUnitColorIdx]) : null;
    const producaoPb = producaoPbIdx >= 0 ? parseContadorNumber(row?.[producaoPbIdx]) : null;
    const producaoColor = producaoColorIdx >= 0 ? parseContadorNumber(row?.[producaoColorIdx]) : null;
    if (quantidadeIdxDireta >= 0) {
      quantidade = parseContadorNumber(row?.[quantidadeIdxDireta]);
    }

    if (quantidade === null && (finalPbIdx >= 0 || finalColorIdx >= 0)) {
      const finalPb = finalPbIdx >= 0 ? parseContadorNumber(row?.[finalPbIdx]) : null;
      const finalColor = finalColorIdx >= 0 ? parseContadorNumber(row?.[finalColorIdx]) : null;
      if (finalPb !== null || finalColor !== null) {
        quantidade = (finalPb ?? 0) + (finalColor ?? 0);
      }
    }

    if (quantidade === null && (producaoPbIdx >= 0 || producaoColorIdx >= 0)) {
      const producaoPb = producaoPbIdx >= 0 ? parseContadorNumber(row?.[producaoPbIdx]) : null;
      const producaoColor = producaoColorIdx >= 0 ? parseContadorNumber(row?.[producaoColorIdx]) : null;
      if (producaoPb !== null || producaoColor !== null) {
        quantidade = (producaoPb ?? 0) + (producaoColor ?? 0);
      }
    }

    if (quantidade === null) continue;

    if (modeloKey && (valorUnitPb !== null || valorUnitColor !== null)) {
      const pb = producaoPb ?? 0;
      const color = producaoColor ?? 0;
      const totalProduzido = pb + color;
      if (totalProduzido > 0) {
        const custoTotalLinha = pb * (valorUnitPb ?? 0) + color * (valorUnitColor ?? 0);
        registrarTarifaModelo(modeloKey, custoTotalLinha / totalProduzido, totalProduzido);
      } else {
        const tarifas = [valorUnitPb, valorUnitColor].filter(
          (value): value is number => value !== null && Number.isFinite(value)
        );
        if (tarifas.length) {
          const mediaSimples = tarifas.reduce((acc, value) => acc + value, 0) / tarifas.length;
          registrarTarifaModelo(modeloKey, mediaSimples, 0);
        }
      }
    }

    const item: BilhetagemBaseItem = {
      quantidade,
      data_envio: dataEnvio,
    };

    if (patrimonio) byPatrimonio[patrimonio] = item;
    if (ip) byIp[ip] = item;
  }

  const tarifasPorModelo: Record<string, number> = {};
  for (const [modeloKey, stats] of tarifaByModeloStats.entries()) {
    let tarifaFinal: number | null = null;
    if (stats.paginasTotal > 0) {
      tarifaFinal = stats.custoTotal / stats.paginasTotal;
    } else if (stats.amostrasTarifa > 0) {
      tarifaFinal = stats.somaTarifas / stats.amostrasTarifa;
    }

    if (tarifaFinal !== null && Number.isFinite(tarifaFinal) && tarifaFinal >= 0) {
      tarifasPorModelo[modeloKey] = Number(tarifaFinal.toFixed(6));
    }
  }

  return {
    by_patrimonio: byPatrimonio,
    by_ip: byIp,
    ultima_importacao_em: new Date().toISOString(),
    tarifas_por_modelo: tarifasPorModelo,
  };
}

/**
 * [DOC-FUNC] PainelDashboard
 * O que faz: A funcao 'PainelDashboard' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
export function PainelDashboard() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [importandoTarifas, setImportandoTarifas] = useState(false);
  const [importandoBaseBilhetagem, setImportandoBaseBilhetagem] = useState(false);

  const [dias, setDias] = useState(30);
  const [agrupamento, setAgrupamento] = useState<"dia" | "mes">("dia");
  const [setor, setSetor] = useState("todos");
  const [localizacao, setLocalizacao] = useState("todos");
  const [modoPeriodo, setModoPeriodo] = useState<"relativo" | "custom">("relativo");
  const [dataInicio, setDataInicio] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() - 29);
    return formatDateInput(start);
  });
  const [dataFim, setDataFim] = useState(() => formatDateInput(new Date()));
  const [custoPadraoPagina, setCustoPadraoPagina] = useState(0.12);
  const [tarifasPorModelo, setTarifasPorModelo] = useState<Record<string, number>>({});
  const [baseBilhetagem, setBaseBilhetagem] = useState<BilhetagemBaseStorage>({
    by_patrimonio: {},
    by_ip: {},
    ultima_importacao_em: null,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(BILHETAGEM_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        custoPadraoPagina?: unknown;
        tarifasPorModelo?: Record<string, unknown>;
      };

      const custo = parseTarifaNumber(parsed?.custoPadraoPagina);
      if (custo !== null) setCustoPadraoPagina(custo);

      const tarifas = parsed?.tarifasPorModelo ?? {};
      const saneadas: Record<string, number> = {};
      for (const [modelo, value] of Object.entries(tarifas)) {
        const key = normalizarModeloKey(modelo);
        const tarifa = parseTarifaNumber(value);
        if (!key || tarifa === null) continue;
        saneadas[key] = tarifa;
      }
      setTarifasPorModelo(saneadas);
    } catch {
      // Ignore storage parse issues.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(BILHETAGEM_BASE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<BilhetagemBaseStorage>;
      const byPatrimonio: Record<string, BilhetagemBaseItem> = {};
      const byIp: Record<string, BilhetagemBaseItem> = {};

      for (const [key, item] of Object.entries(parsed?.by_patrimonio ?? {})) {
        const patrimonio = normalizarPatrimonioKey(key);
        const quantidade = parseContadorNumber((item as BilhetagemBaseItem)?.quantidade);
        if (!patrimonio || quantidade === null) continue;
        byPatrimonio[patrimonio] = {
          quantidade,
          data_envio: parseDataReferencia((item as BilhetagemBaseItem)?.data_envio),
        };
      }

      for (const [key, item] of Object.entries(parsed?.by_ip ?? {})) {
        const ip = normalizarIpKey(String(key || "").trim());
        const quantidade = parseContadorNumber((item as BilhetagemBaseItem)?.quantidade);
        if (!ip || quantidade === null) continue;
        byIp[ip] = {
          quantidade,
          data_envio: parseDataReferencia((item as BilhetagemBaseItem)?.data_envio),
        };
      }

      setBaseBilhetagem({
        by_patrimonio: byPatrimonio,
        by_ip: byIp,
        ultima_importacao_em: String(parsed?.ultima_importacao_em ?? "").trim() || null,
      });
    } catch {
      // Ignore storage parse issues.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      custoPadraoPagina,
      tarifasPorModelo,
    };
    window.localStorage.setItem(BILHETAGEM_STORAGE_KEY, JSON.stringify(payload));
  }, [custoPadraoPagina, tarifasPorModelo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(BILHETAGEM_BASE_STORAGE_KEY, JSON.stringify(baseBilhetagem));
  }, [baseBilhetagem]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    setSucesso(null);

    try {
      const payload: Record<string, unknown> = {
        agrupamento,
        setor: setor !== "todos" ? setor : null,
        localizacao: localizacao !== "todos" ? localizacao : null,
      };

      if (modoPeriodo === "custom") {
        const de = toIsoRangeBoundary(dataInicio, false);
        const ate = toIsoRangeBoundary(dataFim, true);
        if (!de || !ate) {
          throw new Error("Período personalizado inválido.");
        }
        if (new Date(ate).getTime() < new Date(de).getTime()) {
          throw new Error("Data final deve ser maior ou igual à data inicial.");
        }
        payload.de = de;
        payload.ate = ate;
      } else {
        payload.dias = dias;
      }

      const dados = await invokePrintFunction<DashboardData>("dashboard_analitico", payload);
      setData(dados);
      setSucesso(`Dashboard atualizado em ${new Date(dados.gerado_em).toLocaleString("pt-BR")}.`);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar dashboard.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [agrupamento, dataFim, dataInicio, dias, localizacao, modoPeriodo, setor]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const diasMaximoHistorico = data?.filtros?.dias_maximo_historico ?? DIAS_MAX_PADRAO;
  const periodoSelectValue = modoPeriodo === "custom" ? PERIODO_PERSONALIZADO : String(dias);

  const chartPoints = useMemo(() => {
    const serie = data?.paginas_por_periodo ?? [];
    if (!serie.length) return [] as ChartPoint[];

    const maxValue = Math.max(...serie.map((item) => item.total_paginas), 1);
    const chartInnerWidth = CHART_WIDTH - CHART_PADDING_X * 2;
    const chartInnerHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;
    const stepX = serie.length > 1 ? chartInnerWidth / (serie.length - 1) : 0;

    return serie.map((item, index) => {
      const ratio = item.total_paginas / maxValue;
      return {
        label: item.periodo,
        value: item.total_paginas,
        x: CHART_PADDING_X + stepX * index,
        y: CHART_PADDING_TOP + (1 - ratio) * chartInnerHeight,
      };
    });
  }, [data]);

  const grafico = useMemo(() => montarGraficoLinhas(chartPoints), [chartPoints]);

  const maxSetorPaginas = useMemo(() => {
    if (!data?.ranking_setores?.length) return 0;
    return Math.max(...data.ranking_setores.map((item) => item.total_paginas));
  }, [data]);

  const maxLocalizacaoPaginas = useMemo(() => {
    if (!data?.ranking_localizacoes?.length) return 0;
    return Math.max(...data.ranking_localizacoes.map((item) => item.total_paginas));
  }, [data]);

  const linhasBilhetagem = useMemo(() => {
    const modelos = data?.ranking_modelos ?? [];
    return modelos.map((item) => {
      const key = normalizarModeloKey(item.modelo);
      const tarifa = tarifasPorModelo[key] ?? custoPadraoPagina;
      const custoEstimado = item.total_paginas * tarifa;
      return {
        ...item,
        key,
        tarifa,
        custo_estimado: custoEstimado,
      };
    });
  }, [custoPadraoPagina, data, tarifasPorModelo]);

  const resumoBilhetagem = useMemo(() => {
    const totalPaginas = linhasBilhetagem.reduce((acc, item) => acc + item.total_paginas, 0);
    const totalCusto = linhasBilhetagem.reduce((acc, item) => acc + item.custo_estimado, 0);
    return {
      totalPaginas,
      totalCusto,
      custoMedioPagina: totalPaginas > 0 ? totalCusto / totalPaginas : 0,
    };
  }, [linhasBilhetagem]);

  const linhasComparativoBilhetagem = useMemo(() => {
    const impressoras = data?.impressoras_comparativo_base ?? [];
    return impressoras
      .map((item) => {
        const patrimonioKey = normalizarPatrimonioKey(item.patrimonio);
        const ipKey = normalizarIpKey(item.ip);
        const base =
          (patrimonioKey ? baseBilhetagem.by_patrimonio[patrimonioKey] : undefined) ??
          (ipKey ? baseBilhetagem.by_ip[ipKey] : undefined) ??
          null;

        const atual =
          Number.isFinite(Number(item.contador_paginas_atual)) && Number(item.contador_paginas_atual) >= 0
            ? Number(item.contador_paginas_atual)
            : null;
        let deltaPaginas: number | null = null;
        let resetDetectado = false;
        if (base && atual !== null) {
          if (atual >= base.quantidade) {
            deltaPaginas = Math.round(atual - base.quantidade);
          } else {
            deltaPaginas = 0;
            resetDetectado = true;
          }
        }

        return {
          ...item,
          base_quantidade: base?.quantidade ?? null,
          base_data_envio: base?.data_envio ?? null,
          delta_paginas: deltaPaginas,
          reset_detectado: resetDetectado,
          sem_base: !base,
          sem_leitura_atual: atual === null,
          contador_paginas_atual: atual,
        };
      })
      .sort((a, b) => {
        const deltaA = a.delta_paginas ?? -1;
        const deltaB = b.delta_paginas ?? -1;
        if (deltaA !== deltaB) return deltaB - deltaA;
        return String(a.patrimonio).localeCompare(String(b.patrimonio));
      });
  }, [baseBilhetagem, data]);

  const resumoComparativoBilhetagem = useMemo(() => {
    const linhas = linhasComparativoBilhetagem;
    const total = linhas.length;
    const comBase = linhas.filter((item) => !item.sem_base).length;
    const semBase = total - comBase;
    const semLeituraAtual = linhas.filter((item) => item.sem_leitura_atual).length;
    const comparaveis = linhas.filter((item) => item.delta_paginas !== null).length;
    const totalPaginasFaturaveis = linhas.reduce((acc, item) => acc + (item.delta_paginas ?? 0), 0);
    const totalResets = linhas.filter((item) => item.reset_detectado).length;
    const datasBase = Array.from(
      new Set(
        linhas
          .map((item) => item.base_data_envio)
          .filter((value): value is string => Boolean(value))
      )
    )
      .sort((a, b) => a.localeCompare(b));

    return {
      total,
      comBase,
      semBase,
      semLeituraAtual,
      comparaveis,
      totalPaginasFaturaveis,
      totalResets,
      referenciaBaseMaisRecente: datasBase.length ? datasBase[datasBase.length - 1] : null,
    };
  }, [linhasComparativoBilhetagem]);

  const linhasBilhetagemCiclo = useMemo(() => {
    const agrupado = new Map<string, { modelo: string; total_paginas: number; impressoras_ativas: number }>();
    for (const item of linhasComparativoBilhetagem) {
      const delta = Number(item.delta_paginas);
      if (!Number.isFinite(delta) || delta <= 0) continue;
      const modelo = String(item.modelo || "").trim() || "Modelo não informado";
      const key = normalizarModeloKey(modelo);

      if (!agrupado.has(key)) {
        agrupado.set(key, {
          modelo,
          total_paginas: 0,
          impressoras_ativas: 0,
        });
      }

      const atual = agrupado.get(key) as { modelo: string; total_paginas: number; impressoras_ativas: number };
      atual.total_paginas += Math.round(delta);
      atual.impressoras_ativas += 1;
    }

    return Array.from(agrupado.entries())
      .map(([key, item]) => {
        const tarifa = tarifasPorModelo[key] ?? custoPadraoPagina;
        return {
          ...item,
          key,
          tarifa,
          custo_estimado: item.total_paginas * tarifa,
        };
      })
      .sort((a, b) => b.total_paginas - a.total_paginas);
  }, [custoPadraoPagina, linhasComparativoBilhetagem, tarifasPorModelo]);

  const linhasBilhetagemExibicao = useMemo(() => {
    if (linhasBilhetagem.length > 0) return linhasBilhetagem;
    return linhasBilhetagemCiclo;
  }, [linhasBilhetagem, linhasBilhetagemCiclo]);

  const resumoBilhetagemExibicao = useMemo(() => {
    const totalPaginas = linhasBilhetagemExibicao.reduce((acc, item) => acc + item.total_paginas, 0);
    const totalCusto = linhasBilhetagemExibicao.reduce((acc, item) => acc + item.custo_estimado, 0);
    return {
      totalPaginas,
      totalCusto,
      custoMedioPagina: totalPaginas > 0 ? totalCusto / totalPaginas : 0,
      fonte: linhasBilhetagem.length > 0 ? "periodo" : linhasBilhetagemCiclo.length > 0 ? "comparativo" : "vazio",
    };
  }, [linhasBilhetagem, linhasBilhetagemCiclo.length, linhasBilhetagemExibicao]);

  const atualizarTarifaModelo = useCallback((modeloKey: string, value: string) => {
    const parsed = parseTarifaNumber(value);
    setTarifasPorModelo((current) => {
      const next = { ...current };
      if (parsed === null) {
        delete next[modeloKey];
      } else {
        next[modeloKey] = parsed;
      }
      return next;
    });
  }, []);

  const importarTarifas = useCallback(async (file: File | null) => {
    if (!file) return;
    setImportandoTarifas(true);
    setErro(null);
    try {
      const parsed = await importarTarifasPorArquivo(file);
      const entries = Object.entries(parsed);
      if (!entries.length) {
        throw new Error("Nenhuma tarifa válida encontrada no arquivo.");
      }

      setTarifasPorModelo((current) => {
        const next = { ...current };
        for (const [key, value] of entries) {
          next[key] = value;
        }
        return next;
      });
      setSucesso(`${entries.length} tarifa(s) de bilhetagem importada(s).`);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao importar tarifas.");
    } finally {
      setImportandoTarifas(false);
    }
  }, []);

  const importarBaseBilhetagem = useCallback(async (file: File | null) => {
    if (!file) return;
    setImportandoBaseBilhetagem(true);
    setErro(null);
    try {
      const baseImportada = await importarBaseBilhetagemPorArquivo(file);
      const totalBases =
        Object.keys(baseImportada.by_patrimonio).length + Object.keys(baseImportada.by_ip).length;
      if (!totalBases) {
        throw new Error("Planilha sem base válida. Verifique colunas de patrimônio/IP e quantidade.");
      }

      setBaseBilhetagem(baseImportada);
      const tarifasDetectadas = Object.entries(baseImportada.tarifas_por_modelo ?? {});
      if (tarifasDetectadas.length) {
        setTarifasPorModelo((current) => {
          const next = { ...current };
          for (const [key, value] of tarifasDetectadas) {
            const tarifa = parseTarifaNumber(value);
            if (!key || tarifa === null) continue;
            next[normalizarModeloKey(key)] = tarifa;
          }
          return next;
        });
      }

      setSucesso(
        `Base de bilhetagem importada com sucesso (${totalBases} referência(s), ${tarifasDetectadas.length} tarifa(s) por modelo detectada(s)).`
      );
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao importar base de bilhetagem.");
    } finally {
      setImportandoBaseBilhetagem(false);
    }
  }, []);

  return (
    <>
      <section className="ui-card ui-analytics-shell" style={{ marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>Dashboard de Impressoras</h2>
        <p className="ui-kv" style={{ marginTop: 0 }}>
          Visão analítica com conectividade SNMP, volume de páginas e custo estimado de bilhetagem.
        </p>

        <div className="ui-analytics-filters">
          <label>
            <span className="ui-kv">Período</span>
            <select
              className="ui-select"
              value={periodoSelectValue}
              onChange={(event) => {
                const value = event.target.value;
                if (value === PERIODO_PERSONALIZADO) {
                  setModoPeriodo("custom");
                  return;
                }
                const parsed = Number(value);
                if (!Number.isFinite(parsed) || parsed <= 0) return;
                setModoPeriodo("relativo");
                setDias(parsed);
              }}
            >
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={60}>Últimos 60 dias</option>
              <option value={90}>Últimos 90 dias</option>
              <option value={PERIODO_PERSONALIZADO}>Personalizado</option>
            </select>
          </label>

          <label>
            <span className="ui-kv">Agrupamento</span>
            <select
              className="ui-select"
              value={agrupamento}
              onChange={(event) => setAgrupamento(event.target.value === "mes" ? "mes" : "dia")}
            >
              <option value="dia">Por dia</option>
              <option value="mes">Por mês</option>
            </select>
          </label>

          <label>
            <span className="ui-kv">Setor</span>
            <select className="ui-select" value={setor} onChange={(event) => setSetor(event.target.value)}>
              <option value="todos">Todos</option>
              {(data?.setores_disponiveis ?? []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="ui-kv">Localização</span>
            <select
              className="ui-select"
              value={localizacao}
              onChange={(event) => setLocalizacao(event.target.value)}
            >
              <option value="todos">Todas</option>
              {(data?.localizacoes_disponiveis ?? []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        {modoPeriodo === "custom" ? (
          <div className="ui-analytics-range">
            <label>
              <span className="ui-kv">Data inicial</span>
              <input
                className="ui-field"
                type="date"
                value={dataInicio}
                max={dataFim}
                onChange={(event) => setDataInicio(event.target.value)}
              />
            </label>
            <label>
              <span className="ui-kv">Data final</span>
              <input
                className="ui-field"
                type="date"
                value={dataFim}
                min={dataInicio}
                onChange={(event) => setDataFim(event.target.value)}
              />
            </label>
            <p className="ui-kv" style={{ margin: 0, alignSelf: "end" }}>
              Janela máxima: {diasMaximoHistorico} dias.
            </p>
          </div>
        ) : null}

        <div className="ui-row" style={{ marginTop: 12 }}>
          <button className="ui-btn ui-btn-primary" onClick={() => void carregar()}>
            Atualizar dashboard
          </button>
        </div>
      </section>

      <StatusFeedback loading={loading} error={erro} success={sucesso} />

      {data ? (
        <>
          <section className="ui-dashboard-grid" style={{ marginBottom: 12 }}>
            <article className="ui-card ui-dash-card">
              <h3>Impressoras (filtro)</h3>
              <p className="big">{formatNumber(data.resumo.total_impressoras)}</p>
            </article>
            <article className="ui-card ui-dash-card">
              <h3>Online / Offline</h3>
              <p className="big">
                {formatNumber(data.resumo.online)} / {formatNumber(data.resumo.offline)}
              </p>
              <p className="ui-kv" style={{ margin: "6px 0 0" }}>
                Warning: {formatNumber(data.resumo.warning ?? 0)} | Erro: {formatNumber(data.resumo.error ?? 0)}
              </p>
            </article>
            <article className="ui-card ui-dash-card">
              <h3>Páginas no período</h3>
              <p className="big">{formatNumber(data.resumo.paginas_periodo_total)}</p>
            </article>
            <article className="ui-card ui-dash-card">
              <h3>Cobertura da coleta</h3>
              <p className="big">{formatNumber(data.resumo.cobertura_periodo_percentual ?? 0)}%</p>
              <p className="ui-kv" style={{ margin: "6px 0 0" }}>
                Com leitura: {formatNumber(data.resumo.impressoras_com_dados_periodo ?? 0)} | Sem leitura:{" "}
                {formatNumber(data.resumo.impressoras_sem_dados_periodo ?? 0)}
              </p>
            </article>
            <article className="ui-card ui-dash-card">
              <h3>Total acumulado (filtro)</h3>
              <p className="big">{formatNumber(data.resumo.paginas_acumuladas_total_filtro)}</p>
            </article>
            <article className="ui-card ui-dash-card">
              <h3>Total acumulado (geral)</h3>
              <p className="big">{formatNumber(data.resumo.paginas_acumuladas_total_geral)}</p>
            </article>
          </section>

          <section className="ui-card ui-analytics-chart-card" style={{ marginBottom: 12 }}>
            <div className="ui-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Páginas por {agrupamento === "dia" ? "dia" : "mês"}</h3>
              <span className="ui-kv" style={{ margin: 0 }}>
                Faixa histórica válida: {formatDateTime(data.faixa_historica_global.primeira_coleta)} até{" "}
                {formatDateTime(data.faixa_historica_global.ultima_coleta)}
              </span>
            </div>

            {chartPoints.length ? (
              <div className="ui-chart-wrap">
                <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="ui-chart-svg" role="img" aria-label="Páginas por período">
                  <defs>
                    <linearGradient id="dashboardAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(37,99,235,0.45)" />
                      <stop offset="100%" stopColor="rgba(37,99,235,0.02)" />
                    </linearGradient>
                  </defs>

                  {grafico.gridLinesY.map((lineY) => (
                    <line
                      key={`grid-${lineY}`}
                      x1={CHART_PADDING_X}
                      y1={lineY}
                      x2={CHART_WIDTH - CHART_PADDING_X}
                      y2={lineY}
                      className="ui-chart-gridline"
                    />
                  ))}

                  <path d={grafico.areaPath} fill="url(#dashboardAreaGradient)" />
                  <path d={grafico.linePath} className="ui-chart-line" />

                  {chartPoints.map((point) => (
                    <g key={`${point.label}-${point.x}`}>
                      <circle cx={point.x} cy={point.y} r={3.6} className="ui-chart-dot" />
                      <title>{`${point.label}: ${formatNumber(point.value)} páginas`}</title>
                    </g>
                  ))}

                  {grafico.xLabels.map((point) => (
                    <text
                      key={`label-${point.label}-${point.x}`}
                      x={point.x}
                      y={CHART_HEIGHT - 10}
                      className="ui-chart-label"
                      textAnchor="middle"
                    >
                      {point.label}
                    </text>
                  ))}
                </svg>
              </div>
            ) : (
              <p className="ui-kv" style={{ margin: 0 }}>
                Sem dados de páginas para o período selecionado.
              </p>
            )}
          </section>

          <section className="ui-insight-grid" style={{ marginBottom: 12 }}>
            <article className="ui-card">
              <h3 style={{ marginTop: 0 }}>Setores que mais imprimem</h3>
              <div className="ui-mini-bars">
                {data.ranking_setores.map((item) => {
                  const width =
                    maxSetorPaginas > 0
                      ? Math.max(4, Math.round((item.total_paginas / maxSetorPaginas) * 100))
                      : 0;
                  return (
                    <div key={item.setor} className="ui-mini-bar-row">
                      <span className="ui-kv" style={{ margin: 0 }}>
                        {item.setor}
                      </span>
                      <div className="ui-mini-bar-track">
                        <span className="ui-mini-bar-fill" style={{ width: `${width}%` }} />
                      </div>
                      <strong>
                        {formatNumber(item.total_paginas)} ({item.impressoras_ativas})
                      </strong>
                    </div>
                  );
                })}
                {!data.ranking_setores.length ? (
                  <span className="ui-kv" style={{ margin: 0 }}>
                    Sem dados de páginas para ranking de setores.
                  </span>
                ) : null}
              </div>
            </article>

            <article className="ui-card">
              <h3 style={{ marginTop: 0 }}>Localizações que mais imprimem</h3>
              <div className="ui-mini-bars">
                {data.ranking_localizacoes.map((item) => {
                  const width =
                    maxLocalizacaoPaginas > 0
                      ? Math.max(4, Math.round((item.total_paginas / maxLocalizacaoPaginas) * 100))
                      : 0;
                  return (
                    <div key={item.localizacao} className="ui-mini-bar-row">
                      <span className="ui-kv" style={{ margin: 0 }}>
                        {item.localizacao}
                      </span>
                      <div className="ui-mini-bar-track">
                        <span className="ui-mini-bar-fill" style={{ width: `${width}%` }} />
                      </div>
                      <strong>
                        {formatNumber(item.total_paginas)} ({item.impressoras_ativas})
                      </strong>
                    </div>
                  );
                })}
                {!data.ranking_localizacoes.length ? (
                  <span className="ui-kv" style={{ margin: 0 }}>
                    Sem dados de páginas para ranking de localizações.
                  </span>
                ) : null}
              </div>
            </article>
          </section>

          <section className="ui-card" style={{ marginBottom: 12 }}>
            <div className="ui-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Bilhetagem estimada</h3>
              <span className="ui-kv" style={{ margin: 0 }}>
                Custo total estimado: <strong>{formatCurrency(resumoBilhetagemExibicao.totalCusto)}</strong>
              </span>
            </div>

            <div className="ui-analytics-billing-head">
              <label>
                <span className="ui-kv">Custo padrão por página (R$)</span>
                <input
                  type="number"
                  className="ui-field"
                  step="0.0001"
                  min="0"
                  value={custoPadraoPagina}
                  onChange={(event) => {
                    const parsed = parseTarifaNumber(event.target.value);
                    setCustoPadraoPagina(parsed ?? 0);
                  }}
                />
              </label>

              <label>
                <span className="ui-kv">Importar tabela de tarifas (planilha)</span>
                <input
                  type="file"
                  className="ui-field"
                  accept=".xlsx,.xls,.csv,.txt"
                  disabled={importandoTarifas}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    void importarTarifas(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>

              <div style={{ alignSelf: "end" }}>
                <button
                  className="ui-btn"
                  onClick={() => setTarifasPorModelo({})}
                  disabled={!Object.keys(tarifasPorModelo).length}
                >
                  Limpar tarifas manuais
                </button>
              </div>
            </div>

            <div className="ui-row" style={{ marginBottom: 10 }}>
              <span className="ui-kv" style={{ margin: 0 }}>
                Páginas consideradas na bilhetagem: <strong>{formatNumber(resumoBilhetagemExibicao.totalPaginas)}</strong>
              </span>
              <span className="ui-kv" style={{ margin: 0 }}>
                Custo médio por página no cenário atual: <strong>{formatCurrency(resumoBilhetagemExibicao.custoMedioPagina)}</strong>
              </span>
              <span className="ui-kv" style={{ margin: 0 }}>
                Fonte:{" "}
                <strong>
                  {resumoBilhetagemExibicao.fonte === "periodo"
                    ? "coletas do período"
                    : resumoBilhetagemExibicao.fonte === "comparativo"
                      ? "comparativo (base importada)"
                      : "sem dados"}
                </strong>
              </span>
            </div>

            <div className="ui-table-wrap" style={{ border: "none", padding: 0 }}>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Páginas no período</th>
                    <th>Impressoras ativas</th>
                    <th>Tarifa (R$ / página)</th>
                    <th>Custo estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasBilhetagemExibicao.map((item) => (
                    <tr key={item.key}>
                      <td>{item.modelo}</td>
                      <td>{formatNumber(item.total_paginas)}</td>
                      <td>{formatNumber(item.impressoras_ativas)}</td>
                      <td style={{ maxWidth: 160 }}>
                        <input
                          type="number"
                          className="ui-field"
                          min="0"
                          step="0.0001"
                          value={item.tarifa}
                          onChange={(event) => atualizarTarifaModelo(item.key, event.target.value)}
                        />
                      </td>
                      <td>{formatCurrency(item.custo_estimado)}</td>
                    </tr>
                  ))}
                  {!linhasBilhetagemExibicao.length ? (
                    <tr>
                      <td colSpan={5}>Sem dados para estimativa. Rode coleta ou importe a base anterior para usar o comparativo.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="ui-card" style={{ marginBottom: 12 }}>
            <div className="ui-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Comparativo de bilhetagem (anterior x atual)</h3>
              <span className="ui-kv" style={{ margin: 0 }}>
                Última importação da base: {formatDateTime(baseBilhetagem.ultima_importacao_em)}
              </span>
            </div>

            <div className="ui-analytics-billing-head">
              <label>
                <span className="ui-kv">Importar planilha da bilhetagem anterior</span>
                <input
                  type="file"
                  className="ui-field"
                  accept=".xlsx,.xls,.csv,.txt"
                  disabled={importandoBaseBilhetagem}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    void importarBaseBilhetagem(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>

              <div style={{ alignSelf: "end" }}>
                <p className="ui-kv" style={{ margin: 0 }}>
                  Referência detectada mais recente:{" "}
                  <strong>{formatDataReferencia(resumoComparativoBilhetagem.referenciaBaseMaisRecente)}</strong>
                </p>
              </div>

              <div style={{ alignSelf: "end" }}>
                <button
                  className="ui-btn"
                  onClick={() =>
                    setBaseBilhetagem({
                      by_patrimonio: {},
                      by_ip: {},
                      ultima_importacao_em: null,
                    })
                  }
                  disabled={
                    !Object.keys(baseBilhetagem.by_patrimonio).length &&
                    !Object.keys(baseBilhetagem.by_ip).length
                  }
                >
                  Limpar base anterior
                </button>
              </div>
            </div>

            <div className="ui-row" style={{ marginBottom: 10 }}>
              <span className="ui-kv" style={{ margin: 0 }}>
                Impressoras no filtro: <strong>{formatNumber(resumoComparativoBilhetagem.total)}</strong>
              </span>
              <span className="ui-kv" style={{ margin: 0 }}>
                Com base anterior: <strong>{formatNumber(resumoComparativoBilhetagem.comBase)}</strong>
              </span>
              <span className="ui-kv" style={{ margin: 0 }}>
                Sem base: <strong>{formatNumber(resumoComparativoBilhetagem.semBase)}</strong>
              </span>
              <span className="ui-kv" style={{ margin: 0 }}>
                Sem leitura atual: <strong>{formatNumber(resumoComparativoBilhetagem.semLeituraAtual)}</strong>
              </span>
              <span className="ui-kv" style={{ margin: 0 }}>
                Páginas faturáveis (delta):{" "}
                <strong>{formatNumber(resumoComparativoBilhetagem.totalPaginasFaturaveis)}</strong>
              </span>
            </div>

            <div className="ui-table-wrap" style={{ border: "none", padding: 0 }}>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Patrimônio</th>
                    <th>IP</th>
                    <th>Modelo</th>
                    <th>Setor</th>
                    <th>Status</th>
                    <th>Data base</th>
                    <th>Qtde base</th>
                    <th>Contador atual</th>
                    <th>Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasComparativoBilhetagem.map((item) => (
                    <tr key={`cmp-${item.id}`}>
                      <td>{item.patrimonio || "-"}</td>
                      <td>{item.ip || "-"}</td>
                      <td>{item.modelo || "-"}</td>
                      <td>{item.setor || "-"}</td>
                      <td>
                        <span className={`ui-pill ${item.status_atual === "online" ? "ok" : item.status_atual === "offline" ? "danger" : "warn"}`}>
                          {item.status_atual}
                        </span>
                      </td>
                      <td>{formatDataReferencia(item.base_data_envio)}</td>
                      <td>{item.base_quantidade !== null ? formatNumber(item.base_quantidade) : "-"}</td>
                      <td>{item.contador_paginas_atual !== null ? formatNumber(item.contador_paginas_atual) : "-"}</td>
                      <td>
                        {item.delta_paginas !== null ? (
                          <strong>{formatNumber(item.delta_paginas)}</strong>
                        ) : item.sem_base ? (
                          "sem base"
                        ) : (
                          "sem leitura"
                        )}
                        {item.reset_detectado ? " (reset?)" : ""}
                      </td>
                    </tr>
                  ))}
                  {!linhasComparativoBilhetagem.length ? (
                    <tr>
                      <td colSpan={9}>Sem impressoras disponíveis para comparar no filtro atual.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="ui-card" style={{ marginBottom: 12 }}>
            <h3 style={{ marginTop: 0 }}>Suprimentos mais delicados</h3>
            <div className="ui-table-wrap" style={{ border: "none", padding: 0 }}>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Patrimônio</th>
                    <th>Setor</th>
                    <th>Localização</th>
                    <th>Suprimento</th>
                    <th>Nível</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.suprimentos_delicados.map((item) => (
                    <tr key={`${item.patrimonio}-${item.nome_suprimento}`}>
                      <td>{item.patrimonio}</td>
                      <td>{item.setor}</td>
                      <td>{item.localizacao}</td>
                      <td>{item.nome_suprimento}</td>
                      <td>{formatNivel(item.nivel_percentual)}</td>
                      <td>
                        <span
                          className={`ui-pill ${
                            item.nivel_percentual !== null && item.nivel_percentual <= 10
                              ? "danger"
                              : "warn"
                          }`}
                        >
                          {item.status_suprimento}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!data.suprimentos_delicados.length ? (
                    <tr>
                      <td colSpan={6}>Nenhum suprimento baixo/crítico no filtro atual.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          {data.historico_truncado ? (
            <section className="ui-card" style={{ marginBottom: 12 }}>
              <p className="ui-kv" style={{ margin: 0 }}>
                Histórico muito grande para uma única consulta. O resultado foi truncado para manter a tela rápida.
              </p>
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}


