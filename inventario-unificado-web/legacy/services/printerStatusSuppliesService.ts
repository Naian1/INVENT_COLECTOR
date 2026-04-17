import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getPrinterById, type ServiceResult } from "@/legacy/services/printerService";
import type { Printer } from "@/legacy/types/printer";

type LatestTelemetry = {
  ingest_id: string;
  collector_id: string;
  status: string;
  response_ms: number | null;
  collected_at: string;
  raw_payload: Record<string, unknown>;
};

type LatestPageRead = {
  ingest_id: string;
  collected_at: string;
  total_pages: number;
  is_valid: boolean;
  invalid_reason: string | null;
  reset_detected: boolean;
};

type LatestSupply = {
  ingest_id: string;
  collected_at: string;
  supply_key: string;
  supply_name: string;
  level_percent: number | null;
  remaining_pages: number | null;
  supply_status: string;
};

export type PrinterStatusSupplies = {
  printer: Printer;
  latest_status: string;
  latest_telemetry: LatestTelemetry | null;
  latest_page_count: number | null;
  latest_page_read: LatestPageRead | null;
  latest_supplies: LatestSupply[];
  open_alerts: Record<string, unknown>[];
};

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isEmptyValue(value: unknown) {
  return value === null || value === undefined || value === "";
}

function isAlertOpen(alert: Record<string, unknown>) {
  if (typeof alert.is_open === "boolean") return alert.is_open;

  if (!isEmptyValue(alert.closed_at)) return false;
  if (!isEmptyValue(alert.resolved_at)) return false;
  if (!isEmptyValue(alert.ended_at)) return false;

  const status = typeof alert.status === "string" ? alert.status.toLowerCase() : null;
  if (status) {
    if (["closed", "resolved", "done", "dismissed"].includes(status)) return false;
    if (["open", "active", "new", "pending"].includes(status)) return true;
  }

  return true;
}

export async function getPrinterStatusSupplies(
  printerId: string
): Promise<ServiceResult<PrinterStatusSupplies>> {
  const printerResult = await getPrinterById(printerId);
  if (!printerResult.success) {
    return printerResult;
  }

  const supabase = getSupabaseServerClient();

  const [
    { data: telemetryRows, error: telemetryError },
    { data: pageReadRows, error: pageReadError },
    { data: supplyRows, error: supplyError },
    { data: alertsRows, error: alertsError }
  ] = await Promise.all([
    supabase
      .from("printer_telemetry")
      .select("ingest_id,collector_id,status,response_ms,collected_at,raw_payload")
      .eq("printer_id", printerId)
      .order("collected_at", { ascending: false })
      .limit(1),
    supabase
      .from("printer_page_reads")
      .select("ingest_id,collected_at,total_pages,is_valid,invalid_reason,reset_detected")
      .eq("printer_id", printerId)
      .eq("is_valid", true)
      .order("collected_at", { ascending: false })
      .limit(1),
    supabase
      .from("printer_supplies")
      .select(
        "ingest_id,collected_at,supply_key,supply_name,level_percent,remaining_pages,supply_status"
      )
      .eq("printer_id", printerId)
      .eq("is_valid", true)
      .order("collected_at", { ascending: false })
      .range(0, 500),
    supabase.from("printer_alerts").select("*").eq("printer_id", printerId).range(0, 200)
  ]);

  if (telemetryError || pageReadError || supplyError) {
    return {
      success: false,
      status: 500,
      error: "Erro ao buscar status e suprimentos da impressora."
    };
  }

  const latestTelemetryRow = telemetryRows?.[0] as LatestTelemetry | undefined;
  const latestPageReadRow = pageReadRows?.[0] as LatestPageRead | undefined;

  const latestSupplies: LatestSupply[] = [];
  if (supplyRows && supplyRows.length > 0) {
    const snapshotCollectedAt = supplyRows[0]?.collected_at;
    for (const row of supplyRows) {
      if (row.collected_at !== snapshotCollectedAt) break;
      latestSupplies.push({
        ingest_id: row.ingest_id,
        collected_at: row.collected_at,
        supply_key: row.supply_key,
        supply_name: row.supply_name,
        level_percent: toFiniteNumber(row.level_percent),
        remaining_pages: toFiniteNumber(row.remaining_pages),
        supply_status: row.supply_status
      });
    }
  }

  let openAlerts: Record<string, unknown>[] = [];
  if (!alertsError && Array.isArray(alertsRows)) {
    openAlerts = alertsRows
      .filter((row) => row && typeof row === "object")
      .map((row) => row as Record<string, unknown>)
      .filter(isAlertOpen);
  }

  return {
    success: true,
    data: {
      printer: printerResult.data,
      latest_status: latestTelemetryRow?.status ?? "unknown",
      latest_telemetry: latestTelemetryRow ?? null,
      latest_page_count: latestPageReadRow ? Number(latestPageReadRow.total_pages) : null,
      latest_page_read: latestPageReadRow ?? null,
      latest_supplies: latestSupplies,
      open_alerts: openAlerts
    }
  };
}
