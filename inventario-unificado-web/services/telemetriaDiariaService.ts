import { getSupabaseServerClient } from "@/lib/supabase/server";

type DailyRow = {
  nr_inventario: number;
  dt_referencia: string;
  nr_paginas_inicio_dia: number;
  nr_paginas_fim_dia: number;
  nr_paginas_dia: number;
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
};

type SetorRow = {
  cd_setor: number;
  nm_setor: string | null;
  ds_setor: string | null;
};

type EquipamentoRow = {
  cd_equipamento: number;
  nm_modelo: string | null;
};

type DailyAggregate = {
  nr_inventario: number;
  dt_referencia: string;
  nr_paginas_inicio_dia: number;
  nr_paginas_fim_dia: number;
  nr_paginas_total: number;
  dt_leitura: string | null;
  ds_status_impressora: string;
};

type TelemetriaResumo = {
  periodo: {
    dias: number;
    de: string;
    ate: string;
    timezone: string;
    fonte: "consolidado_diario" | "legado_agregado";
  };
  totais: {
    inventarios_monitorados: number;
    inventarios_com_coleta_hoje: number;
    inventarios_sem_coleta_hoje: number;
    paginas_hoje: number;
    paginas_periodo: number;
    ultima_leitura_geral: string | null;
  };
  serie_paginas_dia: Array<{
    data_ref: string;
    paginas: number;
  }>;
  top_impressoras_hoje: Array<{
    nr_inventario: number;
    patrimonio: string;
    ip: string;
    setor: string;
    modelo: string;
    paginas_dia: number;
    contador_atual: number;
    status: string;
    dt_ultima_leitura: string | null;
  }>;
};

const SAO_PAULO_TZ = "America/Sao_Paulo";
const SP_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: SAO_PAULO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

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
  const date = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(date.getTime())) return SP_FORMATTER.format(new Date());
  return SP_FORMATTER.format(date);
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

function isMissingColumnError(message: string) {
  return /column .* does not exist/i.test(message) || /Could not find the .* column/i.test(message);
}

function dailyPages(row: DailyAggregate) {
  const inicio = toNumber(row.nr_paginas_inicio_dia, 0);
  const fim = toNumber(row.nr_paginas_fim_dia, toNumber(row.nr_paginas_total, 0));
  return Math.max(0, fim - inicio);
}

async function loadDailyRows(
  dateFrom: string,
  dateTo: string,
): Promise<{ source: "consolidado_diario"; rows: DailyAggregate[] } | { source: "legado_agregado"; rows: DailyAggregate[] }> {
  const supabase = getSupabaseServerClient();

  const tentativaConsolidado = await supabase
    .from("telemetria_pagecount_diaria")
    .select(
      "nr_inventario,dt_referencia,nr_paginas_inicio_dia,nr_paginas_fim_dia,nr_paginas_dia,dt_ultima_leitura,ds_status_ultima",
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
      dt_leitura: row.dt_ultima_leitura,
      ds_status_impressora: normalizeStatus(row.ds_status_ultima),
    }));
    return { source: "consolidado_diario", rows };
  }

  const errorMessage = String(tentativaConsolidado.error.message || "");
  if (!isMissingColumnError(errorMessage)) {
    throw new Error(`Falha ao carregar telemetria consolidada: ${errorMessage}`);
  }

  // Fallback automatico para schema antigo (uma linha por ingestao).
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

      const dtLeitura = String(row.dt_leitura || "");
      if (!dtLeitura) continue;

      const dataRef = toDateKeySaoPaulo(dtLeitura);
      const key = `${nrInventario}|${dataRef}`;
      const total = Math.max(0, toNumber(row.nr_paginas_total, 0));
      const atual = map.get(key);

      if (!atual) {
        map.set(key, {
          nr_inventario: nrInventario,
          dt_referencia: dataRef,
          nr_paginas_inicio_dia: total,
          nr_paginas_fim_dia: total,
          nr_paginas_total: total,
          dt_leitura: dtLeitura,
          ds_status_impressora: normalizeStatus(row.ds_status_impressora),
        });
        continue;
      }

      if (total < atual.nr_paginas_inicio_dia) atual.nr_paginas_inicio_dia = total;
      if (total > atual.nr_paginas_fim_dia) atual.nr_paginas_fim_dia = total;
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
  if (!nrInventarios.length) return new Map<number, { patrimonio: string; ip: string; setor: string; modelo: string }>();

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

  const meta = new Map<number, { patrimonio: string; ip: string; setor: string; modelo: string }>();
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

export async function buscarResumoTelemetriaDiaria(options?: { dias?: number }): Promise<{
  success: true;
  data: TelemetriaResumo;
} | {
  success: false;
  error: string;
}> {
  try {
    const dias = clampDays(Number(options?.dias ?? 30));
    const hoje = new Date();
    const de = new Date(hoje.getTime());
    de.setDate(de.getDate() - dias + 1);

    const dataDe = toDateKeySaoPaulo(de);
    const dataAte = toDateKeySaoPaulo(hoje);
    const dataHoje = dataAte;

    const loaded = await loadDailyRows(dataDe, dataAte);
    const rows = loaded.rows;

    const inventariosSet = new Set<number>();
    const inventariosHojeSet = new Set<number>();
    const serieMap = new Map<string, number>();
    const latestByInventario = new Map<number, DailyAggregate>();

    let paginasHoje = 0;
    let paginasPeriodo = 0;
    let ultimaLeituraGeral: string | null = null;

    for (const row of rows) {
      if (row.nr_inventario <= 0) continue;
      inventariosSet.add(row.nr_inventario);

      const paginasDia = dailyPages(row);
      paginasPeriodo += paginasDia;

      const serieAtual = serieMap.get(row.dt_referencia) ?? 0;
      serieMap.set(row.dt_referencia, serieAtual + paginasDia);

      if (row.dt_referencia === dataHoje) {
        inventariosHojeSet.add(row.nr_inventario);
        paginasHoje += paginasDia;
      }

      const atual = latestByInventario.get(row.nr_inventario);
      if (!atual) {
        latestByInventario.set(row.nr_inventario, row);
      } else {
        const atualMs = atual.dt_leitura ? new Date(atual.dt_leitura).getTime() : 0;
        const novoMs = row.dt_leitura ? new Date(row.dt_leitura).getTime() : 0;
        if (novoMs >= atualMs) latestByInventario.set(row.nr_inventario, row);
      }

      if (row.dt_leitura) {
        const rowMs = new Date(row.dt_leitura).getTime();
        const bestMs = ultimaLeituraGeral ? new Date(ultimaLeituraGeral).getTime() : 0;
        if (rowMs >= bestMs) ultimaLeituraGeral = row.dt_leitura;
      }
    }

    const inventarioIds = Array.from(inventariosSet.values());
    const meta = await loadInventarioMeta(inventarioIds);

    const topImpressorasHoje = rows
      .filter((row) => row.dt_referencia === dataHoje)
      .map((row) => {
        const paginasDia = dailyPages(row);
        const info = meta.get(row.nr_inventario);
        return {
          nr_inventario: row.nr_inventario,
          patrimonio: info?.patrimonio || `INV-${row.nr_inventario}`,
          ip: info?.ip || "-",
          setor: info?.setor || "Sem setor",
          modelo: info?.modelo || "Sem modelo",
          paginas_dia: paginasDia,
          contador_atual: Math.max(0, toNumber(row.nr_paginas_total, 0)),
          status: normalizeStatus(row.ds_status_impressora),
          dt_ultima_leitura: row.dt_leitura,
        };
      })
      .sort((a, b) => b.paginas_dia - a.paginas_dia)
      .slice(0, 25);

    const seriePaginasDia = Array.from(serieMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([data_ref, paginas]) => ({
        data_ref,
        paginas: Math.max(0, Math.round(paginas)),
      }));

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
        totais: {
          inventarios_monitorados: inventariosSet.size,
          inventarios_com_coleta_hoje: inventariosHojeSet.size,
          inventarios_sem_coleta_hoje: Math.max(0, inventariosSet.size - inventariosHojeSet.size),
          paginas_hoje: Math.max(0, Math.round(paginasHoje)),
          paginas_periodo: Math.max(0, Math.round(paginasPeriodo)),
          ultima_leitura_geral: ultimaLeituraGeral,
        },
        serie_paginas_dia: seriePaginasDia,
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
