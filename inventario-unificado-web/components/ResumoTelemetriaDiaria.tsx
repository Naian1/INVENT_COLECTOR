/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\components\ResumoTelemetriaDiaria.tsx
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  CircleDollarSign,
  FileText,
  Gauge,
  Layers,
  Palette,
  Printer,
  Tag,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";

type TelemetriaResumoPayload = {
  periodo: {
    dias: number;
    de: string;
    ate: string;
    timezone: string;
    fonte: "consolidado_diario" | "legado_agregado";
  };
  filtros: {
    filtro_setor: string;
    filtro_localizacao: string;
    filtro_modelo: string;
    setores_disponiveis: string[];
    localizacoes_disponiveis: string[];
    modelos_disponiveis: string[];
  };
  totais: {
    inventarios_monitorados: number;
    inventarios_com_coleta_hoje: number;
    inventarios_sem_coleta_hoje: number;
    paginas_hoje: number;
    paginas_periodo: number;
    paginas_contadas_total: number;
    ultima_leitura_geral: string | null;
  };
  bilhetagem: {
    observacao: string;
    tarifas: {
      competencia_mes: number;
      competencia_ano: number;
      empresa_locadora: string;
      valor_pb: number;
      valor_colorida: number;
      fonte_arquivo: string | null;
      origem: "competencia" | "fallback_ativo" | "fallback_padrao";
    };
    custos: {
      paginas_pb: number;
      paginas_coloridas: number;
      custo_pb: number;
      custo_colorida: number;
      custo_total: number;
    };
  };
  serie_paginas_dia: Array<{
    data_ref: string;
    paginas: number;
  }>;
  ranking_modelos_periodo: Array<{
    modelo: string;
    paginas_periodo: number;
    impressoras_ativas: number;
  }>;
  suprimentos_alertas: {
    criticos: number;
    atencao: number;
    ok: number;
    itens: Array<{
      nr_inventario: number;
      patrimonio: string;
      setor: string;
      modelo: string;
      suprimento: string;
      nivel_percentual: number | null;
      status: "critico" | "atencao" | "ok" | "desconhecido";
    }>;
  };
  top_impressoras_hoje: Array<{
    nr_inventario: number;
    patrimonio: string;
    ip: string;
    setor: string;
    modelo: string;
    paginas_dia: number;
    contador_atual: number;
    status: string;
    dt_primeira_leitura_dia: string | null;
    dt_ultima_leitura: string | null;
  }>;
};

type ChartPoint = {
  label: string;
  value: number;
  x: number;
  y: number;
};

const CHART_W = 920;
const CHART_H = 260;
const PAD_X = 36;
const PAD_TOP = 24;
const PAD_BOTTOM = 38;

const numberFormatter = new Intl.NumberFormat("pt-BR");
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

/**
 * [DOC-FUNC] formatNumber
 * O que faz: Normaliza entradas na funcao 'formatNumber', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: value; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
 */
function formatNumber(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return numberFormatter.format(Math.max(0, Math.round(n)));
}

/**
 * [DOC-FUNC] formatCurrency
 * O que faz: Normaliza entradas na funcao 'formatCurrency', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: value; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
 */
function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return currencyFormatter.format(0);
  return currencyFormatter.format(Math.max(0, value));
}

/**
 * [DOC-FUNC] formatDateTime
 * O que faz: Normaliza entradas na funcao 'formatDateTime', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: value; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
 */
function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const raw = String(value).trim();
  if (!raw) return "-";
  const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(raw);
  const dt = new Date(hasTimezone ? raw : `${raw}-03:00`);
  if (!Number.isFinite(dt.getTime())) return "-";
  return dateTimeFormatter.format(dt);
}

/**
 * [DOC-FUNC] formatDateBr
 * O que faz: Normaliza entradas na funcao 'formatDateBr', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: dateKey; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
 */
function formatDateBr(dateKey: string) {
  const m = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateKey;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * [DOC-FUNC] shiftDateKey
 * O que faz: Normaliza entradas na funcao 'shiftDateKey', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: dateKey, days; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
 */
function shiftDateKey(dateKey: string, days: number) {
  const m = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateKey;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00-03:00`);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * [DOC-FUNC] normalizeText
 * O que faz: Normaliza entradas na funcao 'normalizeText', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: value; com validacao de formato e fallback quando necessario.
 * Como executa: Padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
 */
function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * [DOC-FUNC] defaultDateRange
 * O que faz: Executa a responsabilidade principal da funcao 'defaultDateRange' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: sem parametros obrigatorios; com validacao de formato e fallback quando necessario.
 * Como executa: Executa processamento local em sequencia previsivel.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
 */
function defaultDateRange() {
  const end = new Date();
  const start = new Date(end.getTime());
  start.setDate(start.getDate() - 6);
  /**
   * [DOC-FUNC] toIso
   * O que faz: Executa a responsabilidade principal da funcao 'toIso' com fluxo previsivel para estudo.
   * Entradas: Parametros esperados: date; com validacao de formato e fallback quando necessario.
   * Como executa: Padroniza formato e fallback de campos.
   * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
   */
  const toIso = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  return { de: toIso(start), ate: toIso(end) };
}

/**
 * [DOC-FUNC] buildChart
 * O que faz: Monta estrutura/payload na funcao 'buildChart', consolidando dados para a proxima camada.
 * Entradas: Parametros esperados: pointsRaw; com validacao de formato e fallback quando necessario.
 * Como executa: Itera colecoes para montar/filtrar dados; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna estrutura consolidada pronta para API, servico, banco ou interface.
 */
function buildChart(pointsRaw: Array<{ data_ref: string; paginas: number }>) {
  const points = pointsRaw.map((item) => ({
    label: formatDateBr(item.data_ref),
    value: Math.max(0, Number(item.paginas) || 0),
  }));
  const max = Math.max(1, ...points.map((p) => p.value));
  const minY = PAD_TOP;
  const maxY = CHART_H - PAD_BOTTOM;
  const chartW = CHART_W - PAD_X * 2;
  const stepX = points.length > 1 ? chartW / (points.length - 1) : 0;

  const withCoords: ChartPoint[] = points.map((point, index) => {
    // Converte pagina -> coordenada Y (quanto mais paginas, mais alto no grafico).
    const x = PAD_X + stepX * index;
    const y = maxY - (point.value / max) * (maxY - minY);
    return { ...point, x, y };
  });

  const linePath = withCoords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");

  const areaPath = withCoords.length
    ? `${linePath} L${withCoords[withCoords.length - 1].x.toFixed(2)},${maxY.toFixed(2)} L${withCoords[0].x.toFixed(2)},${maxY.toFixed(2)} Z`
    : "";

  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: maxY - (maxY - minY) * ratio,
    value: Math.round(max * ratio),
  }));

  return { points: withCoords, linePath, areaPath, grid };
}

/**
 * [DOC-FUNC] toneFromStatus
 * O que faz: Executa a responsabilidade principal da funcao 'toneFromStatus' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: status; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
 */
function toneFromStatus(status: string) {
  const s = normalizeText(status);
  if (s.includes("crit")) return "danger";
  if (s.includes("aten") || s.includes("warn")) return "warn";
  if (s.includes("ok") || s.includes("on")) return "ok";
  return "neutral";
}

/**
 * [DOC-FUNC] isColorModel
 * O que faz: Avalia condicoes de controle na funcao 'isColorModel' para permitir ou bloquear o proximo passo.
 * Entradas: Parametros esperados: modeloRaw; com validacao de formato e fallback quando necessario.
 * Como executa: Padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna verdadeiro/falso para conduzir o fluxo de negocio de forma segura.
 */
function isColorModel(modeloRaw: string) {
  const modelo = String(modeloRaw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return ["CX622", "CX635", "CX930"].includes(modelo);
}

/**
 * [DOC-FUNC] buildTrend
 * O que faz: Monta estrutura/payload na funcao 'buildTrend', consolidando dados para a proxima camada.
 * Entradas: Parametros esperados: current, previous; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos.
 * Retorno/Efeitos: Retorna estrutura consolidada pronta para API, servico, banco ou interface.
 */
function buildTrend(current: number, previous: number) {
  const cur = Number.isFinite(current) ? current : 0;
  const prev = Number.isFinite(previous) ? previous : 0;
  if (prev <= 0 && cur <= 0) return { direction: "neutral" as const, percent: 0 };
  if (prev <= 0 && cur > 0) return { direction: "up" as const, percent: 100 };

  const delta = ((cur - prev) / prev) * 100;
  if (Math.abs(delta) < 0.01) return { direction: "neutral" as const, percent: 0 };
  return {
    direction: delta > 0 ? ("up" as const) : ("down" as const),
    percent: Math.abs(delta),
  };
}

/**
 * [DOC-FUNC] ResumoTelemetriaDiaria
 * O que faz: Consulta e organiza informacoes na funcao 'ResumoTelemetriaDiaria' para retorno confiavel.
 * Entradas: Parametros esperados: sem parametros obrigatorios; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; itera colecoes para montar/filtrar dados; consulta dados em fonte interna/externa; padroniza formato e fallback de campos; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
 */
export function ResumoTelemetriaDiaria() {
  const initialRange = useMemo(defaultDateRange, []);
  const [de, setDe] = useState(initialRange.de);
  const [ate, setAte] = useState(initialRange.ate);
  const [setor, setSetor] = useState("");
  const [modelo, setModelo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showAllSupplies, setShowAllSupplies] = useState(false);
  const [showAllTopPrinters, setShowAllTopPrinters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<TelemetriaResumoPayload | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setPayload(null);
        setError("Sessao invalida. Faca login novamente.");
        return;
      }

      const params = new URLSearchParams();
      params.set("de", de);
      params.set("ate", ate);
      if (setor) params.set("setor", setor);
      if (modelo) params.set("modelo", modelo);

      const response = await fetch(`/api/telemetria/resumo-diario?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok || !body?.sucesso) {
        throw new Error(String(body?.erro || "Falha ao carregar dashboard."));
      }
      setPayload(body.dados as TelemetriaResumoPayload);
    } catch (err) {
      setPayload(null);
      setError(err instanceof Error ? err.message : "Falha ao carregar dashboard.");
    } finally {
      setLoading(false);
    }
  }, [ate, de, modelo, setor]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const chart = useMemo(() => buildChart(payload?.serie_paginas_dia || []), [payload?.serie_paginas_dia]);

  const paginasHoje = payload?.totais.paginas_hoje ?? 0;
  const paginasPeriodo = payload?.totais.paginas_periodo ?? 0;
  const tarifaPb = Number(payload?.bilhetagem.tarifas.valor_pb ?? 0);
  const tarifaColor = Number(payload?.bilhetagem.tarifas.valor_colorida ?? 0);
  const custoTotalPeriodo = Number(payload?.bilhetagem.custos.custo_total ?? 0);
  const equipamentos = payload?.totais.inventarios_monitorados ?? 0;
  const online = payload?.totais.inventarios_com_coleta_hoje ?? 0;
  const semColeta = payload?.totais.inventarios_sem_coleta_hoje ?? 0;
  const alertas = (payload?.suprimentos_alertas.criticos ?? 0) + (payload?.suprimentos_alertas.atencao ?? 0);
  const paginasMes = useMemo(() => {
    if (!payload) return 0;
    const refMes = String(payload.periodo.ate || "").slice(0, 7);
    return payload.serie_paginas_dia
      .filter((item) => item.data_ref.startsWith(refMes))
      .reduce((acc, item) => acc + (Number(item.paginas) || 0), 0);
  }, [payload]);

  const custoPorModelo = useMemo(
    () =>
      (payload?.ranking_modelos_periodo || []).map((item) => ({
        ...item,
        // Estimativa de custo usando a categoria do modelo (pb x colorida).
        custo_estimado: item.paginas_periodo * (isColorModel(item.modelo) ? tarifaColor : tarifaPb),
        tipo_impressao: isColorModel(item.modelo) ? "colorida" : "pb",
      })),
    [payload?.ranking_modelos_periodo, tarifaColor, tarifaPb],
  );
  const custoPorCategoriaModelo = useMemo(
    () => [...custoPorModelo].sort((a, b) => b.custo_estimado - a.custo_estimado),
    [custoPorModelo],
  );

  const suprimentosVisiveis = useMemo(() => {
    const list = payload?.suprimentos_alertas.itens || [];
    return showAllSupplies ? list : list.slice(0, 5);
  }, [payload?.suprimentos_alertas.itens, showAllSupplies]);

  const topImpressorasVisiveis = useMemo(() => {
    const list = payload?.top_impressoras_hoje || [];
    return showAllTopPrinters ? list : list.slice(0, 5);
  }, [payload?.top_impressoras_hoje, showAllTopPrinters]);

  const pagesPb = Number(payload?.bilhetagem.custos.paginas_pb ?? 0);
  const pagesColor = Number(payload?.bilhetagem.custos.paginas_coloridas ?? 0);
  const custoPb = Number(payload?.bilhetagem.custos.custo_pb ?? 0);
  const custoColor = Number(payload?.bilhetagem.custos.custo_colorida ?? 0);
  const paginasContadasTotal = Number(payload?.totais.paginas_contadas_total ?? 0);
  const custoMedioPagina = paginasPeriodo > 0 ? custoTotalPeriodo / paginasPeriodo : 0;
  const taxaUtilizacao = equipamentos > 0 ? (online / equipamentos) * 100 : 0;
  const seriePorDia = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of payload?.serie_paginas_dia || []) {
      map.set(item.data_ref, Number(item.paginas) || 0);
    }
    return map;
  }, [payload?.serie_paginas_dia]);

  const paginaAteRef = payload?.periodo.ate || "";
  const paginaOntemRef = paginaAteRef ? shiftDateKey(paginaAteRef, -1) : "";
  const paginasOntem = paginaOntemRef ? Number(seriePorDia.get(paginaOntemRef) || 0) : 0;

  const paginaMesRef = String(payload?.periodo.ate || "").slice(0, 7);
  const paginasMesAnterior = useMemo(() => {
    if (!paginaMesRef) return 0;
    const match = paginaMesRef.match(/^(\d{4})-(\d{2})$/);
    if (!match) return 0;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return 0;
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() - 1);
    const prevKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return (payload?.serie_paginas_dia || [])
      .filter((item) => item.data_ref.startsWith(prevKey))
      .reduce((acc, item) => acc + (Number(item.paginas) || 0), 0);
  }, [paginaMesRef, payload?.serie_paginas_dia]);

  const custoHojeEstimado = paginasHoje * custoMedioPagina;
  const custoOntemEstimado = paginasOntem * custoMedioPagina;
  // Tendencia compara "dia atual x dia anterior" e "mes atual x mes anterior".
  const trendPaginasHoje = buildTrend(paginasHoje, paginasOntem);
  const trendPaginasMes = buildTrend(paginasMes, paginasMesAnterior);
  const trendCustoHoje = buildTrend(custoHojeEstimado, custoOntemEstimado);

  return (
    <section className="opsdash-shell">
      <header className="opsdash-header">
        <div>
          <h2 className="opsdash-title">Operacao de Impressoras</h2>
          <p className="opsdash-subtitle">Visao geral de impressao, suprimentos SNMP e bilhetagem por modelo.</p>
          <div className="opsdash-header-meta">
            <span className={online > 0 ? "opsdash-pill opsdash-pill-ok" : "opsdash-pill opsdash-pill-warn"}>
              {online > 0 ? "Sistema online" : "Sem coleta"}
            </span>
          </div>
        </div>
        <div className="opsdash-header-actions">
          <div className="opsdash-date-row">
            <input className="opsdash-input" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
            <span className="opsdash-sep">ate</span>
            <input className="opsdash-input" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          <button className="opsdash-btn" type="button" onClick={() => setShowFilters((v) => !v)}>
            Filtros
          </button>
          <button className="opsdash-btn opsdash-btn-primary" type="button" onClick={() => void carregar()} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </header>

      {showFilters ? (
        <div className="opsdash-filters">
          <label className="opsdash-field">
            <span>Setor</span>
            <select className="opsdash-input" value={setor} onChange={(e) => setSetor(e.target.value)}>
              <option value="">Todos</option>
              {(payload?.filtros.setores_disponiveis || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="opsdash-field">
            <span>Modelo</span>
            <select className="opsdash-input" value={modelo} onChange={(e) => setModelo(e.target.value)}>
              <option value="">Todos</option>
              {(payload?.filtros.modelos_disponiveis || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="opsdash-field">
            <span>Tarifa P&amp;B (competencia)</span>
            <input className="opsdash-input" type="text" value={formatCurrency(tarifaPb)} readOnly />
          </label>
          <label className="opsdash-field">
            <span>Tarifa Colorida (competencia)</span>
            <input className="opsdash-input" type="text" value={formatCurrency(tarifaColor)} readOnly />
          </label>
          <div className="opsdash-status">
            <span className={online > 0 ? "opsdash-pill opsdash-pill-ok" : "opsdash-pill opsdash-pill-warn"}>
              {online > 0 ? "Sistema online" : "Sem coleta"}
            </span>
            <small>
              Ultima leitura: <strong>{formatDateTime(payload?.totais.ultima_leitura_geral)}</strong>
            </small>
            <small>
              Competencia:{" "}
              <strong>
                {String(payload?.bilhetagem.tarifas.competencia_mes || 0).padStart(2, "0")}/
                {payload?.bilhetagem.tarifas.competencia_ano || "-"}
              </strong>
            </small>
          </div>
        </div>
      ) : null}

      {error ? <div className="opsdash-error">{error}</div> : null}

      <section className="opsdash-kpi-grid">
        <article className="opsdash-kpi-card">
          <div className="opsdash-kpi-head">
            <span className="opsdash-kpi-icon opsdash-kpi-icon-blue">
              <FileText size={18} />
            </span>
            <p>PAGINAS HOJE</p>
          </div>
          <h3>{formatNumber(paginasHoje)}</h3>
          <small className="opsdash-trend-row">
            <span>vs ontem</span>
            <span className={`opsdash-trend opsdash-trend-${trendPaginasHoje.direction}`}>
              {trendPaginasHoje.direction === "up" ? <ArrowUpRight size={14} /> : null}
              {trendPaginasHoje.direction === "down" ? <ArrowDownRight size={14} /> : null}
              {trendPaginasHoje.direction === "neutral" ? "-" : `${trendPaginasHoje.percent.toFixed(1).replace(".", ",")}%`}
            </span>
          </small>
        </article>
        <article className="opsdash-kpi-card">
          <div className="opsdash-kpi-head">
            <span className="opsdash-kpi-icon opsdash-kpi-icon-purple">
              <CalendarDays size={18} />
            </span>
            <p>PAGINAS ESTE MES</p>
          </div>
          <h3>{formatNumber(paginasMes)}</h3>
          <small className="opsdash-trend-row">
            <span>vs mes anterior</span>
            <span className={`opsdash-trend opsdash-trend-${trendPaginasMes.direction}`}>
              {trendPaginasMes.direction === "up" ? <ArrowUpRight size={14} /> : null}
              {trendPaginasMes.direction === "down" ? <ArrowDownRight size={14} /> : null}
              {trendPaginasMes.direction === "neutral" ? "-" : `${trendPaginasMes.percent.toFixed(1).replace(".", ",")}%`}
            </span>
          </small>
        </article>
        <article className="opsdash-kpi-card">
          <div className="opsdash-kpi-head">
            <span className="opsdash-kpi-icon opsdash-kpi-icon-green">
              <CircleDollarSign size={18} />
            </span>
            <p>CUSTO TOTAL HOJE</p>
          </div>
          <h3>{formatCurrency(custoHojeEstimado)}</h3>
          <small className="opsdash-trend-row">
            <span>vs ontem</span>
            <span className={`opsdash-trend opsdash-trend-${trendCustoHoje.direction}`}>
              {trendCustoHoje.direction === "up" ? <ArrowUpRight size={14} /> : null}
              {trendCustoHoje.direction === "down" ? <ArrowDownRight size={14} /> : null}
              {trendCustoHoje.direction === "neutral" ? "-" : `${trendCustoHoje.percent.toFixed(1).replace(".", ",")}%`}
            </span>
          </small>
        </article>
        <article className="opsdash-kpi-card">
          <div className="opsdash-kpi-head">
            <span className="opsdash-kpi-icon opsdash-kpi-icon-amber">
              <Tag size={18} />
            </span>
            <p>CUSTO POR PAGINA</p>
          </div>
          <h3>{formatCurrency(tarifaPb)}</h3>
          <small>P&amp;B {formatCurrency(tarifaPb)} | Colorida {formatCurrency(tarifaColor)}</small>
        </article>
        <article className="opsdash-kpi-card">
          <div className="opsdash-kpi-head">
            <span className="opsdash-kpi-icon opsdash-kpi-icon-cyan">
              <Printer size={18} />
            </span>
            <p>EQUIPAMENTOS</p>
          </div>
          <h3>{formatNumber(equipamentos)}</h3>
          <small className="opsdash-kpi-split">
            <span className="opsdash-ok-text">{formatNumber(online)} com producao</span>
            <span className="opsdash-danger-text">{formatNumber(semColeta)} sem producao</span>
          </small>
        </article>
        <article className="opsdash-kpi-card">
          <div className="opsdash-kpi-head">
            <span className="opsdash-kpi-icon opsdash-kpi-icon-red">
              <Bell size={18} />
            </span>
            <p>ALERTAS SUPRIMENTOS</p>
          </div>
          <h3>{formatNumber(alertas)}</h3>
          <small className="opsdash-kpi-split">
            <span className="opsdash-danger-text">{formatNumber(payload?.suprimentos_alertas.criticos ?? 0)} critico</span>
            <span className="opsdash-warn-text">{formatNumber(payload?.suprimentos_alertas.atencao ?? 0)} atencao</span>
          </small>
        </article>
      </section>

      <section className="opsdash-main-grid">
        <article className="opsdash-panel opsdash-panel-chart">
          <header className="opsdash-panel-header">
            <h3>Volume de impressao (paginas)</h3>
            <span className="opsdash-pill">{payload?.periodo.dias || 0} dias</span>
          </header>
          {!chart.points.length ? (
            <p className="opsdash-empty">Sem dados para o periodo.</p>
          ) : (
            <div className="opsdash-chart-wrap">
              <svg className="opsdash-chart" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label="Paginas por dia">
                <defs>
                  <linearGradient id="opsdashArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(56,189,248,0.35)" />
                    <stop offset="100%" stopColor="rgba(37,99,235,0.02)" />
                  </linearGradient>
                </defs>
                {chart.grid.map((grid) => (
                  <g key={grid.y}>
                    <line x1={PAD_X} x2={CHART_W - PAD_X} y1={grid.y} y2={grid.y} className="opsdash-gridline" />
                    <text x={6} y={grid.y + 4} className="opsdash-gridlabel">
                      {formatNumber(grid.value)}
                    </text>
                  </g>
                ))}
                {chart.areaPath ? <path d={chart.areaPath} fill="url(#opsdashArea)" /> : null}
                {chart.linePath ? <path d={chart.linePath} className="opsdash-line" /> : null}
                {chart.points.map((point) => (
                  <g key={`${point.label}-${point.x}`}>
                    <circle cx={point.x} cy={point.y} r={4} className="opsdash-dot" />
                    <text x={point.x} y={CHART_H - 12} textAnchor="middle" className="opsdash-axislabel">
                      {point.label}
                    </text>
                    <text x={point.x} y={point.y - 10} textAnchor="middle" className="opsdash-pointlabel">
                      {formatNumber(point.value)}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          )}
        </article>

        <article className="opsdash-panel">
          <header className="opsdash-panel-header">
            <div className="opsdash-panel-title">
              <span className="opsdash-panel-icon opsdash-kpi-icon-cyan">
                <BarChart3 size={16} />
              </span>
              <h3>Custo por categoria (modelo)</h3>
            </div>
            <span className="opsdash-pill">Somente impressoras laser</span>
          </header>
          <div className="opsdash-table-wrap">
            <table className="opsdash-table">
              <thead>
                <tr>
                  <th>Categoria (modelo)</th>
                  <th>Paginas</th>
                  <th>Tarifa atual</th>
                  <th>Valor atual</th>
                </tr>
              </thead>
              <tbody>
                {custoPorCategoriaModelo.length ? (
                  custoPorCategoriaModelo.map((item) => (
                    <tr key={item.modelo}>
                      <td>
                        <strong>{item.modelo}</strong>
                      </td>
                      <td>{formatNumber(item.paginas_periodo)}</td>
                      <td>{formatCurrency(item.tipo_impressao === "colorida" ? tarifaColor : tarifaPb)}</td>
                      <td>
                        <strong>{formatCurrency(item.custo_estimado)}</strong>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>Sem dados por modelo no periodo.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="opsdash-bill-grid">
        <article className="opsdash-panel">
          <header className="opsdash-panel-header">
            <div className="opsdash-panel-title">
              <span className="opsdash-panel-icon opsdash-kpi-icon-amber">
                <Tag size={16} />
              </span>
              <h3>Custo por pagina (bilhetagem)</h3>
            </div>
          </header>
          <div className="opsdash-bill-duo">
            <div className="opsdash-bill-card">
              <div className="opsdash-bill-card-head">
                <span className="opsdash-mini-icon opsdash-kpi-icon-blue">
                  <FileText size={13} />
                </span>
                <p>Paginas preto e branco</p>
              </div>
              <strong>{formatNumber(pagesPb)}</strong>
              <small>{formatCurrency(tarifaPb)} por pagina</small>
              <small>Custo: {formatCurrency(custoPb)}</small>
            </div>
            <div className="opsdash-bill-card">
              <div className="opsdash-bill-card-head">
                <span className="opsdash-mini-icon opsdash-kpi-icon-purple">
                  <Palette size={13} />
                </span>
                <p>Paginas coloridas</p>
              </div>
              <strong>{formatNumber(pagesColor)}</strong>
              <small>{formatCurrency(tarifaColor)} por pagina</small>
              <small>Custo: {formatCurrency(custoColor)}</small>
            </div>
          </div>
        </article>
        <article className="opsdash-panel opsdash-metric-card">
          <div className="opsdash-metric-head">
            <span className="opsdash-kpi-icon opsdash-kpi-icon-green">
              <CircleDollarSign size={13} />
            </span>
            <p>Total de gastos previstos</p>
          </div>
          <strong>{formatCurrency(custoTotalPeriodo)}</strong>
          <small>Periodo selecionado</small>
        </article>
        <article className="opsdash-panel opsdash-metric-card">
          <div className="opsdash-metric-head">
            <span className="opsdash-kpi-icon opsdash-kpi-icon-blue">
              <FileText size={13} />
            </span>
            <p>Paginas totais</p>
          </div>
          <strong>{formatNumber(paginasPeriodo)}</strong>
          <small>Paginas impressas</small>
        </article>
        <article className="opsdash-panel opsdash-metric-card">
          <div className="opsdash-metric-head">
            <span className="opsdash-kpi-icon opsdash-kpi-icon-cyan">
              <Layers size={13} />
            </span>
            <p>Historico geral de impressao</p>
          </div>
          <strong>{formatNumber(paginasContadasTotal)}</strong>
          <small>Somatoria atual de contadores</small>
        </article>
        <article className="opsdash-panel opsdash-metric-card">
          <div className="opsdash-metric-head">
            <span className="opsdash-kpi-icon opsdash-kpi-icon-amber">
              <Tag size={13} />
            </span>
            <p>Custo medio por pagina</p>
          </div>
          <strong>{formatCurrency(custoMedioPagina)}</strong>
          <small>Considerando P&amp;B e color</small>
        </article>
        <article className="opsdash-panel opsdash-metric-card">
          <div className="opsdash-metric-head">
            <span className="opsdash-kpi-icon opsdash-kpi-icon-green">
              <Gauge size={13} />
            </span>
            <p>Taxa de utilizacao</p>
          </div>
          <strong>{Number.isFinite(taxaUtilizacao) ? `${taxaUtilizacao.toFixed(1).replace(".", ",")}%` : "0,0%"}</strong>
          <small>{formatNumber(online)} de {formatNumber(equipamentos)} equipamentos</small>
        </article>
      </section>

      <section className="opsdash-main-grid">
        <article className="opsdash-panel">
          <header className="opsdash-panel-header">
            <h3>Suprimentos (SNMP)</h3>
            <div className="opsdash-inline-counters">
              <span className="opsdash-pill opsdash-pill-danger">{payload?.suprimentos_alertas.criticos ?? 0} critico</span>
              <span className="opsdash-pill opsdash-pill-warn">{payload?.suprimentos_alertas.atencao ?? 0} atencao</span>
              <span className="opsdash-pill opsdash-pill-ok">{payload?.suprimentos_alertas.ok ?? 0} ok</span>
            </div>
          </header>
          <div className="opsdash-table-wrap">
            <table className="opsdash-table">
              <thead>
                <tr>
                  <th>Patrimonio</th>
                  <th>Modelo / Local</th>
                  <th>Suprimento</th>
                  <th>Nivel</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {suprimentosVisiveis.length ? (
                  suprimentosVisiveis.map((item) => {
                    const tone = toneFromStatus(item.status);
                    const levelRaw = Number(item.nivel_percentual ?? 0);
                    const level = Number.isFinite(levelRaw) ? Math.max(0, Math.min(100, levelRaw)) : 0;
                    return (
                      <tr key={`${item.nr_inventario}-${item.suprimento}`}>
                      <td>{item.patrimonio}</td>
                      <td>
                        <div className="opsdash-supply-equip">
                          <strong>{item.modelo}</strong>
                          <span>{item.setor || "-"}</span>
                        </div>
                      </td>
                      <td>{item.suprimento}</td>
                      <td>
                        <div className="opsdash-supply-level-cell">
                          <span className={`opsdash-supply-level-value opsdash-supply-level-value-${tone}`}>
                            {item.nivel_percentual === null ? "-" : `${item.nivel_percentual}%`}
                          </span>
                          <div className="opsdash-supply-level-track" aria-hidden="true">
                            <span className={`opsdash-supply-level-fill opsdash-supply-level-fill-${tone}`} style={{ width: `${level}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`opsdash-pill opsdash-pill-${toneFromStatus(item.status)}`}>{item.status}</span>
                      </td>
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5}>Sem alertas de suprimentos no periodo.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {(payload?.suprimentos_alertas.itens.length || 0) > 5 ? (
            <div className="opsdash-panel-actions">
              <button className="opsdash-link-btn" type="button" onClick={() => setShowAllSupplies((v) => !v)}>
                {showAllSupplies ? "Mostrar apenas 5" : "Ver todos os suprimentos"}
              </button>
            </div>
          ) : null}
        </article>

        <article className="opsdash-panel">
          <header className="opsdash-panel-header">
            <h3>Top impressoras (paginas no dia final)</h3>
            <span className="opsdash-pill">{formatDateBr(payload?.periodo.ate || "-")}</span>
          </header>
          <div className="opsdash-top-list">
            {topImpressorasVisiveis.length ? (
              topImpressorasVisiveis.map((item) => {
                const max = Math.max(
                  1,
                  ...topImpressorasVisiveis.map((entry) => Number(entry.paginas_dia) || 0),
                );
                const width = Math.max(2, Math.round(((Number(item.paginas_dia) || 0) / max) * 100));
                return (
                  <div key={`${item.nr_inventario}-${item.patrimonio}`} className="opsdash-top-row">
                    <div className="opsdash-top-text">
                      <strong>{item.modelo}</strong> - {item.setor}
                      <small className="opsdash-top-meta">
                        Inicio: {formatDateTime(item.dt_primeira_leitura_dia)} | Ultima: {formatDateTime(item.dt_ultima_leitura)}
                      </small>
                    </div>
                    <div className="opsdash-top-bar">
                      <span style={{ width: `${width}%` }} />
                    </div>
                    <div className="opsdash-top-value">{formatNumber(item.paginas_dia)}</div>
                  </div>
                );
              })
            ) : (
              <p className="opsdash-empty">Sem leituras no dia final do periodo.</p>
            )}
          </div>
          {(payload?.top_impressoras_hoje.length || 0) > 5 ? (
            <div className="opsdash-panel-actions">
              <button className="opsdash-link-btn" type="button" onClick={() => setShowAllTopPrinters((v) => !v)}>
                {showAllTopPrinters ? "Mostrar apenas top 5" : "Ver ranking completo"}
              </button>
            </div>
          ) : null}
          <div className="opsdash-footnote">
            Alertas de suprimentos: <strong>{alertas}</strong> | Ultima leitura geral:{" "}
            <strong>{formatDateTime(payload?.totais.ultima_leitura_geral)}</strong>
          </div>
          <div className="opsdash-footnote">
            {payload?.bilhetagem.observacao || "Valores calculados conforme bilhetagem enviada pela locadora."}
          </div>
        </article>
      </section>
    </section>
  );
}

