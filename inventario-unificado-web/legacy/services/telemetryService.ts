/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\legacy\services\telemetryService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CollectorTelemetryEvent,
  CollectorTelemetryBatchPayload
} from "@/legacy/lib/validation/collectorSchemas";
import { upsertPrinterFromCollector } from "@/legacy/services/printerService";

type TelemetryIngestResult = {
  collector_id: string;
  received_events: number;
  processed_events: number;
  telemetry_writes: number;
  page_read_writes: number;
  supplies_writes: number;
  errors: Array<{ ingest_id: string; error: string }>;
};

/**
 * [DOC-FUNC] shouldRefreshLastSeen
 * O que faz: Normaliza entradas na funcao 'shouldRefreshLastSeen', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: currentLastSeenAt, candidateIso; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
 */
function shouldRefreshLastSeen(currentLastSeenAt: string | null, candidateIso: string) {
  if (!currentLastSeenAt) return true;
  const currentTs = Date.parse(currentLastSeenAt);
  const candidateTs = Date.parse(candidateIso);
  if (Number.isNaN(candidateTs)) return false;
  if (Number.isNaN(currentTs)) return true;
  return candidateTs > currentTs;
}

/**
 * [DOC-FUNC] resolveSupplyStatus
 * O que faz: Executa a responsabilidade central da funcao 'resolveSupplyStatus', conectando validacao, processamento e retorno de forma didatica.
 * Entradas: Parametros esperados: explicitStatus, levelPercent; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora com contrato claro de sucesso e falha.
 */
function resolveSupplyStatus(
  explicitStatus: string | undefined,
  levelPercent: number | null | undefined
) {
  if (explicitStatus) return explicitStatus;
  if (levelPercent === null || levelPercent === undefined) return "unknown";
  if (levelPercent <= 0) return "empty";
  if (levelPercent <= 5) return "critical";
  if (levelPercent <= 15) return "low";
  return "ok";
}

/**
 * [DOC-FUNC] writeTelemetryEvent
 * O que faz: Atualiza estado na funcao 'writeTelemetryEvent', mantendo coerencia entre dados atuais e alteracoes recebidas.
 * Entradas: Parametros esperados: collectorId, event, defaultCollectedAt; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; padroniza campos para evitar divergencia de formato; itera listas/objetos para consolidar calculos e mapeamentos; executa escrita/atualizacao de forma controlada.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
 */
async function writeTelemetryEvent(
  collectorId: string,
  event: CollectorTelemetryEvent,
  defaultCollectedAt: string
) {
  const supabase = getSupabaseServerClient();
  const collectedAt = event.collected_at ?? defaultCollectedAt;

  const printerResult = await upsertPrinterFromCollector(event.printer);
  if (!printerResult.success) {
    return {
      success: false as const,
      error: printerResult.error
    };
  }

  const printer = printerResult.data;

  const telemetryIngestId = `${event.ingest_id}:telemetry`;

  const { error: telemetryError } = await supabase.from("printer_telemetry").upsert(
    {
      printer_id: printer.id,
      collector_id: collectorId,
      ingest_id: telemetryIngestId,
      collected_at: collectedAt,
      status: event.status ?? "unknown",
      response_ms: event.response_ms ?? null,
      raw_payload: event.raw_payload ?? {}
    },
    {
      onConflict: "collector_id,ingest_id",
      ignoreDuplicates: true
    }
  );

  if (telemetryError) {
    return {
      success: false as const,
      error: telemetryError.message
    };
  }

  if (shouldRefreshLastSeen(printer.last_seen_at, collectedAt)) {
    await supabase
      .from("printers")
      .update({ last_seen_at: collectedAt })
      .eq("id", printer.id);
  }

  let pageReadWrites = 0;
  const normalizedPageRead =
    event.page_read ??
    (event.page_count_total !== undefined
      ? {
          total_pages: event.page_count_total,
          is_valid: true,
          reset_detected: false
        }
      : undefined);

  if (normalizedPageRead) {
    const pageReadIngestId = normalizedPageRead.ingest_id ?? `${event.ingest_id}:page_read`;

    const { error: pageReadError } = await supabase.from("printer_page_reads").upsert(
      {
        printer_id: printer.id,
        collector_id: collectorId,
        ingest_id: pageReadIngestId,
        collected_at: collectedAt,
        total_pages: normalizedPageRead.total_pages,
        is_valid: normalizedPageRead.is_valid ?? true,
        invalid_reason: normalizedPageRead.invalid_reason ?? null,
        reset_detected: normalizedPageRead.reset_detected ?? false
      },
      {
        onConflict: "collector_id,ingest_id",
        ignoreDuplicates: true
      }
    );

    if (pageReadError) {
      return {
        success: false as const,
        error: pageReadError.message
      };
    }
    pageReadWrites = 1;
  }

  let suppliesWrites = 0;
  if (event.supplies.length > 0) {
    const supplyRows = event.supplies.map((supply, index) => ({
      printer_id: printer.id,
      collector_id: collectorId,
      ingest_id: supply.ingest_id ?? `${event.ingest_id}:supply:${index}:${supply.supply_key}`,
      collected_at: collectedAt,
      supply_key: supply.supply_key,
      supply_name: supply.supply_name,
      level_percent: supply.level_percent ?? null,
      remaining_pages: supply.remaining_pages ?? null,
      supply_status: resolveSupplyStatus(supply.supply_status, supply.level_percent),
      is_valid: supply.is_valid ?? true,
      raw_payload: supply.raw_payload ?? {}
    }));

    const { error: suppliesError } = await supabase.from("printer_supplies").upsert(supplyRows, {
      onConflict: "collector_id,ingest_id",
      ignoreDuplicates: true
    });

    if (suppliesError) {
      return {
        success: false as const,
        error: suppliesError.message
      };
    }
    suppliesWrites = supplyRows.length;
  }

  return {
    success: true as const,
    telemetryWrites: 1,
    pageReadWrites,
    suppliesWrites
  };
}

/**
 * [DOC-FUNC] ingestCollectorTelemetry
 * O que faz: Normaliza entradas na funcao 'ingestCollectorTelemetry', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: payload; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato; itera listas/objetos para consolidar calculos e mapeamentos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
 */
export async function ingestCollectorTelemetry(
  payload: CollectorTelemetryBatchPayload
): Promise<TelemetryIngestResult> {
  const result: TelemetryIngestResult = {
    collector_id: payload.collector_id,
    received_events: payload.events.length,
    processed_events: 0,
    telemetry_writes: 0,
    page_read_writes: 0,
    supplies_writes: 0,
    errors: []
  };

  const defaultCollectedAt = payload.collected_at ?? new Date().toISOString();

  for (const event of payload.events) {
    const ingestResult = await writeTelemetryEvent(
      payload.collector_id,
      event,
      defaultCollectedAt
    );

    if (!ingestResult.success) {
      result.errors.push({
        ingest_id: event.ingest_id,
        error: ingestResult.error
      });
      continue;
    }

    result.processed_events += 1;
    result.telemetry_writes += ingestResult.telemetryWrites;
    result.page_read_writes += ingestResult.pageReadWrites;
    result.supplies_writes += ingestResult.suppliesWrites;
  }

  return result;
}

