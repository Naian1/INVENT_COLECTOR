/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\telemetriaDiariaService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";

type DailyRow = {
  nr_inventario: number;
  dt_referencia: string;
  nr_paginas_inicio_dia: number;
  nr_paginas_fim_dia: number;
  nr_paginas_dia: number;
  dt_primeira_leitura: string | null;
  dt_ultima_leitura: string | null;
  ds_status_ultima: string | null;
};

type LegacyRow = {
  nr_inventario: number;
  nr_paginas_total: number | null;
  dt_leitura: string | null;
  ds_status_impressora: string | null;
};

type InventarioRow = {
  nr_inventario: number;
  nr_patrimonio: string | null;
  nr_ip: string | null;
  cd_setor: number | null;
  cd_equipamento: number | null;
  ie_situacao?: string | null;
};

type SetorRow = {
  cd_setor: number;
  nm_setor: string | null;
  ds_setor: string | null;
};

type EquipamentoRow = {
  cd_equipamento: number;
  nm_modelo: string | null;
  cd_tipo_equipamento?: number | null;
  ie_situacao?: string | null;
};

type TipoEquipamentoRow = {
  cd_tipo_equipamento: number;
  nm_tipo_equipamento: string | null;
};

type SuprimentoRow = {
  nr_inventario: number;
  tp_suprimento: string | null;
  nr_quantidade: number | null;
  ds_suprimento: string | null;
  ie_situacao: string | null;
};

type TarifaBilhetagemRow = {
  id: number;
  competencia_mes: number;
  competencia_ano: number;
  empresa_locadora: string;
  tipo_impressao: string;
  valor_pagina: number;
  fonte_arquivo: string | null;
  ativo: boolean;
  updated_at: string | null;
};

type DailyAggregate = {
  nr_inventario: number;
  dt_referencia: string;
  nr_paginas_inicio_dia: number;
  nr_paginas_fim_dia: number;
  nr_paginas_total: number;
  dt_primeira_leitura: string | null;
  dt_leitura: string | null;
  ds_status_impressora: string;
};

type MetaInventario = {
  patrimonio: string;
  ip: string;
  setor: string;
  modelo: string;
};

type TelemetriaResumo = {
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

const SAO_PAULO_TZ = "America/Sao_Paulo";
const SEM_COLETA_TIMEOUT_MINUTES = 30;
const MODELOS_COLORIDOS = new Set(["CX622", "CX635", "CX930"]);
const SP_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: SAO_PAULO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function normalizeTimestamp(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(raw);
  return hasTimezone ? raw : `${raw}-03:00`;
}

function normalizeCompare(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function clampDays(value: number) {
  if (!Number.isFinite(value)) return 30;
  return Math.max(1, Math.min(120, Math.trunc(value)));
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function toDateKeySaoPaulo(input: string | Date) {
  const normalizedInput =
    input instanceof Date ? input : (normalizeTimestamp(String(input)) ?? String(input));
  const date = normalizedInput instanceof Date ? normalizedInput : new Date(normalizedInput);
  if (!Number.isFinite(date.getTime())) return SP_FORMATTER.format(new Date());
  return SP_FORMATTER.format(date);
}

function parseDateKeyInput(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const exact = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (exact) return `${exact[1]}-${exact[2]}-${exact[3]}`;
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return null;
  return toDateKeySaoPaulo(parsed);
}

function dateKeyToUtcStartMs(dateKey: string) {
  return new Date(`${dateKey}T00:00:00-03:00`).getTime();
}

function daysBetweenInclusive(dateFrom: string, dateTo: string) {
  const fromMs = dateKeyToUtcStartMs(dateFrom);
  const toMs = dateKeyToUtcStartMs(dateTo);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) return null;
  return Math.floor((toMs - fromMs) / 86400000) + 1;
}

function toIsoStartFromDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00-03:00`).toISOString();
}

function toIsoEndFromDateKey(dateKey: string) {
  return new Date(`${dateKey}T23:59:59.999-03:00`).toISOString();
}

function normalizeStatus(value: string | null | undefined) {
  const status = String(value || "").trim().toLowerCase();
  if (!status) return "unknown";
  if (["online", "offline", "warning", "error", "unknown"].includes(status)) return status;
  return "unknown";
}

function minutesFromNow(value: string | null | undefined) {
  const normalized = normalizeTimestamp(value);
  if (!normalized) return null;
  const timestamp = new Date(normalized).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return (Date.now() - timestamp) / 60000;
}

function hasRecentSnmpCollection(statusRaw: string | null | undefined, dtLeitura: string | null | undefined) {
  const status = normalizeStatus(statusRaw);
  if (!["online", "warning"].includes(status)) return false;
  const minutes = minutesFromNow(dtLeitura);
  if (minutes === null) return false;
  return minutes <= SEM_COLETA_TIMEOUT_MINUTES;
}

function isColorModel(modeloRaw: string | null | undefined) {
  const modelo = String(modeloRaw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return MODELOS_COLORIDOS.has(modelo);
}

function isMissingColumnError(message: string) {
  return /column .* does not exist/i.test(message) || /Could not find the .* column/i.test(message);
}

function dailyPages(row: DailyAggregate) {
  const inicio = toNumber(row.nr_paginas_inicio_dia, 0);
  const fim = toNumber(row.nr_paginas_fim_dia, toNumber(row.nr_paginas_total, 0));
  return Math.max(0, fim - inicio);
}

function classificarSuprimento(
  statusRaw: string | null | undefined,
  nivelRaw: number | null | undefined,
): "critico" | "atencao" | "ok" | "desconhecido" {
  const status = normalizeCompare(statusRaw);
  const nivel = Number.isFinite(Number(nivelRaw)) ? Number(nivelRaw) : null;

  if (status.includes("crit") || status.includes("erro") || status.includes("error") || status.includes("empty")) {
    return "critico";
  }
  if (status.includes("low") || status.includes("warn") || status.includes("aten")) {
    return "atencao";
  }
  if (status.includes("ok") || status.includes("normal") || status.includes("bom")) {
    return "ok";
  }
  if (nivel !== null) {
    if (nivel <= 10) return "critico";
    if (nivel <= 25) return "atencao";
    return "ok";
  }
  return "desconhecido";
}

function isMissingTableError(message: string) {
  return /relation .* does not exist/i.test(message) || /Could not find the table/i.test(message);
}

function parseMonthYearFromDateKey(dateKey: string) {
  const m = String(dateKey).match(/^(\d{4})-(\d{2})-/);
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (!Number.isFinite(ano) || !Number.isFinite(mes)) return null;
  return { mes, ano };
}

function normalizeTipoImpressao(value: string | null | undefined) {
  const raw = normalizeCompare(value);
  if (raw === "pb" || raw === "mono" || raw === "monocromatica" || raw === "pretoebranco") return "pb";
  if (raw === "colorida" || raw === "color" || raw === "cor") return "colorida";
  return "";
}

function chooseTarifasFromRows(
  rows: TarifaBilhetagemRow[],
  fallbackCompetencia: { mes: number; ano: number },
  origem: "competencia" | "fallback_ativo",
) {
  if (!rows.length) return null;
  const byEmpresa = new Map<string, TarifaBilhetagemRow[]>();
  for (const row of rows) {
    const empresa = String(row.empresa_locadora || "").trim() || "LOCADORA";
    if (!byEmpresa.has(empresa)) byEmpresa.set(empresa, []);
    (byEmpresa.get(empresa) as TarifaBilhetagemRow[]).push(row);
  }

  let selectedEmpresa = "";
  let selectedRows: TarifaBilhetagemRow[] = [];
  // Preferimos uma locadora que tenha as duas modalidades (pb e colorida)
  // para evitar custo parcial no dashboard.
  for (const [empresa, empresaRows] of byEmpresa.entries()) {
    const hasPb = empresaRows.some((row) => normalizeTipoImpressao(row.tipo_impressao) === "pb");
    const hasColor = empresaRows.some((row) => normalizeTipoImpressao(row.tipo_impressao) === "colorida");
    if (hasPb && hasColor) {
      selectedEmpresa = empresa;
      selectedRows = empresaRows;
      break;
    }
  }
  if (!selectedRows.length) {
    const first = byEmpresa.entries().next().value as [string, TarifaBilhetagemRow[]] | undefined;
    if (first) {
      selectedEmpresa = first[0];
      selectedRows = first[1];
    }
  }
  if (!selectedRows.length) return null;

  let valorPb = 0;
  let valorColor = 0;
  let fonte: string | null = null;
  let competenciaMes = fallbackCompetencia.mes;
  let competenciaAno = fallbackCompetencia.ano;

  for (const row of selectedRows) {
    const tipo = normalizeTipoImpressao(row.tipo_impressao);
    if (tipo === "pb") valorPb = Number(row.valor_pagina) || 0;
    if (tipo === "colorida") valorColor = Number(row.valor_pagina) || 0;
    if (!fonte && row.fonte_arquivo) fonte = row.fonte_arquivo;
    if (row.competencia_mes) competenciaMes = Number(row.competencia_mes);
    if (row.competencia_ano) competenciaAno = Number(row.competencia_ano);
  }

  return {
    competencia_mes: competenciaMes,
    competencia_ano: competenciaAno,
    empresa_locadora: selectedEmpresa || "LOCADORA",
    valor_pb: Math.max(0, valorPb),
    valor_colorida: Math.max(0, valorColor),
    fonte_arquivo: fonte,
    origem,
  } as const;
}

async function loadTarifasBilhetagem(dateKeyFimPeriodo: string) {
  const competencia = parseMonthYearFromDateKey(dateKeyFimPeriodo);
  const fallbackComp = competencia ?? { mes: new Date().getMonth() + 1, ano: new Date().getFullYear() };
  const supabase = getSupabaseServerClient();

  if (competencia) {
    // Caminho principal: busca por competencia do periodo selecionado.
    const { data, error } = await supabase
      .from("tarifas_bilhetagem")
      .select("id,competencia_mes,competencia_ano,empresa_locadora,tipo_impressao,valor_pagina,fonte_arquivo,ativo,updated_at")
      .eq("ativo", true)
      .eq("competencia_mes", competencia.mes)
      .eq("competencia_ano", competencia.ano)
      .order("updated_at", { ascending: false })
      .returns<TarifaBilhetagemRow[]>();

    if (!error && data?.length) {
      const match = chooseTarifasFromRows(data, fallbackComp, "competencia");
      if (match) return match;
    } else if (error && !isMissingTableError(String(error.message || ""))) {
      throw new Error(`Falha ao carregar tarifas por competencia: ${error.message}`);
    }
  }

  const { data: ativos, error: ativosError } = await supabase
    .from("tarifas_bilhetagem")
    .select("id,competencia_mes,competencia_ano,empresa_locadora,tipo_impressao,valor_pagina,fonte_arquivo,ativo,updated_at")
    .eq("ativo", true)
    .order("updated_at", { ascending: false })
    .limit(100)
    .returns<TarifaBilhetagemRow[]>();

  if (!ativosError && ativos?.length) {
    // Fallback operacional: usa ultimo conjunto ativo quando a competencia ainda nao foi cadastrada.
    const match = chooseTarifasFromRows(ativos, fallbackComp, "fallback_ativo");
    if (match) return match;
  } else if (ativosError && !isMissingTableError(String(ativosError.message || ""))) {
    throw new Error(`Falha ao carregar tarifas ativas: ${ativosError.message}`);
  }

  return {
    competencia_mes: fallbackComp.mes,
    competencia_ano: fallbackComp.ano,
    empresa_locadora: "ARKLOK",
    valor_pb: 0.04,
    valor_colorida: 0.35,
    fonte_arquivo: null,
    origem: "fallback_padrao" as const,
  };
}

async function loadDailyRows(
  dateFrom: string,
  dateTo: string,
): Promise<{ source: "consolidado_diario"; rows: DailyAggregate[] } | { source: "legado_agregado"; rows: DailyAggregate[] }> {
  const supabase = getSupabaseServerClient();

  const tentativaConsolidado = await supabase
    .from("telemetria_pagecount_diaria")
    .select(
      "nr_inventario,dt_referencia,nr_paginas_inicio_dia,nr_paginas_fim_dia,nr_paginas_dia,dt_primeira_leitura,dt_ultima_leitura,ds_status_ultima",
    )
    .gte("dt_referencia", dateFrom)
    .lte("dt_referencia", dateTo)
    .order("dt_referencia", { ascending: true })
    .order("dt_ultima_leitura", { ascending: true })
    .limit(120000)
    .returns<DailyRow[]>();

  if (!tentativaConsolidado.error) {
    const rows = (tentativaConsolidado.data || []).map((row) => ({
      nr_inventario: toNumber(row.nr_inventario, 0),
      dt_referencia: row.dt_referencia,
      nr_paginas_inicio_dia: toNumber(row.nr_paginas_inicio_dia, 0),
      nr_paginas_fim_dia: toNumber(row.nr_paginas_fim_dia, toNumber(row.nr_paginas_inicio_dia, 0)),
      nr_paginas_total: toNumber(row.nr_paginas_fim_dia, 0),
      dt_primeira_leitura: normalizeTimestamp(row.dt_primeira_leitura),
      dt_leitura: normalizeTimestamp(row.dt_ultima_leitura),
      ds_status_impressora: normalizeStatus(row.ds_status_ultima),
    }));
    return { source: "consolidado_diario", rows };
  }

  const errorMessage = String(tentativaConsolidado.error.message || "");
  if (!isMissingColumnError(errorMessage)) {
    throw new Error(`Falha ao carregar telemetria consolidada: ${errorMessage}`);
  }

  const fromIso = toIsoStartFromDateKey(dateFrom);
  const toIso = toIsoEndFromDateKey(dateTo);
  const pageSize = 2000;
  const maxPages = 300;
  const map = new Map<string, DailyAggregate>();

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("telemetria_pagecount")
      .select("nr_inventario,nr_paginas_total,dt_leitura,ds_status_impressora")
      .gte("dt_leitura", fromIso)
      .lte("dt_leitura", toIso)
      .order("dt_leitura", { ascending: true })
      .range(from, to)
      .returns<LegacyRow[]>();

    if (error) throw new Error(`Falha ao carregar telemetria legada: ${error.message}`);
    const batch = data || [];
    if (!batch.length) break;

    for (const row of batch) {
      const nrInventario = toNumber(row.nr_inventario, 0);
      if (!Number.isFinite(nrInventario) || nrInventario <= 0) continue;

      const dtLeitura = normalizeTimestamp(row.dt_leitura);
      if (!dtLeitura) continue;

      const dataRef = toDateKeySaoPaulo(dtLeitura);
      const key = `${nrInventario}|${dataRef}`;
      const total = Math.max(0, toNumber(row.nr_paginas_total, 0));
      const atual = map.get(key);

      if (!atual) {
        // Primeira leitura do dia vira baseline (inicio e fim iguais inicialmente).
        map.set(key, {
          nr_inventario: nrInventario,
          dt_referencia: dataRef,
          nr_paginas_inicio_dia: total,
          nr_paginas_fim_dia: total,
          nr_paginas_total: total,
          dt_primeira_leitura: dtLeitura,
          dt_leitura: dtLeitura,
          ds_status_impressora: normalizeStatus(row.ds_status_impressora),
        });
        continue;
      }

      if (total < atual.nr_paginas_inicio_dia) atual.nr_paginas_inicio_dia = total;
      if (total > atual.nr_paginas_fim_dia) atual.nr_paginas_fim_dia = total;
      if (!atual.dt_primeira_leitura || new Date(dtLeitura).getTime() <= new Date(atual.dt_primeira_leitura).getTime()) {
        atual.dt_primeira_leitura = dtLeitura;
      }
      if (!atual.dt_leitura || new Date(dtLeitura).getTime() >= new Date(atual.dt_leitura).getTime()) {
        atual.dt_leitura = dtLeitura;
        atual.ds_status_impressora = normalizeStatus(row.ds_status_impressora);
      }
      atual.nr_paginas_total = Math.max(atual.nr_paginas_total, total);
    }

    if (batch.length < pageSize) break;
  }

  return {
    source: "legado_agregado",
    rows: Array.from(map.values()).sort((a, b) => {
      if (a.dt_referencia === b.dt_referencia) return a.nr_inventario - b.nr_inventario;
      return a.dt_referencia.localeCompare(b.dt_referencia);
    }),
  };
}

async function loadInventarioMeta(nrInventarios: number[]) {
  const supabase = getSupabaseServerClient();
  if (!nrInventarios.length) return new Map<number, MetaInventario>();

  const { data: inventarios, error: inventarioError } = await supabase
    .from("inventario")
    .select("nr_inventario,nr_patrimonio,nr_ip,cd_setor,cd_equipamento")
    .in("nr_inventario", nrInventarios)
    .returns<InventarioRow[]>();

  if (inventarioError) throw new Error(`Falha ao carregar inventario: ${inventarioError.message}`);

  const setorIds = Array.from(new Set((inventarios || []).map((row) => toNumber(row.cd_setor, 0)).filter((id) => id > 0)));
  const equipamentoIds = Array.from(
    new Set((inventarios || []).map((row) => toNumber(row.cd_equipamento, 0)).filter((id) => id > 0)),
  );

  const [{ data: setores, error: setorError }, { data: equipamentos, error: equipamentoError }] = await Promise.all([
    setorIds.length
      ? supabase.from("setor").select("cd_setor,nm_setor,ds_setor").in("cd_setor", setorIds).returns<SetorRow[]>()
      : Promise.resolve({ data: [] as SetorRow[], error: null }),
    equipamentoIds.length
      ? supabase.from("equipamento").select("cd_equipamento,nm_modelo").in("cd_equipamento", equipamentoIds).returns<EquipamentoRow[]>()
      : Promise.resolve({ data: [] as EquipamentoRow[], error: null }),
  ]);

  if (setorError) throw new Error(`Falha ao carregar setores: ${setorError.message}`);
  if (equipamentoError) throw new Error(`Falha ao carregar equipamentos: ${equipamentoError.message}`);

  const setorMap = new Map<number, SetorRow>((setores || []).map((row) => [toNumber(row.cd_setor, 0), row]));
  const equipamentoMap = new Map<number, EquipamentoRow>(
    (equipamentos || []).map((row) => [toNumber(row.cd_equipamento, 0), row]),
  );

  const meta = new Map<number, MetaInventario>();
  for (const row of inventarios || []) {
    const nrInventario = toNumber(row.nr_inventario, 0);
    if (nrInventario <= 0) continue;
    const setor = setorMap.get(toNumber(row.cd_setor, 0));
    const equipamento = equipamentoMap.get(toNumber(row.cd_equipamento, 0));
    meta.set(nrInventario, {
      patrimonio: String(row.nr_patrimonio || `INV-${nrInventario}`),
      ip: String(row.nr_ip || "-"),
      setor: String(setor?.nm_setor || setor?.ds_setor || "Sem setor"),
      modelo: String(equipamento?.nm_modelo || "Sem modelo"),
    });
  }

  return meta;
}

async function loadInventarioMetaUniverse() {
  const supabase = getSupabaseServerClient();

  const { data: inventarios, error: inventarioError } = await supabase
    .from("inventario")
    .select("nr_inventario,nr_patrimonio,nr_ip,cd_setor,cd_equipamento,ie_situacao")
    .in("ie_situacao", ["A", "M"])
    .returns<InventarioRow[]>();

  if (inventarioError) throw new Error(`Falha ao carregar inventario base: ${inventarioError.message}`);

  const inventarioRows = inventarios || [];
  if (!inventarioRows.length) return new Map<number, MetaInventario>();

  const setorIds = Array.from(new Set(inventarioRows.map((row) => toNumber(row.cd_setor, 0)).filter((id) => id > 0)));
  const equipamentoIds = Array.from(
    new Set(inventarioRows.map((row) => toNumber(row.cd_equipamento, 0)).filter((id) => id > 0)),
  );

  const [{ data: setores, error: setorError }, { data: equipamentos, error: equipamentoError }] = await Promise.all([
    setorIds.length
      ? supabase.from("setor").select("cd_setor,nm_setor,ds_setor").in("cd_setor", setorIds).returns<SetorRow[]>()
      : Promise.resolve({ data: [] as SetorRow[], error: null }),
    equipamentoIds.length
      ? supabase
          .from("equipamento")
          .select("cd_equipamento,nm_modelo,cd_tipo_equipamento,ie_situacao")
          .in("cd_equipamento", equipamentoIds)
          .in("ie_situacao", ["A", "M"])
          .returns<EquipamentoRow[]>()
      : Promise.resolve({ data: [] as EquipamentoRow[], error: null }),
  ]);

  if (setorError) throw new Error(`Falha ao carregar setores base: ${setorError.message}`);
  if (equipamentoError) throw new Error(`Falha ao carregar equipamentos base: ${equipamentoError.message}`);

  const tipoIds = Array.from(
    new Set((equipamentos || []).map((row) => toNumber(row.cd_tipo_equipamento, 0)).filter((id) => id > 0)),
  );
  const { data: tipos, error: tiposError } = tipoIds.length
    ? await supabase
        .from("tipo_equipamento")
        .select("cd_tipo_equipamento,nm_tipo_equipamento")
        .in("cd_tipo_equipamento", tipoIds)
        .returns<TipoEquipamentoRow[]>()
    : { data: [] as TipoEquipamentoRow[], error: null };

  if (tiposError) throw new Error(`Falha ao carregar tipos de equipamento: ${tiposError.message}`);

  const setorMap = new Map<number, SetorRow>((setores || []).map((row) => [toNumber(row.cd_setor, 0), row]));
  const equipamentoMap = new Map<number, EquipamentoRow>(
    (equipamentos || []).map((row) => [toNumber(row.cd_equipamento, 0), row]),
  );
  const tipoMap = new Map<number, TipoEquipamentoRow>(
    (tipos || []).map((row) => [toNumber(row.cd_tipo_equipamento, 0), row]),
  );

  const isPrinterEquipamento = (equipamento: EquipamentoRow | undefined) => {
    if (!equipamento) return false;
    const tipo = tipoMap.get(toNumber(equipamento.cd_tipo_equipamento, 0));
    const tipoNome = normalizeCompare(tipo?.nm_tipo_equipamento || "");
    if (!tipoNome) return true;
    return tipoNome.includes("impress");
  };

  const meta = new Map<number, MetaInventario>();
  for (const row of inventarioRows) {
    const nrInventario = toNumber(row.nr_inventario, 0);
    if (nrInventario <= 0) continue;

    const equipamento = equipamentoMap.get(toNumber(row.cd_equipamento, 0));
    if (!isPrinterEquipamento(equipamento)) continue;

    const setor = setorMap.get(toNumber(row.cd_setor, 0));
    meta.set(nrInventario, {
      patrimonio: String(row.nr_patrimonio || `INV-${nrInventario}`),
      ip: String(row.nr_ip || "-"),
      setor: String(setor?.nm_setor || setor?.ds_setor || "Sem setor"),
      modelo: String(equipamento?.nm_modelo || "Sem modelo"),
    });
  }

  return meta;
}

async function loadLatestSnapshot(nrInventarios: number[]) {
  const supabase = getSupabaseServerClient();
  if (!nrInventarios.length) return new Map<number, DailyAggregate>();

  const { data, error } = await supabase
    .from("telemetria_pagecount")
    .select("nr_inventario,nr_paginas_total,dt_leitura,ds_status_impressora")
    .in("nr_inventario", nrInventarios)
    .returns<LegacyRow[]>();

  if (error) throw new Error(`Falha ao carregar snapshot de telemetria: ${error.message}`);

  const snapshot = new Map<number, DailyAggregate>();
  for (const row of data || []) {
    const nrInventario = toNumber(row.nr_inventario, 0);
    if (nrInventario <= 0) continue;
    snapshot.set(nrInventario, {
      nr_inventario: nrInventario,
      dt_referencia: "",
      nr_paginas_inicio_dia: Math.max(0, toNumber(row.nr_paginas_total, 0)),
      nr_paginas_fim_dia: Math.max(0, toNumber(row.nr_paginas_total, 0)),
      nr_paginas_total: Math.max(0, toNumber(row.nr_paginas_total, 0)),
      dt_primeira_leitura: null,
      dt_leitura: normalizeTimestamp(row.dt_leitura),
      ds_status_impressora: normalizeStatus(row.ds_status_impressora),
    });
  }

  return snapshot;
}

async function loadSuprimentos(inventarioIds: number[]) {
  const supabase = getSupabaseServerClient();
  if (!inventarioIds.length) return [] as SuprimentoRow[];
  const { data, error } = await supabase
    .from("suprimentos")
    .select("nr_inventario,tp_suprimento,nr_quantidade,ds_suprimento,ie_situacao")
    .in("nr_inventario", inventarioIds)
    .eq("ie_situacao", "A")
    .returns<SuprimentoRow[]>();
  if (error) throw new Error(`Falha ao carregar suprimentos: ${error.message}`);
  return data || [];
}

export async function buscarResumoTelemetriaDiaria(options?: {
  dias?: number;
  de?: string | null;
  ate?: string | null;
  setor?: string | null;
  localizacao?: string | null;
  modelo?: string | null;
}): Promise<{
  success: true;
  data: TelemetriaResumo;
} | {
  success: false;
  error: string;
}> {
  try {
    const setorFiltro = normalizeCompare(options?.setor);
    const localizacaoFiltro = normalizeCompare(options?.localizacao);
    const modeloFiltro = normalizeCompare(options?.modelo);

    let dataDe: string;
    let dataAte: string;
    let dias: number;

    const deCustom = parseDateKeyInput(options?.de ?? null);
    const ateCustom = parseDateKeyInput(options?.ate ?? null);

    if ((deCustom && !ateCustom) || (!deCustom && ateCustom)) {
      return { success: false, error: "Informe as duas datas: inicio e fim." };
    }

    if (deCustom && ateCustom) {
      if (deCustom > ateCustom) {
        return { success: false, error: "A data inicial deve ser menor ou igual a data final." };
      }
      const diff = daysBetweenInclusive(deCustom, ateCustom);
      if (!diff) return { success: false, error: "Faixa de datas invalida." };
      dias = clampDays(diff);
      dataDe = deCustom;
      dataAte = ateCustom;
    } else {
      dias = clampDays(Number(options?.dias ?? 30));
      const hoje = new Date();
      const de = new Date(hoje.getTime());
      de.setDate(de.getDate() - dias + 1);
      dataDe = toDateKeySaoPaulo(de);
      dataAte = toDateKeySaoPaulo(hoje);
    }

    const dataHoje = dataAte;
    const loaded = await loadDailyRows(dataDe, dataAte);
    const rows = loaded.rows;

    let meta = await loadInventarioMetaUniverse();
    if (!meta.size) {
      const inventariosBrutos = Array.from(new Set(rows.map((row) => row.nr_inventario).filter((id) => id > 0)));
      meta = await loadInventarioMeta(inventariosBrutos);
    }

    const setoresDisponiveis = Array.from(new Set(Array.from(meta.values()).map((m) => m.setor))).sort((a, b) =>
      a.localeCompare(b),
    );
    const localizacoesDisponiveis: string[] = [];
    const modelosDisponiveis = Array.from(new Set(Array.from(meta.values()).map((m) => m.modelo))).sort((a, b) =>
      a.localeCompare(b),
    );

    const inventariosElegiveis = new Set<number>();
    for (const [inventarioId, info] of meta.entries()) {
      if (setorFiltro && normalizeCompare(info.setor) !== setorFiltro) continue;
      if (modeloFiltro && normalizeCompare(info.modelo) !== modeloFiltro) continue;
      inventariosElegiveis.add(inventarioId);
    }

    const rowsFiltradas = rows.filter((row) => inventariosElegiveis.has(row.nr_inventario));
    const inventarioIdsFiltrados = Array.from(inventariosElegiveis.values());
    const latestSnapshot = await loadLatestSnapshot(inventarioIdsFiltrados);

    const inventariosComColetaSet = new Set<number>();
    const serieMap = new Map<string, number>();
    const rankingModelosMap = new Map<string, { paginas: number; inventarios: Set<number> }>();

    let paginasHoje = 0;
    let paginasPeriodo = 0;
    let paginasContadasTotal = 0;
    let paginasPbPeriodo = 0;
    let paginasColorPeriodo = 0;
    let ultimaLeituraGeral: string | null = null;

    for (const inventarioId of inventariosElegiveis) {
      const snapshot = latestSnapshot.get(inventarioId);
      if (!snapshot) continue;
      paginasContadasTotal += Math.max(0, toNumber(snapshot.nr_paginas_total, 0));

      if (hasRecentSnmpCollection(snapshot.ds_status_impressora, snapshot.dt_leitura)) {
        // "Com coleta hoje" = status online/warning com leitura recente dentro da janela.
        inventariosComColetaSet.add(inventarioId);
      }

      if (snapshot.dt_leitura) {
        const rowMs = new Date(snapshot.dt_leitura).getTime();
        const bestMs = ultimaLeituraGeral ? new Date(ultimaLeituraGeral).getTime() : 0;
        if (rowMs >= bestMs) ultimaLeituraGeral = snapshot.dt_leitura;
      }
    }

    for (const row of rowsFiltradas) {
      if (row.nr_inventario <= 0) continue;

      const info = meta.get(row.nr_inventario);
      const paginasDia = dailyPages(row);
      paginasPeriodo += paginasDia;

      const serieAtual = serieMap.get(row.dt_referencia) ?? 0;
      serieMap.set(row.dt_referencia, serieAtual + paginasDia);

      if (row.dt_referencia === dataHoje) {
        paginasHoje += paginasDia;
      }

      const modelo = info?.modelo || "Sem modelo";
      if (!rankingModelosMap.has(modelo)) {
        rankingModelosMap.set(modelo, { paginas: 0, inventarios: new Set<number>() });
      }
      const bucket = rankingModelosMap.get(modelo) as { paginas: number; inventarios: Set<number> };
      bucket.paginas += paginasDia;
      bucket.inventarios.add(row.nr_inventario);

      if (isColorModel(modelo)) paginasColorPeriodo += paginasDia;
      else paginasPbPeriodo += paginasDia;
    }

    const suprimentosRows = await loadSuprimentos(inventarioIdsFiltrados);

    let suprimentosCriticos = 0;
    let suprimentosAtencao = 0;
    let suprimentosOk = 0;

    const suprimentosItens = suprimentosRows
      .map((item) => {
        const info = meta.get(toNumber(item.nr_inventario, 0));
        const nivel = Number.isFinite(Number(item.nr_quantidade)) ? Number(item.nr_quantidade) : null;
        const status = classificarSuprimento(item.ds_suprimento, nivel);

        if (status === "critico") suprimentosCriticos += 1;
        else if (status === "atencao") suprimentosAtencao += 1;
        else if (status === "ok") suprimentosOk += 1;

        return {
          nr_inventario: toNumber(item.nr_inventario, 0),
          patrimonio: info?.patrimonio || `INV-${item.nr_inventario}`,
          setor: info?.setor || "Sem setor",
          modelo: info?.modelo || "Sem modelo",
          suprimento: String(item.tp_suprimento || "Suprimento"),
          nivel_percentual: nivel === null ? null : Math.max(0, Math.min(100, Math.round(nivel))),
          status,
        };
      })
      .sort((a, b) => {
        const prioridade = { critico: 0, atencao: 1, ok: 2, desconhecido: 3 };
        const pa = prioridade[a.status];
        const pb = prioridade[b.status];
        if (pa !== pb) return pa - pb;
        return (a.nivel_percentual ?? 999) - (b.nivel_percentual ?? 999);
      })
      .slice(0, 200);

    const topImpressorasHoje = rowsFiltradas
      .filter((row) => row.dt_referencia === dataHoje)
      .map((row) => {
        const paginasDia = dailyPages(row);
        const info = meta.get(row.nr_inventario);
        const snapshot = latestSnapshot.get(row.nr_inventario);
        return {
          nr_inventario: row.nr_inventario,
          patrimonio: info?.patrimonio || `INV-${row.nr_inventario}`,
          ip: info?.ip || "-",
          setor: info?.setor || "Sem setor",
          modelo: info?.modelo || "Sem modelo",
          paginas_dia: paginasDia,
          contador_atual: Math.max(0, toNumber(snapshot?.nr_paginas_total ?? row.nr_paginas_total, 0)),
          status: normalizeStatus(snapshot?.ds_status_impressora ?? row.ds_status_impressora),
          dt_primeira_leitura_dia: row.dt_primeira_leitura,
          dt_ultima_leitura: snapshot?.dt_leitura ?? row.dt_leitura,
        };
      })
      .sort((a, b) => b.paginas_dia - a.paginas_dia)
      .slice(0, 80);

    const seriePaginasDia = Array.from(serieMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([data_ref, paginas]) => ({
        data_ref,
        paginas: Math.max(0, Math.round(paginas)),
      }));

    const rankingModelosPeriodo = Array.from(rankingModelosMap.entries())
      .map(([modelo, bucket]) => ({
        modelo,
        paginas_periodo: Math.max(0, Math.round(bucket.paginas)),
        impressoras_ativas: bucket.inventarios.size,
      }))
      .sort((a, b) => b.paginas_periodo - a.paginas_periodo)
      .slice(0, 12);

    const tarifas = await loadTarifasBilhetagem(dataAte);
    const paginasPb = Math.max(0, Math.round(paginasPbPeriodo));
    const paginasColor = Math.max(0, Math.round(paginasColorPeriodo));
    const custoPb = paginasPb * tarifas.valor_pb;
    const custoColor = paginasColor * tarifas.valor_colorida;
    const custoTotal = custoPb + custoColor;

    return {
      success: true,
      data: {
        periodo: {
          dias,
          de: dataDe,
          ate: dataAte,
          timezone: SAO_PAULO_TZ,
          fonte: loaded.source,
        },
        filtros: {
          filtro_setor: setorFiltro,
          filtro_localizacao: localizacaoFiltro,
          filtro_modelo: modeloFiltro,
          setores_disponiveis: setoresDisponiveis,
          localizacoes_disponiveis: localizacoesDisponiveis,
          modelos_disponiveis: modelosDisponiveis,
        },
        totais: {
          inventarios_monitorados: inventariosElegiveis.size,
          inventarios_com_coleta_hoje: inventariosComColetaSet.size,
          inventarios_sem_coleta_hoje: Math.max(0, inventariosElegiveis.size - inventariosComColetaSet.size),
          paginas_hoje: Math.max(0, Math.round(paginasHoje)),
          paginas_periodo: Math.max(0, Math.round(paginasPeriodo)),
          paginas_contadas_total: Math.max(0, Math.round(paginasContadasTotal)),
          ultima_leitura_geral: ultimaLeituraGeral,
        },
        bilhetagem: {
          observacao: "Valores calculados conforme bilhetagem enviada pela locadora.",
          tarifas,
          custos: {
            paginas_pb: paginasPb,
            paginas_coloridas: paginasColor,
            custo_pb: custoPb,
            custo_colorida: custoColor,
            custo_total: custoTotal,
          },
        },
        serie_paginas_dia: seriePaginasDia,
        ranking_modelos_periodo: rankingModelosPeriodo,
        suprimentos_alertas: {
          criticos: suprimentosCriticos,
          atencao: suprimentosAtencao,
          ok: suprimentosOk,
          itens: suprimentosItens,
        },
        top_impressoras_hoje: topImpressorasHoje,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Falha ao carregar resumo de telemetria.",
    };
  }
}

