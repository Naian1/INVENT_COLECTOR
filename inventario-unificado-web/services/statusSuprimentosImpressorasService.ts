import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  buscarImpressoraPorId,
  type ResultadoServico
} from "@/services/impressorasService";
import type {
  LeituraPaginasImpressora,
  StatusSuprimentosImpressora,
  SuprimentoImpressora,
  TelemetriaImpressora
} from "@/types/impressora";

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isEmptyValue(value: unknown) {
  return value === null || value === undefined || value === "";
}

function isAlertaAberto(alerta: Record<string, unknown>) {
  const status =
    typeof alerta.status_alerta === "string" ? alerta.status_alerta.toLowerCase() : "";
  if (["fechado", "resolvido"].includes(status)) return false;

  if (!isEmptyValue(alerta.fechado_em)) return false;
  if (!isEmptyValue(alerta.resolvido_em)) return false;

  return true;
}

export async function buscarStatusSuprimentosImpressora(
  impressoraId: string
): Promise<ResultadoServico<StatusSuprimentosImpressora>> {
  const impressoraResult = await buscarImpressoraPorId(impressoraId);
  if (!impressoraResult.success) {
    return impressoraResult;
  }

  const supabase = getSupabaseServerClient();

  const [
    { data: telemetriaRows, error: telemetriaError },
    { data: leituraRows, error: leituraError },
    { data: suprimentoRows, error: suprimentoError },
    { data: alertaRows, error: alertaError }
  ] = await Promise.all([
    supabase
      .from("telemetria_impressoras")
      .select("ingestao_id,coletor_id,status,tempo_resposta_ms,coletado_em,payload_bruto")
      .eq("impressora_id", impressoraId)
      .order("coletado_em", { ascending: false })
      .limit(1),
    supabase
      .from("leituras_paginas_impressoras")
      .select("ingestao_id,coletado_em,contador_total_paginas,valido,motivo_invalido,reset_detectado")
      .eq("impressora_id", impressoraId)
      .eq("valido", true)
      .order("coletado_em", { ascending: false })
      .limit(1),
    supabase
      .from("suprimentos_impressoras")
      .select("ingestao_id,coletado_em,chave_suprimento,nome_suprimento,nivel_percentual,paginas_restantes,status_suprimento")
      .eq("impressora_id", impressoraId)
      .eq("valido", true)
      .order("nome_suprimento", { ascending: true })
      .range(0, 200),
    supabase
      .from("alertas_impressoras")
      .select("*")
      .eq("impressora_id", impressoraId)
      .range(0, 200)
  ]);

  if (telemetriaError || leituraError || suprimentoError) {
    return {
      success: false,
      status: 500,
      error: "Erro ao buscar status e suprimentos da impressora."
    };
  }

  const ultimaTelemetriaRow = telemetriaRows?.[0] as
    | {
        ingestao_id: string;
        coletor_id: string;
        status: string;
        tempo_resposta_ms: number | null;
        coletado_em: string;
        payload_bruto: Record<string, unknown>;
      }
    | undefined;

  const ultimaLeituraRow = leituraRows?.[0] as
    | {
        ingestao_id: string;
        coletado_em: string;
        contador_total_paginas: number;
        valido: boolean;
        motivo_invalido: string | null;
        reset_detectado: boolean;
      }
    | undefined;

  const ultimosSuprimentos: SuprimentoImpressora[] = (suprimentoRows ?? []).map((row) => ({
    ingestao_id: row.ingestao_id,
    coletado_em: row.coletado_em,
    chave_suprimento: row.chave_suprimento,
    nome_suprimento: row.nome_suprimento,
    nivel_percentual: toFiniteNumber(row.nivel_percentual),
    paginas_restantes: toFiniteNumber(row.paginas_restantes),
    status_suprimento: row.status_suprimento
  }));

  let alertasAbertos: Record<string, unknown>[] = [];
  if (!alertaError && Array.isArray(alertaRows)) {
    alertasAbertos = alertaRows
      .filter((row) => row && typeof row === "object")
      .map((row) => row as Record<string, unknown>)
      .filter(isAlertaAberto);
  }

  const ultimaTelemetria: TelemetriaImpressora | null = ultimaTelemetriaRow
    ? {
        ingestao_id: ultimaTelemetriaRow.ingestao_id,
        coletor_id: ultimaTelemetriaRow.coletor_id,
        status: ultimaTelemetriaRow.status,
        tempo_resposta_ms: ultimaTelemetriaRow.tempo_resposta_ms,
        coletado_em: ultimaTelemetriaRow.coletado_em,
        payload_bruto: ultimaTelemetriaRow.payload_bruto ?? {}
      }
    : null;

  const ultimaLeitura: LeituraPaginasImpressora | null = ultimaLeituraRow
    ? {
        ingestao_id: ultimaLeituraRow.ingestao_id,
        coletado_em: ultimaLeituraRow.coletado_em,
        contador_total_paginas: Number(ultimaLeituraRow.contador_total_paginas),
        valido: ultimaLeituraRow.valido,
        motivo_invalido: ultimaLeituraRow.motivo_invalido,
        reset_detectado: ultimaLeituraRow.reset_detectado
      }
    : null;

  return {
    success: true,
    data: {
      impressora: impressoraResult.data,
      status_atual: ultimaTelemetria?.status ?? "unknown",
      ultima_telemetria: ultimaTelemetria,
      ultimo_contador_total_paginas: ultimaLeitura
        ? Number(ultimaLeitura.contador_total_paginas)
        : null,
      ultima_leitura_paginas: ultimaLeitura,
      ultimos_suprimentos: ultimosSuprimentos,
      alertas_abertos: alertasAbertos
    }
  };
}
