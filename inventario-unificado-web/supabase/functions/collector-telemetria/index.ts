// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

type EventoNormalizado = {
  ingestao_id: string;
  coletado_em: string;
  status: string;
  tempo_resposta_ms: number | null;
  payload_bruto: JsonRecord;
  contador_total_paginas: number | null;
  impressora: {
    ip: string | null;
    patrimonio: string | null;
    numero_serie: string | null;
    setor: string | null;
    localizacao: string | null;
    modelo: string | null;
    fabricante: string | null;
    hostname: string | null;
    endereco_mac: string | null;
    ativo: boolean;
  };
  suprimentos: Array<{
    chave_suprimento: string;
    nome_suprimento: string;
    nivel_percentual: number | null;
    status_suprimento: string;
    paginas_restantes: number | null;
    payload_bruto: JsonRecord;
  }>;
};

type LoteNormalizado = {
  coletor_id: string;
  coletado_em: string;
  eventos: EventoNormalizado[];
};

type Capacidades = {
  impressoras: boolean;
  telemetria_impressoras: boolean;
  leituras_paginas_impressoras: boolean;
  suprimentos_impressoras: boolean;
  inventario: boolean;
  telemetria_pagecount: boolean;
  suprimentos: boolean;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

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

function normalizeIp(ip: unknown): string | null {
  if (typeof ip !== "string") return null;
  const clean = ip.trim();
  if (!clean) return null;
  return clean.replace(/\/32$/, "");
}

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function cleanStatus(value: unknown): string {
  const status = String(value ?? "").trim().toLowerCase();
  if (["online", "offline", "warning", "error", "unknown"].includes(status)) return status;
  return "unknown";
}

function cleanSupplyStatus(value: unknown, level: number | null): string {
  const status = String(value ?? "").trim().toLowerCase();
  if (["ok", "low", "critical", "empty", "unknown", "offline"].includes(status)) return status;
  if (level === null) return "unknown";
  if (level <= 0) return "empty";
  if (level <= 5) return "critical";
  if (level <= 15) return "low";
  return "ok";
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toIntegerOrNull(value: unknown): number | null {
  const n = toNumberOrNull(value);
  if (n === null) return null;
  return Math.trunc(n);
}

function ensureIso(value: unknown, fallbackIso: string): string {
  const text = cleanText(value);
  if (!text) return fallbackIso;
  const ts = Date.parse(text);
  if (Number.isNaN(ts)) return fallbackIso;
  return new Date(ts).toISOString();
}

function tokenFromAuthHeader(header: string | null): string | null {
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

function validateCollectorAuth(req: Request): string | null {
  const expectedToken = cleanText(Deno.env.get("COLLECTOR_API_TOKEN"));
  if (!expectedToken) return "COLLECTOR_API_TOKEN not configured in Edge Function";

  const receivedToken = tokenFromAuthHeader(req.headers.get("authorization"));
  if (!receivedToken) return "Authorization header must be Bearer <token>";

  if (receivedToken !== expectedToken) return "Invalid collector token";
  return null;
}

function normalizePayload(body: unknown): { data?: LoteNormalizado; error?: string } {
  const nowIso = new Date().toISOString();
  if (!body || typeof body !== "object") {
    return { error: "Invalid payload. Expected JSON object." };
  }

  const record = body as Record<string, unknown>;
  const coletorId = cleanText(record.coletor_id);
  if (!coletorId) {
    return { error: "coletor_id is required" };
  }

  const loteColetadoEm = ensureIso(record.coletado_em, nowIso);

  const toEvento = (item: Record<string, unknown>): EventoNormalizado => {
    const ingestaoId = cleanText(item.ingestao_id) ?? `evt-${crypto.randomUUID()}`;
    const coletadoEm = ensureIso(item.coletado_em, loteColetadoEm);
    const status = cleanStatus(item.status);
    const tempoResposta = toIntegerOrNull(item.tempo_resposta_ms);
    const payloadBruto =
      item.payload_bruto && typeof item.payload_bruto === "object"
        ? (item.payload_bruto as JsonRecord)
        : {};

    const impressoraRaw =
      item.impressora && typeof item.impressora === "object"
        ? (item.impressora as Record<string, unknown>)
        : {};

    const contadorTotalPaginas = toIntegerOrNull(
      item.contador_total_paginas ??
        (
          item.leitura_paginas &&
          typeof item.leitura_paginas === "object" &&
          (item.leitura_paginas as Record<string, unknown>).contador_total_paginas
        )
    );

    const suprimentosRaw = Array.isArray(item.suprimentos) ? item.suprimentos : [];
    const suprimentos = suprimentosRaw
      .filter((s) => s && typeof s === "object")
      .map((s) => {
        const sup = s as Record<string, unknown>;
        const nome = cleanText(sup.nome_suprimento) ?? "Suprimento";
        const chaveNormalizada = nome
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");

        const chave = cleanText(sup.chave_suprimento) ?? (chaveNormalizada || "suprimento");

        const nivel = toNumberOrNull(sup.nivel_percentual);
        const payload =
          sup.payload_bruto && typeof sup.payload_bruto === "object"
            ? (sup.payload_bruto as JsonRecord)
            : {};

        return {
          chave_suprimento: chave,
          nome_suprimento: nome,
          nivel_percentual: nivel,
          status_suprimento: cleanSupplyStatus(sup.status_suprimento, nivel),
          paginas_restantes: toIntegerOrNull(sup.paginas_restantes),
          payload_bruto: payload,
        };
      });

    return {
      ingestao_id: ingestaoId,
      coletado_em: coletadoEm,
      status,
      tempo_resposta_ms: tempoResposta,
      payload_bruto: payloadBruto,
      contador_total_paginas: contadorTotalPaginas,
      impressora: {
        ip: normalizeIp(impressoraRaw.ip),
        patrimonio: cleanText(impressoraRaw.patrimonio),
        numero_serie: cleanText(impressoraRaw.numero_serie),
        setor: cleanText(impressoraRaw.setor),
        localizacao: cleanText(impressoraRaw.localizacao),
        modelo: cleanText(impressoraRaw.modelo),
        fabricante: cleanText(impressoraRaw.fabricante),
        hostname: cleanText(impressoraRaw.hostname),
        endereco_mac: cleanText(impressoraRaw.endereco_mac),
        ativo: impressoraRaw.ativo !== false,
      },
      suprimentos,
    };
  };

  if (Array.isArray(record.eventos)) {
    if (!record.eventos.length) return { error: "eventos must have at least one item" };
    const eventos = record.eventos
      .filter((evt) => evt && typeof evt === "object")
      .map((evt) => toEvento(evt as Record<string, unknown>));

    if (!eventos.length) return { error: "eventos does not contain valid objects" };

    return {
      data: {
        coletor_id: coletorId,
        coletado_em: loteColetadoEm,
        eventos,
      },
    };
  }

  const eventoUnico = toEvento(record);
  return {
    data: {
      coletor_id: coletorId,
      coletado_em: loteColetadoEm,
      eventos: [eventoUnico],
    },
  };
}

async function tableExists(supabase: ReturnType<typeof getAdminClient>, table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(1);
  if (!error) return true;
  const pgCode = String((error as { code?: string }).code ?? "").trim();
  const message = String((error as { message?: string }).message ?? "");
  if (
    pgCode === "PGRST205" ||
    /relation .* does not exist/i.test(message) ||
    /Could not find the table/i.test(message)
  ) {
    return false;
  }
  throw new Error(`Failed to check table '${table}': ${message}`);
}

async function carregarCapacidades(supabase: ReturnType<typeof getAdminClient>): Promise<Capacidades> {
  return {
    impressoras: await tableExists(supabase, "impressoras"),
    telemetria_impressoras: await tableExists(supabase, "telemetria_impressoras"),
    leituras_paginas_impressoras: await tableExists(supabase, "leituras_paginas_impressoras"),
    suprimentos_impressoras: await tableExists(supabase, "suprimentos_impressoras"),
    inventario: await tableExists(supabase, "inventario"),
    telemetria_pagecount: await tableExists(supabase, "telemetria_pagecount"),
    suprimentos: await tableExists(supabase, "suprimentos"),
  };
}

async function encontrarImpressoraPorIdentificador(
  supabase: ReturnType<typeof getAdminClient>,
  impressora: EventoNormalizado["impressora"],
) {
  if (impressora.patrimonio) {
    const { data } = await supabase
      .from("impressoras")
      .select("id,ultima_coleta_em")
      .ilike("patrimonio", impressora.patrimonio)
      .maybeSingle();
    if (data?.id) return data;
  }

  if (impressora.numero_serie) {
    const { data } = await supabase
      .from("impressoras")
      .select("id,ultima_coleta_em")
      .ilike("numero_serie", impressora.numero_serie)
      .maybeSingle();
    if (data?.id) return data;
  }

  if (impressora.ip) {
    const { data } = await supabase
      .from("impressoras")
      .select("id,ultima_coleta_em")
      .eq("ip", impressora.ip)
      .maybeSingle();
    if (data?.id) return data;
  }

  return null;
}

async function resolveImpressoraIdLegacy(
  supabase: ReturnType<typeof getAdminClient>,
  evento: EventoNormalizado,
): Promise<string> {
  const impressora = evento.impressora;
  const existente = await encontrarImpressoraPorIdentificador(supabase, impressora);

  const payloadComum = {
    ip: impressora.ip,
    patrimonio: impressora.patrimonio,
    setor: impressora.setor ?? "Desconhecido",
    localizacao: impressora.localizacao,
    modelo: impressora.modelo ?? "Desconhecido",
    fabricante: impressora.fabricante,
    numero_serie: impressora.numero_serie,
    hostname: impressora.hostname,
    endereco_mac: impressora.endereco_mac,
    ativo: impressora.ativo,
    ultima_coleta_em: evento.coletado_em,
  };

  if (existente?.id) {
    await supabase.from("impressoras").update(payloadComum).eq("id", existente.id);
    return String(existente.id);
  }

  const patrimonioAuto =
    impressora.patrimonio ??
    `AUTO-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const insertPayload = {
    ...payloadComum,
    ip: impressora.ip ?? "0.0.0.0",
    patrimonio: patrimonioAuto,
  };

  const { data, error } = await supabase
    .from("impressoras")
    .insert([insertPayload])
    .select("id")
    .single();

  if (!error && data?.id) {
    return String(data.id);
  }

  const retry = await encontrarImpressoraPorIdentificador(supabase, {
    ...impressora,
    patrimonio: patrimonioAuto,
  });

  if (retry?.id) return String(retry.id);

  throw new Error(`Could not resolve printer in table impressoras: ${String(error?.message ?? "unknown")}`);
}

async function resolveInventarioId(
  supabase: ReturnType<typeof getAdminClient>,
  evento: EventoNormalizado,
): Promise<number | null> {
  const p = evento.impressora;

  if (p.patrimonio) {
    const { data } = await supabase
      .from("inventario")
      .select("nr_inventario")
      .ilike("nr_patrimonio", p.patrimonio)
      .eq("ie_situacao", "A")
      .maybeSingle();
    if (data?.nr_inventario) return Number(data.nr_inventario);
  }

  if (p.numero_serie) {
    const { data } = await supabase
      .from("inventario")
      .select("nr_inventario")
      .ilike("nr_serie", p.numero_serie)
      .eq("ie_situacao", "A")
      .maybeSingle();
    if (data?.nr_inventario) return Number(data.nr_inventario);
  }

  if (p.ip) {
    const { data } = await supabase
      .from("inventario")
      .select("nr_inventario")
      .eq("nr_ip", p.ip)
      .eq("ie_situacao", "A")
      .maybeSingle();
    if (data?.nr_inventario) return Number(data.nr_inventario);
  }

  return null;
}

async function gravarTelemetriaLegacy(
  supabase: ReturnType<typeof getAdminClient>,
  evento: EventoNormalizado,
  coletorId: string,
  impressoraId: string,
) {
  const payload = {
    impressora_id: impressoraId,
    patrimonio: evento.impressora.patrimonio,
    ip: evento.impressora.ip,
    coletor_id: coletorId,
    ingestao_id: evento.ingestao_id,
    coletado_em: evento.coletado_em,
    status: evento.status,
    tempo_resposta_ms: evento.tempo_resposta_ms,
    payload_bruto: evento.payload_bruto,
  };

  const { error } = await supabase
    .from("telemetria_impressoras")
    .upsert([payload], { onConflict: "coletor_id,ingestao_id", ignoreDuplicates: false });

  if (error) throw new Error(`telemetria_impressoras: ${error.message}`);
}

async function gravarLeituraLegacy(
  supabase: ReturnType<typeof getAdminClient>,
  evento: EventoNormalizado,
  coletorId: string,
  impressoraId: string,
) {
  if (evento.contador_total_paginas === null) return;

  const payload = {
    impressora_id: impressoraId,
    patrimonio: evento.impressora.patrimonio,
    ip: evento.impressora.ip,
    coletor_id: coletorId,
    ingestao_id: evento.ingestao_id,
    coletado_em: evento.coletado_em,
    contador_total_paginas: Math.max(0, evento.contador_total_paginas),
    valido: true,
    motivo_invalido: null,
    reset_detectado: false,
    payload_bruto: evento.payload_bruto,
  };

  const { error } = await supabase
    .from("leituras_paginas_impressoras")
    .upsert([payload], { onConflict: "coletor_id,ingestao_id", ignoreDuplicates: false });

  if (error) throw new Error(`leituras_paginas_impressoras: ${error.message}`);
}

async function gravarSuprimentosLegacy(
  supabase: ReturnType<typeof getAdminClient>,
  evento: EventoNormalizado,
  coletorId: string,
  impressoraId: string,
) {
  if (!evento.suprimentos.length) return;

  const rows = evento.suprimentos.map((sup) => ({
    impressora_id: impressoraId,
    patrimonio: evento.impressora.patrimonio,
    ip: evento.impressora.ip,
    coletor_id: coletorId,
    ingestao_id: evento.ingestao_id,
    coletado_em: evento.coletado_em,
    chave_suprimento: sup.chave_suprimento,
    nome_suprimento: sup.nome_suprimento,
    nivel_percentual: sup.nivel_percentual,
    paginas_restantes: sup.paginas_restantes,
    status_suprimento: sup.status_suprimento,
    valido: true,
    payload_bruto: sup.payload_bruto,
  }));

  const { error } = await supabase
    .from("suprimentos_impressoras")
    .upsert(rows, { onConflict: "impressora_id,chave_suprimento", ignoreDuplicates: false });

  if (error) throw new Error(`suprimentos_impressoras: ${error.message}`);
}

async function gravarTelemetriaPagecount(
  supabase: ReturnType<typeof getAdminClient>,
  evento: EventoNormalizado,
  inventarioId: number,
) {
  if (evento.contador_total_paginas === null) return;

  const payload = {
    nr_inventario: inventarioId,
    nr_paginas_total: Math.max(0, evento.contador_total_paginas),
    dt_leitura: evento.coletado_em,
    ds_status_impressora: evento.status,
    ds_observacao: null,
  };

  const { error } = await supabase.from("telemetria_pagecount").insert([payload]);
  if (error) throw new Error(`telemetria_pagecount: ${error.message}`);
}

function isMissingColumnError(message: string): boolean {
  return /column .* does not exist/i.test(message) || /Could not find the .* column/i.test(message);
}

function isMissingTableErrorMessage(message: string): boolean {
  return /relation .* does not exist/i.test(message) || /Could not find the table/i.test(message);
}

async function gravarSuprimentosNovoOuLegado(
  supabase: ReturnType<typeof getAdminClient>,
  evento: EventoNormalizado,
  inventarioId: number,
) {
  if (!evento.suprimentos.length) return;

  for (const sup of evento.suprimentos) {
    const nivel = sup.nivel_percentual === null ? 0 : Math.max(0, Math.round(sup.nivel_percentual));

    const payloadLegado = {
      nr_inventario: inventarioId,
      cd_tipo_suprimento: sup.nome_suprimento,
      nr_quantidade: nivel,
      ds_status_suprimento: sup.status_suprimento,
      ds_status_impressora: evento.status,
      dt_coleta: evento.coletado_em,
    };

    const attemptLegacy = await supabase
      .from("suprimentos")
      .upsert([payloadLegado], { onConflict: "nr_inventario,cd_tipo_suprimento", ignoreDuplicates: false });

    if (!attemptLegacy.error) continue;

    const legacyMsg = String(attemptLegacy.error.message || "");
    if (!isMissingColumnError(legacyMsg)) {
      throw new Error(`suprimentos (legacy): ${legacyMsg}`);
    }

    const payloadNovo = {
      nr_inventario: inventarioId,
      tp_suprimento: sup.nome_suprimento,
      nr_quantidade: nivel,
      ds_suprimento: sup.status_suprimento,
      ie_situacao: "A",
    };

    const attemptNovo = await supabase
      .from("suprimentos")
      .upsert([payloadNovo], { onConflict: "nr_inventario,tp_suprimento", ignoreDuplicates: false });

    if (attemptNovo.error) {
      throw new Error(`suprimentos (novo): ${attemptNovo.error.message}`);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ sucesso: false, erro: "Method not allowed" }, 405);
  }

  const authError = validateCollectorAuth(req);
  if (authError) {
    return jsonResponse({ sucesso: false, erro: authError }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ sucesso: false, erro: "Invalid JSON body" }, 400);
  }

  const normalized = normalizePayload(body);
  if (normalized.error || !normalized.data) {
    return jsonResponse({ sucesso: false, erro: normalized.error ?? "Invalid payload" }, 400);
  }

  const lote = normalized.data;

  try {
    const supabase = getAdminClient();
    const caps = await carregarCapacidades(supabase);

    const result = {
      coletor_id: lote.coletor_id,
      eventos_recebidos: lote.eventos.length,
      eventos_processados: 0,
      gravacoes_telemetria: 0,
      gravacoes_leituras_paginas: 0,
      gravacoes_suprimentos: 0,
      erros: [] as Array<{ ingestao_id: string; erro: string }>,
      modo_gravacao: caps,
    };

    for (const evento of lote.eventos) {
      try {
        let impressoraIdLegacy: string | null = null;
        let inventarioId: number | null = null;

        if (caps.impressoras) {
          try {
            impressoraIdLegacy = await resolveImpressoraIdLegacy(supabase, evento);
          } catch (legacyError) {
            const message = legacyError instanceof Error ? legacyError.message : String(legacyError);
            if (!isMissingTableErrorMessage(message)) {
              throw legacyError;
            }
            impressoraIdLegacy = null;
          }
        }

        if (caps.inventario) {
          inventarioId = await resolveInventarioId(supabase, evento);
        }

        if (caps.telemetria_impressoras && impressoraIdLegacy) {
          await gravarTelemetriaLegacy(supabase, evento, lote.coletor_id, impressoraIdLegacy);
          result.gravacoes_telemetria += 1;
        }

        if (caps.leituras_paginas_impressoras && impressoraIdLegacy && evento.contador_total_paginas !== null) {
          await gravarLeituraLegacy(supabase, evento, lote.coletor_id, impressoraIdLegacy);
          result.gravacoes_leituras_paginas += 1;
        }

        if (caps.suprimentos_impressoras && impressoraIdLegacy && evento.suprimentos.length) {
          await gravarSuprimentosLegacy(supabase, evento, lote.coletor_id, impressoraIdLegacy);
          result.gravacoes_suprimentos += evento.suprimentos.length;
        }

        if (caps.telemetria_pagecount && inventarioId !== null && evento.contador_total_paginas !== null) {
          await gravarTelemetriaPagecount(supabase, evento, inventarioId);
          result.gravacoes_leituras_paginas += 1;
        }

        if (caps.suprimentos && inventarioId !== null && evento.suprimentos.length) {
          await gravarSuprimentosNovoOuLegado(supabase, evento, inventarioId);
          result.gravacoes_suprimentos += evento.suprimentos.length;
        }

        if (!caps.telemetria_impressoras && !caps.telemetria_pagecount) {
          throw new Error("No telemetry table available (telemetria_impressoras or telemetria_pagecount)");
        }

        result.eventos_processados += 1;
      } catch (eventError) {
        const message = eventError instanceof Error ? eventError.message : String(eventError);
        result.erros.push({ ingestao_id: evento.ingestao_id, erro: message });
      }
    }

    if (result.eventos_processados === 0) {
      return jsonResponse({ sucesso: false, erro: "No events processed", dados: result }, 422);
    }

    if (result.erros.length > 0) {
      return jsonResponse({ sucesso: false, erro: "Partial processing failure", dados: result }, 207);
    }

    return jsonResponse({ sucesso: true, dados: result }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ sucesso: false, erro: message }, 500);
  }
});
