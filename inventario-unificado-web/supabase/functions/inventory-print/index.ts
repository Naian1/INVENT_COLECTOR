// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type Action =
  | "visao_geral"
  | "categorias_opcoes"
  | "categorias_linhas"
  | "linha_valores"
  | "add_impressora_manual"
  | "tornar_operacional_linha"
  | "sincronizar_operacionais_lote"
  | "dashboard_analitico";

type ImpressoraVisao = {
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
  status_atual: string;
  contador_paginas_atual: number | null;
  menor_nivel_suprimento: number | null;
  resumo_suprimentos: Array<{
    chave_suprimento: string;
    nome_suprimento: string;
    nivel_percentual: number | null;
    quantidade_atual: number | null;
    status_suprimento: string;
  }>;
  operacional: boolean;
  origem_linha_id: string | null;
};

type LinhaInventario = {
  id: string;
  codigo_linha: string | null;
  observacao: string | null;
  setor: string | null;
  localizacao: string | null;
  ativo: boolean;
  categoria_id: string;
};

const SEMANTICOS_RELEVANTES = [
  "patrimonio",
  "impressora_patrimonio",
  "ip",
  "impressora_ip",
  "modelo",
  "impressora_modelo",
  "fabricante",
  "numero_serie",
  "hostname",
  "endereco_mac",
  "setor",
  "localizacao",
];

const HISTORICO_PAGINAS_DIAS_MAX = 92;

function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function badRequest(message: string) {
  return jsonResponse({ ok: false, error: message }, 400);
}

function limparTexto(value: unknown): string | null {
  const texto = String(value ?? "").trim();
  return texto || null;
}

function normalizarTexto(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizarIp(value: string | null | undefined): string {
  const ip = String(value ?? "").trim();
  if (!ip) return "";
  return ip.replace(/\/32$/, "");
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusSuprimentoPorNivel(nivelPercentual: number | null): string {
  if (nivelPercentual === null) return "unknown";
  if (nivelPercentual <= 5) return "critical";
  if (nivelPercentual <= 15) return "low";
  return "ok";
}

function normalizarStatusSuprimento(statusRaw: unknown, nivelPercentual: number | null): string {
  if (nivelPercentual !== null) {
    return statusSuprimentoPorNivel(nivelPercentual);
  }

  const status = String(statusRaw ?? "").trim().toLowerCase();
  if (["critical", "low", "ok", "unknown"].includes(status)) {
    return status;
  }
  return "unknown";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isMissingTableError(error: unknown): boolean {
  const message = String((error as any)?.message ?? "");
  return (
    /relation .* does not exist/i.test(message) ||
    /Could not find the table/i.test(message) ||
    /does not exist/i.test(message)
  );
}

function isMissingColumnError(error: unknown): boolean {
  const message = String((error as any)?.message ?? "");
  return /column .* does not exist/i.test(message) || /Could not find the .* column/i.test(message);
}

async function tableExists(supabase: ReturnType<typeof getAdminClient>, table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(1);

  if (!error) return true;
  if (isMissingTableError(error)) return false;
  throw new Error(error.message || `Falha ao verificar tabela ${table}`);
}

async function loadCategoriasImpressora(supabase: ReturnType<typeof getAdminClient>) {
  const hasCategorias = await tableExists(supabase, "categorias_inventario");
  if (!hasCategorias) return [];

  const { data, error } = await supabase
    .from("categorias_inventario")
    .select("id,nome,aba_inventario_id,ativo")
    .eq("ativo", true)
    .ilike("nome", "%impress%")
    .order("nome", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

async function loadLinhaSemanticMap(
  supabase: ReturnType<typeof getAdminClient>,
  linhaId: string,
): Promise<{
  linha: LinhaInventario | null;
  campos: Array<{
    id: string;
    nome_campo_exibicao: string;
    chave_campo: string;
    tipo_semantico: string;
    ordem: number | null;
  }>;
  valores: Array<{
    campo_id: string;
    valor_texto?: string | null;
    valor_numero?: number | null;
    valor_booleano?: boolean | null;
    valor_data?: string | null;
    valor_ip?: string | null;
    valor_json?: unknown;
  }>;
  semanticBag: Map<string, string>;
}> {
  const hasLinhas = await tableExists(supabase, "linhas_inventario");
  const hasCampos = await tableExists(supabase, "categoria_campos");
  const hasValores = await tableExists(supabase, "linha_valores_campos");

  if (!hasLinhas || !hasCampos || !hasValores) {
    return { linha: null, campos: [], valores: [], semanticBag: new Map() };
  }

  const { data: linha, error: linhaError } = await supabase
    .from("linhas_inventario")
    .select("id,categoria_id,codigo_linha,observacao,setor,localizacao,ativo")
    .eq("id", linhaId)
    .maybeSingle();

  if (linhaError) throw new Error(linhaError.message);
  if (!linha?.id || !linha?.categoria_id) {
    return { linha: null, campos: [], valores: [], semanticBag: new Map() };
  }

  const { data: campos, error: camposError } = await supabase
    .from("categoria_campos")
    .select("id,nome_campo_exibicao,chave_campo,tipo_semantico,ordem,ativo")
    .eq("categoria_id", linha.categoria_id)
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (camposError) throw new Error(camposError.message);

  const campoIds = (campos || []).map((item) => String(item.id));
  if (!campoIds.length) {
    return {
      linha,
      campos: [],
      valores: [],
      semanticBag: new Map(),
    };
  }

  const { data: valores, error: valoresError } = await supabase
    .from("linha_valores_campos")
    .select("campo_id,valor_texto,valor_numero,valor_booleano,valor_data,valor_ip,valor_json")
    .eq("linha_id", linhaId)
    .in("campo_id", campoIds);

  if (valoresError) throw new Error(valoresError.message);

  const semByCampo = new Map<string, string>();
  for (const campo of campos || []) {
    semByCampo.set(String(campo.id), String(campo.tipo_semantico || ""));
  }

  const semanticBag = new Map<string, string>();
  for (const value of valores || []) {
    const campoId = String(value.campo_id);
    const sem = semByCampo.get(campoId);
    if (!sem) continue;

    const texto =
      value.valor_texto ??
      (value.valor_numero !== null && value.valor_numero !== undefined ? String(value.valor_numero) : null) ??
      (value.valor_booleano !== null && value.valor_booleano !== undefined
        ? value.valor_booleano
          ? "true"
          : "false"
        : null) ??
      value.valor_data ??
      value.valor_ip ??
      (value.valor_json !== null && value.valor_json !== undefined ? JSON.stringify(value.valor_json) : null);

    const limpo = limparTexto(texto);
    if (!limpo) continue;

    if (!semanticBag.has(sem)) {
      semanticBag.set(sem, sem === "ip" || sem === "impressora_ip" ? normalizarIp(limpo) : limpo);
    }
  }

  return {
    linha,
    campos: (campos || []).map((campo) => ({
      id: String(campo.id),
      nome_campo_exibicao: String(campo.nome_campo_exibicao || campo.chave_campo || "Campo"),
      chave_campo: String(campo.chave_campo || ""),
      tipo_semantico: String(campo.tipo_semantico || ""),
      ordem: toFiniteNumber(campo.ordem),
    })),
    valores: (valores || []).map((item) => ({
      campo_id: String(item.campo_id),
      valor_texto: item.valor_texto ?? null,
      valor_numero: item.valor_numero ?? null,
      valor_booleano: item.valor_booleano ?? null,
      valor_data: item.valor_data ?? null,
      valor_ip: item.valor_ip ?? null,
      valor_json: item.valor_json ?? null,
    })),
    semanticBag,
  };
}

function semantico(bag: Map<string, string>, names: string[]): string | null {
  for (const key of names) {
    const value = limparTexto(bag.get(key));
    if (value) return value;
  }
  return null;
}

function normalizarStatusOperacional(value: unknown): string {
  const status = normalizarTexto(value);
  if (!status) return "unknown";
  if (["ok", "online", "ativo", "up"].includes(status)) return "online";
  if (["offline", "down", "inativo"].includes(status)) return "offline";
  if (["erro", "error", "critical", "critico"].includes(status)) return "error";
  if (["warning", "warn", "alerta"].includes(status)) return "warning";
  return "unknown";
}

function ehEquipamentoImpressora(equipamento: Record<string, unknown> | null): boolean {
  const nome = normalizarTexto(equipamento?.nm_equipamento);
  if (!nome) return true;
  return nome.includes("impress");
}

async function loadOperacionaisViaInventario(supabase: ReturnType<typeof getAdminClient>): Promise<ImpressoraVisao[]> {
  const hasInventario = await tableExists(supabase, "inventario");
  if (!hasInventario) return [];

  const { data: inventarioRows, error: inventarioError } = await supabase
    .from("inventario")
    .select(
      "nr_inventario,nr_patrimonio,nr_ip,nr_serie,tp_status,ie_situacao,equipamento:cd_equipamento(nm_modelo,nm_marca,nm_equipamento),setor:cd_setor(nm_setor,ds_setor)"
    )
    .eq("ie_situacao", "A")
    .not("nr_ip", "is", null);

  if (inventarioError) throw new Error(inventarioError.message);

  const base = (inventarioRows || [])
    .map((row) => {
      const registro = row as Record<string, unknown>;
      const equipamento = (registro.equipamento as Record<string, unknown> | null) || null;
      const setor = (registro.setor as Record<string, unknown> | null) || null;

      return {
        nr_inventario: Number(registro.nr_inventario),
        patrimonio: String(registro.nr_patrimonio || ""),
        ip: normalizarIp(String(registro.nr_ip || "")),
        numero_serie: limparTexto(registro.nr_serie),
        tp_status: String(registro.tp_status || "ATIVO").toUpperCase(),
        modelo: String(equipamento?.nm_modelo || equipamento?.nm_equipamento || "Desconhecido"),
        fabricante: limparTexto(equipamento?.nm_marca),
        setor: String(setor?.nm_setor || "Sem setor"),
        localizacao: limparTexto(setor?.ds_setor || setor?.nm_setor),
        ehImpressora: ehEquipamentoImpressora(equipamento),
      };
    })
    .filter((item) => Number.isFinite(item.nr_inventario) && item.nr_inventario > 0)
    .filter((item) => item.ip)
    .filter((item) => item.ehImpressora)
    .filter((item) => item.tp_status === "ATIVO");

  if (!base.length) return [];

  const ids = base.map((item) => item.nr_inventario);
  const telemetriaRecente = new Map<number, { nr_paginas_total: number | null; dt_leitura: string | null; status: string }>();
  const statusRecentePorChave = new Map<string, { status: string; coletado_em: string | null }>();
  const suprimentosByInventario = new Map<
    number,
    {
      menor_nivel: number | null;
      ultima_coleta: string | null;
      resumo: Array<{
        chave_suprimento: string;
        nome_suprimento: string;
        nivel_percentual: number | null;
        quantidade_atual: number | null;
        status_suprimento: string;
      }>;
    }
  >();

  if (await tableExists(supabase, "telemetria_impressoras")) {
    const ips = Array.from(
      new Set(
        base
          .map((item) => normalizarIp(item.ip))
          .filter((item) => item.length > 0),
      ),
    );
    const patrimonios = Array.from(
      new Set(
        base
          .map((item) => String(item.patrimonio || "").trim())
          .filter((item) => item.length > 0),
      ),
    );

    const statusRows: any[] = [];

    try {
      if (ips.length) {
        const { data, error } = await supabase
          .from("telemetria_impressoras")
          .select("ip,patrimonio,status,coletado_em")
          .in("ip", ips)
          .order("coletado_em", { ascending: false })
          .limit(10000);
        if (error) throw error;
        statusRows.push(...(data || []));
      }

      if (patrimonios.length) {
        const { data, error } = await supabase
          .from("telemetria_impressoras")
          .select("ip,patrimonio,status,coletado_em")
          .in("patrimonio", patrimonios)
          .order("coletado_em", { ascending: false })
          .limit(10000);
        if (error) throw error;
        statusRows.push(...(data || []));
      }
    } catch (error) {
      // Mantém a tela funcional mesmo em ambientes legados sem colunas de vínculo na telemetria.
      if (!isMissingColumnError(error) && !isMissingTableError(error)) {
        throw new Error((error as any)?.message || "Falha ao carregar fallback de status por telemetria.");
      }
    }

    for (const row of statusRows) {
      const status = normalizarStatusOperacional(row.status);
      const coletadoEm = limparTexto(row.coletado_em);

      const ipKey = normalizarIp(String(row.ip || ""));
      if (ipKey) {
        const key = `ip:${ipKey}`;
        if (!statusRecentePorChave.has(key)) {
          statusRecentePorChave.set(key, {
            status,
            coletado_em: coletadoEm,
          });
        }
      }

      const patrimonioKey = normalizarTexto(row.patrimonio);
      if (patrimonioKey) {
        const key = `pat:${patrimonioKey}`;
        if (!statusRecentePorChave.has(key)) {
          statusRecentePorChave.set(key, {
            status,
            coletado_em: coletadoEm,
          });
        }
      }
    }
  }

  if (await tableExists(supabase, "telemetria_pagecount")) {
    const { data: telemetriaRows, error: telemetriaError } = await supabase
      .from("telemetria_pagecount")
      .select("nr_inventario,nr_paginas_total,dt_leitura,ds_status_impressora")
      .in("nr_inventario", ids)
      .order("dt_leitura", { ascending: false })
      .limit(5000);

    if (telemetriaError) throw new Error(telemetriaError.message);

    for (const row of telemetriaRows || []) {
      const inventarioId = Number(row.nr_inventario);
      if (!Number.isFinite(inventarioId) || telemetriaRecente.has(inventarioId)) continue;
      telemetriaRecente.set(inventarioId, {
        nr_paginas_total: toFiniteNumber(row.nr_paginas_total),
        dt_leitura: limparTexto(row.dt_leitura),
        status: normalizarStatusOperacional(row.ds_status_impressora),
      });
    }
  }

  if (await tableExists(supabase, "suprimentos")) {
    const { data: suprimentosRows, error: suprimentosError } = await supabase
      .from("suprimentos")
      .select("nr_inventario,tp_suprimento,nr_quantidade,nr_quantidade_maxima,nr_quantidade_minima,dt_ultima_atualizacao")
      .in("nr_inventario", ids)
      .eq("ie_situacao", "A")
      .order("dt_ultima_atualizacao", { ascending: false })
      .limit(10000);

    if (suprimentosError) throw new Error(suprimentosError.message);

    for (const row of suprimentosRows || []) {
      const inventarioId = Number(row.nr_inventario);
      if (!Number.isFinite(inventarioId)) continue;

      if (!suprimentosByInventario.has(inventarioId)) {
        suprimentosByInventario.set(inventarioId, {
          menor_nivel: null,
          ultima_coleta: null,
          resumo: [],
        });
      }

      const bucket = suprimentosByInventario.get(inventarioId) as {
        menor_nivel: number | null;
        ultima_coleta: string | null;
        resumo: Array<{
          chave_suprimento: string;
          nome_suprimento: string;
          nivel_percentual: number | null;
          quantidade_atual: number | null;
          status_suprimento: string;
        }>;
      };

      const chave = String(row.tp_suprimento || "desconhecido").toLowerCase();
      if (bucket.resumo.some((item) => item.chave_suprimento === chave)) {
        continue;
      }

      const quantidade = toFiniteNumber(row.nr_quantidade);
      const quantidadeMaxima = toFiniteNumber(row.nr_quantidade_maxima);
      const quantidadeMinima = toFiniteNumber(row.nr_quantidade_minima);

      let nivelPercentual: number | null = null;
      if (quantidade !== null && quantidadeMaxima !== null && quantidadeMaxima > 0) {
        nivelPercentual = clamp(Math.round((quantidade / quantidadeMaxima) * 100), 0, 100);
      } else if (quantidade !== null && quantidade >= 0 && quantidade <= 100) {
        // Legacy collector stores percentage directly in nr_quantidade when maxima is unavailable.
        nivelPercentual = clamp(Math.round(quantidade), 0, 100);
      }

      let statusSuprimento = normalizarStatusSuprimento(null, nivelPercentual);
      if (statusSuprimento === "unknown" && quantidade !== null && quantidadeMinima !== null) {
        statusSuprimento = quantidade <= quantidadeMinima ? "low" : "ok";
      }

      if (nivelPercentual !== null && (bucket.menor_nivel === null || nivelPercentual < bucket.menor_nivel)) {
        bucket.menor_nivel = nivelPercentual;
      }

      const dtAtualizacao = limparTexto(row.dt_ultima_atualizacao);
      if (dtAtualizacao && !bucket.ultima_coleta) {
        bucket.ultima_coleta = dtAtualizacao;
      }

      bucket.resumo.push({
        chave_suprimento: chave,
        nome_suprimento: String(row.tp_suprimento || "Suprimento"),
        nivel_percentual: nivelPercentual,
        quantidade_atual: quantidade,
        status_suprimento: statusSuprimento,
      });
    }
  }

  return base.map((item) => {
    const telemetria = telemetriaRecente.get(item.nr_inventario);
    const statusRecente =
      statusRecentePorChave.get(`pat:${normalizarTexto(item.patrimonio)}`) ||
      statusRecentePorChave.get(`ip:${normalizarIp(item.ip)}`) ||
      null;
    const suprimentos = suprimentosByInventario.get(item.nr_inventario);
    return {
      id: String(item.nr_inventario),
      patrimonio: item.patrimonio,
      ip: item.ip,
      setor: item.setor,
      localizacao: item.localizacao,
      modelo: item.modelo,
      fabricante: item.fabricante,
      numero_serie: item.numero_serie,
      hostname: null,
      ativo: true,
      ultima_coleta_em: telemetria?.dt_leitura ?? statusRecente?.coletado_em ?? suprimentos?.ultima_coleta ?? null,
      status_atual: telemetria?.status || statusRecente?.status || "unknown",
      contador_paginas_atual: telemetria?.nr_paginas_total ?? null,
      menor_nivel_suprimento: suprimentos?.menor_nivel ?? null,
      resumo_suprimentos: suprimentos?.resumo || [],
      operacional: true,
      origem_linha_id: null,
    };
  });
}

async function loadVisaoGeral(supabase: ReturnType<typeof getAdminClient>, incluirNaoOperacionais: boolean) {
  let operacionais: ImpressoraVisao[] = [];
  const hasImpressoras = await tableExists(supabase, "impressoras");

  if (hasImpressoras) {
    const { data: impressorasRows, error: impressorasError } = await supabase
      .from("impressoras")
      .select("id,patrimonio,ip,setor,localizacao,modelo,fabricante,numero_serie,hostname,ativo,ultima_coleta_em")
      .order("setor", { ascending: true })
      .order("ip", { ascending: true });

    if (impressorasError && !isMissingTableError(impressorasError)) {
      throw new Error(impressorasError.message);
    }

    const impressoras = (impressorasRows || []) as Array<{
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
    }>;

    if (impressoras.length) {
      const ids = impressoras.map((item) => item.id);

      let statusRows: any[] = [];
      let leituraRows: any[] = [];
      let suprimentoRows: any[] = [];

      if (ids.length && (await tableExists(supabase, "telemetria_impressoras"))) {
        const { data, error } = await supabase
          .from("telemetria_impressoras")
          .select("impressora_id,status,coletado_em")
          .in("impressora_id", ids)
          .order("coletado_em", { ascending: false })
          .limit(1000);
        if (error) throw new Error(error.message);
        statusRows = data || [];
      }

      if (ids.length && (await tableExists(supabase, "leituras_paginas_impressoras"))) {
        const { data, error } = await supabase
          .from("leituras_paginas_impressoras")
          .select("impressora_id,contador_total_paginas,coletado_em")
          .eq("valido", true)
          .in("impressora_id", ids)
          .order("coletado_em", { ascending: false })
          .limit(1000);
        if (error) {
          if (!isMissingTableError(error)) {
            throw new Error(error.message);
          }
        } else {
          leituraRows = data || [];
        }
      }

      if (ids.length && (await tableExists(supabase, "suprimentos_impressoras"))) {
        const { data, error } = await supabase
          .from("suprimentos_impressoras")
          .select("impressora_id,coletado_em,chave_suprimento,nome_suprimento,nivel_percentual,status_suprimento")
          .eq("valido", true)
          .in("impressora_id", ids)
          .order("coletado_em", { ascending: false })
          .limit(2000);
        if (error) throw new Error(error.message);
        suprimentoRows = data || [];
      }

      const latestStatus = new Map<string, { status: string; coletado_em: string }>();
      for (const row of statusRows) {
        if (!latestStatus.has(String(row.impressora_id))) {
          latestStatus.set(String(row.impressora_id), {
            status: String(row.status || "unknown"),
            coletado_em: String(row.coletado_em || ""),
          });
        }
      }

      const latestLeitura = new Map<string, { contador_total_paginas: number }>();
      for (const row of leituraRows) {
        if (!latestLeitura.has(String(row.impressora_id))) {
          latestLeitura.set(String(row.impressora_id), {
            contador_total_paginas: Number(row.contador_total_paginas),
          });
        }
      }

      const suprimentosByImpressora = new Map<
        string,
        {
          chaves: Set<string>;
          resumo: Array<{
            chave_suprimento: string;
            nome_suprimento: string;
            nivel_percentual: number | null;
            quantidade_atual: number | null;
            status_suprimento: string;
          }>;
          menor_nivel: number | null;
        }
      >();

      for (const row of suprimentoRows) {
        const id = String(row.impressora_id);
        if (!suprimentosByImpressora.has(id)) {
          suprimentosByImpressora.set(id, {
            chaves: new Set(),
            resumo: [],
            menor_nivel: null,
          });
        }

        const bucket = suprimentosByImpressora.get(id) as {
          chaves: Set<string>;
          resumo: Array<{
            chave_suprimento: string;
            nome_suprimento: string;
            nivel_percentual: number | null;
            status_suprimento: string;
          }>;
          menor_nivel: number | null;
        };

        const chave = String(row.chave_suprimento || "desconhecido");
        if (bucket.chaves.has(chave)) continue;
        bucket.chaves.add(chave);

        const nivel = toFiniteNumber(row.nivel_percentual);
        if (nivel !== null && (bucket.menor_nivel === null || nivel < bucket.menor_nivel)) {
          bucket.menor_nivel = nivel;
        }

        bucket.resumo.push({
          chave_suprimento: chave,
          nome_suprimento: String(row.nome_suprimento || chave),
          nivel_percentual: nivel,
          quantidade_atual: null,
          status_suprimento: normalizarStatusSuprimento(row.status_suprimento, nivel),
        });
      }

      operacionais = impressoras.map((imp) => {
        const status = latestStatus.get(String(imp.id));
        const leitura = latestLeitura.get(String(imp.id));
        const suprimentos = suprimentosByImpressora.get(String(imp.id));

        return {
          id: String(imp.id),
          patrimonio: String(imp.patrimonio || ""),
          ip: normalizarIp(String(imp.ip || "")),
          setor: String(imp.setor || "Sem setor"),
          localizacao: limparTexto(imp.localizacao),
          modelo: String(imp.modelo || "Desconhecido"),
          fabricante: limparTexto(imp.fabricante),
          numero_serie: limparTexto(imp.numero_serie),
          hostname: limparTexto(imp.hostname),
          ativo: Boolean(imp.ativo),
          ultima_coleta_em: limparTexto(imp.ultima_coleta_em),
          status_atual: String(status?.status || "unknown").toLowerCase(),
          contador_paginas_atual: toFiniteNumber(leitura?.contador_total_paginas),
          menor_nivel_suprimento: suprimentos?.menor_nivel ?? null,
          resumo_suprimentos: suprimentos?.resumo || [],
          operacional: true,
          origem_linha_id: null,
        };
      });
    }
  }

  if (!operacionais.length) {
    operacionais = await loadOperacionaisViaInventario(supabase);
  }

  if (!incluirNaoOperacionais) {
    return operacionais;
  }

  const categorias = await loadCategoriasImpressora(supabase);
  if (!categorias.length) return operacionais;

  const hasLinhas = await tableExists(supabase, "linhas_inventario");
  const hasCampos = await tableExists(supabase, "categoria_campos");
  const hasValores = await tableExists(supabase, "linha_valores_campos");
  if (!hasLinhas || !hasCampos || !hasValores) return operacionais;

  const categoriaIds = categorias.map((cat) => String(cat.id));

  const { data: linhasData, error: linhasError } = await supabase
    .from("linhas_inventario")
    .select("id,categoria_id,codigo_linha,observacao,setor,localizacao,ativo")
    .in("categoria_id", categoriaIds)
    .eq("ativo", true)
    .limit(2000);

  if (linhasError) throw new Error(linhasError.message);
  const linhas = (linhasData || []) as LinhaInventario[];
  if (!linhas.length) return operacionais;

  const { data: camposData, error: camposError } = await supabase
    .from("categoria_campos")
    .select("id,categoria_id,tipo_semantico,ativo")
    .in("categoria_id", categoriaIds)
    .eq("ativo", true)
    .in("tipo_semantico", SEMANTICOS_RELEVANTES);

  if (camposError) throw new Error(camposError.message);

  const campoIds = (camposData || []).map((campo) => String(campo.id));
  if (!campoIds.length) return operacionais;

  const { data: valoresData, error: valoresError } = await supabase
    .from("linha_valores_campos")
    .select("linha_id,campo_id,valor_texto,valor_numero,valor_booleano,valor_data,valor_ip,valor_json")
    .in("linha_id", linhas.map((linha) => String(linha.id)))
    .in("campo_id", campoIds);

  if (valoresError) throw new Error(valoresError.message);

  const semByCampo = new Map<string, string>();
  for (const campo of camposData || []) {
    semByCampo.set(String(campo.id), String(campo.tipo_semantico || ""));
  }

  const bagByLinha = new Map<string, Map<string, string>>();
  for (const valor of valoresData || []) {
    const linhaId = String(valor.linha_id);
    const sem = semByCampo.get(String(valor.campo_id));
    if (!sem) continue;

    const texto =
      valor.valor_texto ??
      (valor.valor_numero !== null && valor.valor_numero !== undefined ? String(valor.valor_numero) : null) ??
      (valor.valor_booleano !== null && valor.valor_booleano !== undefined
        ? valor.valor_booleano
          ? "true"
          : "false"
        : null) ??
      valor.valor_data ??
      valor.valor_ip ??
      (valor.valor_json !== null && valor.valor_json !== undefined ? JSON.stringify(valor.valor_json) : null);

    const limpo = limparTexto(texto);
    if (!limpo) continue;

    if (!bagByLinha.has(linhaId)) {
      bagByLinha.set(linhaId, new Map());
    }

    const bag = bagByLinha.get(linhaId) as Map<string, string>;
    if (!bag.has(sem)) {
      bag.set(sem, sem === "ip" || sem === "impressora_ip" ? normalizarIp(limpo) : limpo);
    }
  }

  const patrimonioOperacional = new Set(
    operacionais
      .map((item) => normalizarTexto(item.patrimonio))
      .filter((item) => item.length > 0),
  );

  const ipOperacional = new Set(
    operacionais
      .map((item) => normalizarTexto(normalizarIp(item.ip)))
      .filter((item) => item.length > 0),
  );

  const pendentes: ImpressoraVisao[] = [];

  for (const linha of linhas) {
    const bag = bagByLinha.get(String(linha.id)) || new Map<string, string>();

    const patrimonio = semantico(bag, ["impressora_patrimonio", "patrimonio"]);
    const ip = semantico(bag, ["impressora_ip", "ip"]);
    const modelo = semantico(bag, ["impressora_modelo", "modelo"]);

    const patNorm = normalizarTexto(patrimonio);
    const ipNorm = normalizarTexto(normalizarIp(ip));

    if (!patNorm && !ipNorm) continue;
    if ((patNorm && patrimonioOperacional.has(patNorm)) || (ipNorm && ipOperacional.has(ipNorm))) continue;

    pendentes.push({
      id: `pendente:${linha.id}`,
      patrimonio: patrimonio || "",
      ip: normalizarIp(ip),
      setor: semantico(bag, ["setor"]) || limparTexto(linha.setor) || "Inventario",
      localizacao: semantico(bag, ["localizacao"]) || limparTexto(linha.localizacao),
      modelo: modelo || "",
      fabricante: semantico(bag, ["fabricante"]),
      numero_serie: semantico(bag, ["numero_serie"]),
      hostname: semantico(bag, ["hostname"]),
      ativo: true,
      ultima_coleta_em: null,
      status_atual: "nao_operacional",
      contador_paginas_atual: null,
      menor_nivel_suprimento: null,
      resumo_suprimentos: [],
      operacional: false,
      origem_linha_id: String(linha.id),
    });
  }

  const merged = [...operacionais, ...pendentes].sort((a, b) => {
    if (a.operacional !== b.operacional) return a.operacional ? -1 : 1;
    const setorCmp = String(a.setor || "").localeCompare(String(b.setor || ""));
    if (setorCmp !== 0) return setorCmp;
    return String(a.ip || "").localeCompare(String(b.ip || ""));
  });

  return merged;
}

async function upsertImpressora(
  supabase: ReturnType<typeof getAdminClient>,
  payload: {
    patrimonio?: string | null;
    ip?: string | null;
    setor?: string | null;
    localizacao?: string | null;
    modelo?: string | null;
    fabricante?: string | null;
    numero_serie?: string | null;
    hostname?: string | null;
    endereco_mac?: string | null;
    ativo?: boolean;
  },
) {
  const hasImpressoras = await tableExists(supabase, "impressoras");
  if (!hasImpressoras) {
    throw new Error("Tabela impressoras nao existe no schema atual.");
  }

  const patrimonio = limparTexto(payload.patrimonio);
  const ip = limparTexto(normalizarIp(payload.ip));

  if (!patrimonio && !ip) {
    throw new Error("Informe patrimonio ou IP para identificar a impressora.");
  }

  const insertData = {
    patrimonio,
    ip: ip || "",
    setor: limparTexto(payload.setor) || "Sem setor",
    localizacao: limparTexto(payload.localizacao),
    modelo: limparTexto(payload.modelo) || "Desconhecido",
    fabricante: limparTexto(payload.fabricante),
    numero_serie: limparTexto(payload.numero_serie),
    hostname: limparTexto(payload.hostname),
    endereco_mac: limparTexto(payload.endereco_mac),
    ativo: payload.ativo !== false,
  };

  let existenteId: string | null = null;

  if (patrimonio) {
    const { data, error } = await supabase
      .from("impressoras")
      .select("id")
      .eq("patrimonio", patrimonio)
      .limit(1)
      .maybeSingle();

    if (error && !isMissingTableError(error)) {
      throw new Error(error.message);
    }

    if (data?.id) existenteId = String(data.id);
  }

  if (!existenteId && ip) {
    const { data, error } = await supabase
      .from("impressoras")
      .select("id")
      .eq("ip", ip)
      .limit(1)
      .maybeSingle();

    if (error && !isMissingTableError(error)) {
      throw new Error(error.message);
    }

    if (data?.id) existenteId = String(data.id);
  }

  if (existenteId) {
    const { data, error } = await supabase
      .from("impressoras")
      .update(insertData)
      .eq("id", existenteId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { acao: "atualizado", data };
  }

  const { data, error } = await supabase
    .from("impressoras")
    .insert([insertData])
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return { acao: "criado", data };
}

async function extractPrinterPayloadFromLine(
  supabase: ReturnType<typeof getAdminClient>,
  linhaId: string,
) {
  const ctx = await loadLinhaSemanticMap(supabase, linhaId);
  if (!ctx.linha) {
    throw new Error("Linha de inventario nao encontrada.");
  }

  const bag = ctx.semanticBag;

  const patrimonio = semantico(bag, ["impressora_patrimonio", "patrimonio"]);
  const ip = semantico(bag, ["impressora_ip", "ip"]);
  const modelo = semantico(bag, ["impressora_modelo", "modelo"]);
  const fabricante = semantico(bag, ["fabricante"]);
  const numeroSerie = semantico(bag, ["numero_serie"]);
  const hostname = semantico(bag, ["hostname"]);
  const enderecoMac = semantico(bag, ["endereco_mac"]);
  const setor = semantico(bag, ["setor"]) || limparTexto(ctx.linha.setor) || "Inventario";
  const localizacao = semantico(bag, ["localizacao"]) || limparTexto(ctx.linha.localizacao);

  if (!patrimonio && !ip) {
    throw new Error("Linha sem patrimonio/IP de impressora para sincronizar.");
  }

  return {
    patrimonio,
    ip,
    setor,
    localizacao,
    modelo: modelo || "Desconhecido",
    fabricante,
    numero_serie: numeroSerie,
    hostname,
    endereco_mac: enderecoMac,
    ativo: true,
  };
}

function inicioPeriodoIso(dias: number) {
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - dias + 1);
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}

function chaveBucket(dataIso: string, agrupamento: "dia" | "mes") {
  const dt = new Date(dataIso);
  const ano = dt.getUTCFullYear();
  const mes = String(dt.getUTCMonth() + 1).padStart(2, "0");
  if (agrupamento === "mes") return `${ano}-${mes}`;
  const dia = String(dt.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

async function buscarLeiturasHistoricas(
  supabase: ReturnType<typeof getAdminClient>,
  impressoraIds: string[],
  deIso: string,
  ateIso: string,
) {
  if (!impressoraIds.length) return { rows: [] as any[], truncado: false };

  const hasLeituras = await tableExists(supabase, "leituras_paginas_impressoras");
  if (!hasLeituras) return { rows: [] as any[], truncado: false };

  const pageSize = 1000;
  const maxPaginas = 220;
  const rows: any[] = [];
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
      if (isMissingTableError(error)) {
        return { rows: [] as any[], truncado: false };
      }
      throw new Error(error.message);
    }

    const batch = data || [];
    if (!batch.length) break;
    rows.push(...batch);

    if (batch.length < pageSize) break;
    if (pagina === maxPaginas - 1) truncado = true;
  }

  return { rows, truncado };
}

async function buscarFaixaHistoricaGlobal(supabase: ReturnType<typeof getAdminClient>) {
  const hasLeituras = await tableExists(supabase, "leituras_paginas_impressoras");
  if (!hasLeituras) {
    return { primeira_coleta: null, ultima_coleta: null };
  }

  const [{ data: asc, error: ascError }, { data: desc, error: descError }] = await Promise.all([
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
      .limit(1),
  ]);

  if (ascError || descError) {
    if (isMissingTableError(ascError) || isMissingTableError(descError)) {
      return { primeira_coleta: null, ultima_coleta: null };
    }

    const message = String(ascError?.message || descError?.message || "Erro ao buscar faixa historica.");
    throw new Error(message);
  }

  return {
    primeira_coleta: asc?.[0]?.coletado_em ?? null,
    ultima_coleta: desc?.[0]?.coletado_em ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const action = String(body?.action || "") as Action;
    const payload = body?.payload ?? {};

    if (!action) {
      return badRequest("Action is required");
    }

    const supabase = getAdminClient();

    if (action === "visao_geral") {
      const incluirNaoOperacionais = Boolean(payload?.incluir_nao_operacionais);
      const data = await loadVisaoGeral(supabase, incluirNaoOperacionais);
      return jsonResponse({ ok: true, data });
    }

    if (action === "categorias_opcoes") {
      const ativo = payload?.ativo !== false;
      const hasCategorias = await tableExists(supabase, "categorias_inventario");
      if (!hasCategorias) {
        return jsonResponse({ ok: true, data: [] });
      }

      let query = supabase
        .from("categorias_inventario")
        .select("id,nome,aba_inventario_id,ativo")
        .order("nome", { ascending: true });

      if (ativo) {
        query = query.eq("ativo", true);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return jsonResponse({ ok: true, data: data || [] });
    }

    if (action === "categorias_linhas") {
      const categoriaId = limparTexto(payload?.categoria_id);
      const pagina = Math.max(1, Number(payload?.pagina || 1));
      const limite = clamp(Number(payload?.limite || 100), 1, 1000);

      if (!categoriaId) {
        return badRequest("categoria_id e obrigatorio");
      }

      const hasLinhas = await tableExists(supabase, "linhas_inventario");
      if (!hasLinhas) {
        return jsonResponse({ ok: true, data: { linhas: [], total: 0, pagina, limite } });
      }

      const from = (pagina - 1) * limite;
      const to = from + limite - 1;

      const { data, error, count } = await supabase
        .from("linhas_inventario")
        .select("id,categoria_id,codigo_linha,observacao,setor,localizacao,ativo", { count: "exact" })
        .eq("categoria_id", categoriaId)
        .order("criado_em", { ascending: false })
        .range(from, to);

      if (error) throw new Error(error.message);

      return jsonResponse({
        ok: true,
        data: {
          linhas: (data || []).map((linha) => ({
            id: String(linha.id),
            codigo_linha: linha.codigo_linha ?? null,
            observacao: linha.observacao ?? null,
            setor: linha.setor ?? null,
            localizacao: linha.localizacao ?? null,
            ativo: Boolean(linha.ativo),
          })),
          total: Number(count || 0),
          pagina,
          limite,
        },
      });
    }

    if (action === "linha_valores") {
      const linhaId = limparTexto(payload?.linha_id);
      if (!linhaId) {
        return badRequest("linha_id e obrigatorio");
      }

      const ctx = await loadLinhaSemanticMap(supabase, linhaId);
      if (!ctx.linha || !ctx.campos.length) {
        return jsonResponse({ ok: true, data: [] });
      }

      const valorByCampo = new Map<string, any>();
      for (const valor of ctx.valores) {
        valorByCampo.set(String(valor.campo_id), valor);
      }

      const data = ctx.campos.map((campo) => ({
        campo: {
          id: campo.id,
          nome_campo_exibicao: campo.nome_campo_exibicao,
          chave_campo: campo.chave_campo,
          tipo_semantico: campo.tipo_semantico,
        },
        valor: valorByCampo.get(campo.id) || null,
      }));

      return jsonResponse({ ok: true, data });
    }

    if (action === "add_impressora_manual") {
      const result = await upsertImpressora(supabase, {
        patrimonio: payload?.patrimonio,
        ip: payload?.ip,
        setor: payload?.setor,
        localizacao: payload?.localizacao,
        modelo: payload?.modelo,
        fabricante: payload?.fabricante,
        numero_serie: payload?.numero_serie,
        hostname: payload?.hostname,
        endereco_mac: payload?.endereco_mac,
        ativo: payload?.ativo !== false,
      });

      return jsonResponse({ ok: true, data: result });
    }

    if (action === "tornar_operacional_linha") {
      const linhaId = limparTexto(payload?.linha_id);
      if (!linhaId) {
        return badRequest("linha_id e obrigatorio");
      }

      const printerPayload = await extractPrinterPayloadFromLine(supabase, linhaId);
      const result = await upsertImpressora(supabase, printerPayload);

      return jsonResponse({
        ok: true,
        data: {
          linha_id: linhaId,
          ...result,
        },
      });
    }

    if (action === "sincronizar_operacionais_lote") {
      const limite = clamp(Number(payload?.limite || 200), 1, 2000);

      const categorias = await loadCategoriasImpressora(supabase);
      if (!categorias.length) {
        return jsonResponse({
          ok: true,
          data: {
            total_sincronizadas: 0,
            total_erros: 0,
            mensagem: "Nenhuma categoria de impressora ativa encontrada.",
            erros: [],
          },
        });
      }

      const hasLinhas = await tableExists(supabase, "linhas_inventario");
      if (!hasLinhas) {
        return jsonResponse({
          ok: true,
          data: {
            total_sincronizadas: 0,
            total_erros: 0,
            mensagem: "Tabela linhas_inventario nao existe no schema atual.",
            erros: [],
          },
        });
      }

      const categoriaIds = categorias.map((cat) => String(cat.id));

      const { data: linhas, error: linhasError } = await supabase
        .from("linhas_inventario")
        .select("id")
        .in("categoria_id", categoriaIds)
        .eq("ativo", true)
        .order("criado_em", { ascending: false })
        .limit(limite);

      if (linhasError) throw new Error(linhasError.message);

      const erros: Array<{ linha_id: string; erro: string }> = [];
      let totalSincronizadas = 0;

      for (const linha of linhas || []) {
        try {
          const payloadLinha = await extractPrinterPayloadFromLine(supabase, String(linha.id));
          await upsertImpressora(supabase, payloadLinha);
          totalSincronizadas += 1;
        } catch (error) {
          erros.push({
            linha_id: String(linha.id),
            erro: error instanceof Error ? error.message : "Erro desconhecido",
          });
        }
      }

      return jsonResponse({
        ok: true,
        data: {
          total_sincronizadas: totalSincronizadas,
          total_erros: erros.length,
          mensagem:
            totalSincronizadas > 0
              ? `${totalSincronizadas} impressora(s) sincronizada(s).`
              : "Nenhuma linha sincronizada.",
          erros: erros.slice(0, 20),
        },
      });
    }

    if (action === "dashboard_analitico") {
      const dias = clamp(Number(payload?.dias || 30), 1, HISTORICO_PAGINAS_DIAS_MAX);
      const agrupamento = payload?.agrupamento === "mes" ? "mes" : "dia";
      const setorFiltroRaw = normalizarTexto(payload?.setor || "");
      const localizacaoFiltroRaw = normalizarTexto(payload?.localizacao || "");
      const setorFiltro = ["", "todos", "todas"].includes(setorFiltroRaw) ? "" : setorFiltroRaw;
      const localizacaoFiltro = ["", "todos", "todas"].includes(localizacaoFiltroRaw)
        ? ""
        : localizacaoFiltroRaw;

      const visao = await loadVisaoGeral(supabase, false);
      const operacionais = visao.filter((item) => item.operacional);

      const totalPaginasAcumuladasGeral = operacionais.reduce((acc, item) => {
        const paginas = Number(item.contador_paginas_atual);
        return Number.isFinite(paginas) && paginas > 0 ? acc + paginas : acc;
      }, 0);

      const setoresDisponiveis = Array.from(
        new Set(operacionais.map((item) => limparTexto(item.setor) || "Sem setor")),
      ).sort((a, b) => a.localeCompare(b));

      const localizacoesDisponiveis = Array.from(
        new Set(operacionais.map((item) => limparTexto(item.localizacao) || "Sem localizacao")),
      ).sort((a, b) => a.localeCompare(b));

      const impressorasFiltradas = operacionais.filter((item) => {
        if (setorFiltro && normalizarTexto(item.setor) !== setorFiltro) return false;
        if (localizacaoFiltro && normalizarTexto(item.localizacao || "Sem localizacao") !== localizacaoFiltro) {
          return false;
        }
        return true;
      });

      const totalPaginasAcumuladasFiltro = impressorasFiltradas.reduce((acc, item) => {
        const paginas = Number(item.contador_paginas_atual);
        return Number.isFinite(paginas) && paginas > 0 ? acc + paginas : acc;
      }, 0);

      const online = impressorasFiltradas.filter((item) => normalizarTexto(item.status_atual) === "online").length;
      const offline = impressorasFiltradas.filter((item) => normalizarTexto(item.status_atual) === "offline").length;

      const criticos = impressorasFiltradas.filter((item) => {
        const nivel = Number(item.menor_nivel_suprimento);
        return Number.isFinite(nivel) && nivel <= 10;
      }).length;

      const baixos = impressorasFiltradas.filter((item) => {
        const nivel = Number(item.menor_nivel_suprimento);
        return Number.isFinite(nivel) && nivel > 10 && nivel <= 20;
      }).length;

      const deIso = inicioPeriodoIso(dias);
      const ateIso = new Date().toISOString();
      const impressoraIds = impressorasFiltradas.map((item) => item.id);
      const impressoraMeta = new Map(impressorasFiltradas.map((item) => [item.id, item]));

      const [leituras, faixaHistoricaGlobal] = await Promise.all([
        buscarLeiturasHistoricas(supabase, impressoraIds, deIso, ateIso),
        buscarFaixaHistoricaGlobal(supabase),
      ]);

      const bucketTracker = new Map<string, Map<string, { min: number; max: number }>>();
      const trackerPeriodoPorImpressora = new Map<string, { min: number; max: number }>();

      for (const row of leituras.rows) {
        const paginas = Number(row.contador_total_paginas);
        if (!Number.isFinite(paginas)) continue;

        const bucket = chaveBucket(String(row.coletado_em), agrupamento);
        if (!bucketTracker.has(bucket)) bucketTracker.set(bucket, new Map());

        const porImpressora = bucketTracker.get(bucket) as Map<string, { min: number; max: number }>;
        const atual = porImpressora.get(String(row.impressora_id));

        if (!atual) {
          porImpressora.set(String(row.impressora_id), { min: paginas, max: paginas });
        } else {
          if (paginas < atual.min) atual.min = paginas;
          if (paginas > atual.max) atual.max = paginas;
        }

        const atualPeriodo = trackerPeriodoPorImpressora.get(String(row.impressora_id));
        if (!atualPeriodo) {
          trackerPeriodoPorImpressora.set(String(row.impressora_id), { min: paginas, max: paginas });
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

      const rankingSetoresMap = new Map<string, { setor: string; total_paginas: number; impressoras_ativas: number }>();
      const rankingLocalizacoesMap = new Map<
        string,
        { localizacao: string; total_paginas: number; impressoras_ativas: number }
      >();

      for (const [impressoraId, faixa] of trackerPeriodoPorImpressora.entries()) {
        const delta = Math.max(0, faixa.max - faixa.min);
        if (delta <= 0) continue;

        const meta = impressoraMeta.get(impressoraId);
        const setor = limparTexto(meta?.setor) || "Sem setor";
        const localizacao = limparTexto(meta?.localizacao) || "Sem localizacao";

        if (!rankingSetoresMap.has(setor)) {
          rankingSetoresMap.set(setor, { setor, total_paginas: 0, impressoras_ativas: 0 });
        }
        const setorBucket = rankingSetoresMap.get(setor) as {
          setor: string;
          total_paginas: number;
          impressoras_ativas: number;
        };
        setorBucket.total_paginas += delta;
        setorBucket.impressoras_ativas += 1;

        if (!rankingLocalizacoesMap.has(localizacao)) {
          rankingLocalizacoesMap.set(localizacao, {
            localizacao,
            total_paginas: 0,
            impressoras_ativas: 0,
          });
        }
        const localBucket = rankingLocalizacoesMap.get(localizacao) as {
          localizacao: string;
          total_paginas: number;
          impressoras_ativas: number;
        };
        localBucket.total_paginas += delta;
        localBucket.impressoras_ativas += 1;
      }

      const rankingSetores = Array.from(rankingSetoresMap.values())
        .sort((a, b) => b.total_paginas - a.total_paginas)
        .slice(0, 12);

      const rankingLocalizacoes = Array.from(rankingLocalizacoesMap.values())
        .sort((a, b) => b.total_paginas - a.total_paginas)
        .slice(0, 12);

      const suprimentosDelicados = impressorasFiltradas
        .flatMap((impressora) =>
          (impressora.resumo_suprimentos || []).map((suprimento) => ({
            patrimonio: impressora.patrimonio,
            modelo: impressora.modelo,
            setor: limparTexto(impressora.setor) || "Sem setor",
            localizacao: limparTexto(impressora.localizacao) || "Sem localizacao",
            nome_suprimento: suprimento.nome_suprimento,
            nivel_percentual: toFiniteNumber(suprimento.nivel_percentual),
            status_suprimento: normalizarStatusSuprimento(
              suprimento.status_suprimento,
              toFiniteNumber(suprimento.nivel_percentual),
            ),
          })),
        )
        .filter((item) => item.nivel_percentual !== null && item.nivel_percentual <= 20)
        .sort((a, b) => Number(a.nivel_percentual) - Number(b.nivel_percentual))
        .slice(0, 20);

      return jsonResponse({
        ok: true,
        data: {
          gerado_em: new Date().toISOString(),
          filtros: {
            dias,
            dias_maximo_historico: HISTORICO_PAGINAS_DIAS_MAX,
            agrupamento,
            setor: setorFiltro || "todos",
            localizacao: localizacaoFiltro || "todos",
          },
          setores_disponiveis: setoresDisponiveis,
          localizacoes_disponiveis: localizacoesDisponiveis,
          resumo: {
            total_impressoras: impressorasFiltradas.length,
            online,
            offline,
            suprimentos_criticos: criticos,
            suprimentos_baixos: baixos,
            paginas_acumuladas_total_filtro: totalPaginasAcumuladasFiltro,
            paginas_periodo_total: totalPaginasPeriodo,
            paginas_acumuladas_total_geral: totalPaginasAcumuladasGeral,
          },
          faixa_historica_global: faixaHistoricaGlobal,
          paginas_por_periodo: paginasPorPeriodo,
          ranking_setores: rankingSetores,
          ranking_localizacoes: rankingLocalizacoes,
          suprimentos_delicados: suprimentosDelicados,
          historico_truncado: leituras.truncado,
        },
      });
    }

    return badRequest("Action not supported");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
