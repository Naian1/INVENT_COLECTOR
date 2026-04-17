import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ServiceResult } from "@/legacy/services/printerService";

export type PrinterOverviewSupply = {
  supply_key: string;
  supply_name: string;
  level_percent: number | null;
  supply_status: string;
};

export type PrinterOverviewItem = {
  id: string;
  display_name: string | null;
  hostname: string | null;
  sector: string;
  location: string | null;
  asset_tag: string | null;
  serial_number: string | null;
  model: string;
  manufacturer: string | null;
  ip_address: string;
  is_active: boolean;
  last_seen_at: string | null;
  current_status: string;
  latest_page_count: number | null;
  lowest_supply_level: number | null;
  supplies_summary: PrinterOverviewSupply[];
};

type LatestStatusRow = {
  printer_id: string;
  status: string;
  collected_at: string;
};

type LatestPageReadRow = {
  printer_id: string;
  total_pages: number;
  collected_at: string;
};

type SupplyRow = {
  printer_id: string;
  collected_at: string;
  supply_key: string;
  supply_name: string;
  level_percent: number | null;
  supply_status: string;
};

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getPrintersOverview(): Promise<ServiceResult<PrinterOverviewItem[]>> {
  const supabase = getSupabaseServerClient();

  const { data: printers, error: printersError } = await supabase
    .from("printers")
    .select(
      "id,display_name,hostname,sector,location,asset_tag,serial_number,model,manufacturer,ip_address,is_active,last_seen_at"
    )
    .order("sector", { ascending: true })
    .order("ip_address", { ascending: true });

  if (printersError) {
    return {
      success: false,
      status: 500,
      error: "Erro ao buscar impressoras."
    };
  }

  if (!printers || printers.length === 0) {
    return { success: true, data: [] };
  }

  const printerIds = printers.map((printer) => printer.id);

  const [{ data: telemetryRows, error: telemetryError }, { data: pageRows, error: pageError }, { data: supplyRows, error: supplyError }] =
    await Promise.all([
      supabase
        .from("printer_telemetry")
        .select("printer_id,status,collected_at")
        .in("printer_id", printerIds)
        .order("collected_at", { ascending: false })
        .range(0, 50000),
      supabase
        .from("printer_page_reads")
        .select("printer_id,total_pages,collected_at")
        .eq("is_valid", true)
        .in("printer_id", printerIds)
        .order("collected_at", { ascending: false })
        .range(0, 50000),
      supabase
        .from("printer_supplies")
        .select("printer_id,collected_at,supply_key,supply_name,level_percent,supply_status")
        .eq("is_valid", true)
        .in("printer_id", printerIds)
        .order("collected_at", { ascending: false })
        .range(0, 50000)
    ]);

  if (telemetryError || pageError || supplyError) {
    return {
      success: false,
      status: 500,
      error: "Erro ao montar overview operacional das impressoras."
    };
  }

  const latestStatusByPrinter = new Map<string, LatestStatusRow>();
  for (const row of (telemetryRows ?? []) as LatestStatusRow[]) {
    if (!latestStatusByPrinter.has(row.printer_id)) {
      latestStatusByPrinter.set(row.printer_id, row);
    }
  }

  const latestPageByPrinter = new Map<string, LatestPageReadRow>();
  for (const row of (pageRows ?? []) as LatestPageReadRow[]) {
    if (!latestPageByPrinter.has(row.printer_id)) {
      latestPageByPrinter.set(row.printer_id, row);
    }
  }

  const supplySnapshotByPrinter = new Map<
    string,
    { collected_at: string; supplies: PrinterOverviewSupply[]; lowest_supply_level: number | null }
  >();
  for (const row of (supplyRows ?? []) as SupplyRow[]) {
    const current = supplySnapshotByPrinter.get(row.printer_id);
    const normalizedLevel = toFiniteNumber(row.level_percent);

    if (!current) {
      supplySnapshotByPrinter.set(row.printer_id, {
        collected_at: row.collected_at,
        supplies: [
          {
            supply_key: row.supply_key,
            supply_name: row.supply_name,
            level_percent: normalizedLevel,
            supply_status: row.supply_status
          }
        ],
        lowest_supply_level: normalizedLevel
      });
      continue;
    }

    if (current.collected_at !== row.collected_at) {
      continue;
    }

    current.supplies.push({
      supply_key: row.supply_key,
      supply_name: row.supply_name,
      level_percent: normalizedLevel,
      supply_status: row.supply_status
    });

    if (normalizedLevel !== null) {
      if (current.lowest_supply_level === null || normalizedLevel < current.lowest_supply_level) {
        current.lowest_supply_level = normalizedLevel;
      }
    }
  }

  const overview: PrinterOverviewItem[] = printers.map((printer) => {
    const latestStatus = latestStatusByPrinter.get(printer.id);
    const latestPage = latestPageByPrinter.get(printer.id);
    const latestSupplies = supplySnapshotByPrinter.get(printer.id);

    return {
      id: printer.id,
      display_name: printer.display_name,
      hostname: printer.hostname,
      sector: printer.sector,
      location: printer.location ?? null,
      asset_tag: printer.asset_tag,
      serial_number: printer.serial_number,
      model: printer.model,
      manufacturer: printer.manufacturer ?? null,
      ip_address: printer.ip_address,
      is_active: printer.is_active,
      last_seen_at: printer.last_seen_at,
      current_status: latestStatus?.status ?? "unknown",
      latest_page_count: latestPage ? Number(latestPage.total_pages) : null,
      lowest_supply_level: latestSupplies?.lowest_supply_level ?? null,
      supplies_summary: latestSupplies?.supplies ?? []
    };
  });

  return {
    success: true,
    data: overview
  };
}
