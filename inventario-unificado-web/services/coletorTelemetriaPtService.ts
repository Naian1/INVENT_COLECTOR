import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { LoteTelemetriaColetorPt } from "@/lib/validation/coletorSchemasPtBr";
// import { upsertImpressoraPorColetor } from "@/services/impressorasService";
import type { ResultadoIngestaoColetor } from "@/types/impressora";

function deveAtualizarUltimaColeta(
  ultimaColetaAtual: string | null,
  candidatoIso: string
) {
  if (!ultimaColetaAtual) return true;
  const atualTs = Date.parse(ultimaColetaAtual);
  const candidatoTs = Date.parse(candidatoIso);
  if (Number.isNaN(candidatoTs)) return false;
  if (Number.isNaN(atualTs)) return true;
  return candidatoTs > atualTs;
}

function normalizarIpSemMascara(ip: string | null | undefined) {
  if (!ip) return null;
  const normalizado = ip.trim();
  if (!normalizado) return null;
  return normalizado.replace(/\/32$/, "");
}

function resolverStatusSuprimento(
  statusExplcito: string | undefined,
  nivelPercentual: number | null | undefined
) {
  if (statusExplcito) return statusExplcito;
  if (nivelPercentual === null || nivelPercentual === undefined) return "unknown";
  if (nivelPercentual <= 0) return "empty";
  if (nivelPercentual <= 5) return "critical";
  if (nivelPercentual <= 15) return "low";
  return "ok";
}

async function gravarEvento(
  coletorId: string,
  evento: LoteTelemetriaColetorPt["eventos"][number],
  coletadoEmPadrao: string
) {
  const supabase = getSupabaseServerClient();
  const coletadoEm = evento.coletado_em ?? coletadoEmPadrao;

  // OLD v2 ENDPOINT - Collector now handles data ingestion directly via Supabase
  /*
  const impressoraResult = await upsertImpressoraPorColetor({
    ip: evento.impressora.ip,
    numero_serie: evento.impressora.numero_serie,
    patrimonio: evento.impressora.patrimonio ?? undefined,
    setor: evento.impressora.setor,
    localizacao: evento.impressora.localizacao,
    modelo: evento.impressora.modelo,
    fabricante: evento.impressora.fabricante,
    hostname: evento.impressora.hostname,
    endereco_mac: evento.impressora.endereco_mac,
    ativo: evento.impressora.ativo
  });

  if (!impressoraResult.success) {
    return { success: false as const, error: impressoraResult.error };
  }
  */
  
  // For now, return success - collector handles DB writes directly
  return { 
    success: true as const,
    gravacoesTelemetria: 0,
    gravacoesLeiturasPaginas: 0,
    gravacoesSuprimentos: 0
  };
}

export async function ingerirTelemetriaColetorPt(
  payload: LoteTelemetriaColetorPt
): Promise<ResultadoIngestaoColetor> {
  const result: ResultadoIngestaoColetor = {
    coletor_id: payload.coletor_id,
    eventos_recebidos: payload.eventos.length,
    eventos_processados: 0,
    gravacoes_telemetria: 0,
    gravacoes_leituras_paginas: 0,
    gravacoes_suprimentos: 0,
    erros: []
  };

  const coletadoEmPadrao = payload.coletado_em ?? new Date().toISOString();

  for (const evento of payload.eventos) {
    const gravacao = await gravarEvento(payload.coletor_id, evento, coletadoEmPadrao);
    
    result.eventos_processados += 1;
    result.gravacoes_telemetria += gravacao.gravacoesTelemetria;
    result.gravacoes_leituras_paginas += gravacao.gravacoesLeiturasPaginas;
    result.gravacoes_suprimentos += gravacao.gravacoesSuprimentos;
  }

  return result;
}
