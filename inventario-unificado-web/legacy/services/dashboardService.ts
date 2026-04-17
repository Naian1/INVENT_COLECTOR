import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getPrintersOverview } from "@/legacy/services/printerOverviewService";

type DashboardSummary = {
  generated_at: string;
  total_printers: number;
  active_printers: number;
  online_printers: number;
  offline_printers: number;
  low_or_critical_supplies: number;
  pages_printed_current_month: number;
};

function getMonthStartIsoUtc(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function getPagesPrintedCurrentMonth(nowIso: string) {
  const supabase = getSupabaseServerClient();
  const monthStartIso = getMonthStartIsoUtc(new Date(nowIso));

  const { data, error } = await supabase
    .from("printer_page_reads")
    .select("printer_id,total_pages")
    .eq("is_valid", true)
    .gte("collected_at", monthStartIso)
    .lte("collected_at", nowIso);

  if (error || !data) return 0;

  const tracker = new Map<string, { min: number; max: number }>();

  for (const row of data) {
    const pages = Number(row.total_pages);
    if (!Number.isFinite(pages)) continue;

    const current = tracker.get(row.printer_id);
    if (!current) {
      tracker.set(row.printer_id, { min: pages, max: pages });
      continue;
    }

    if (pages < current.min) current.min = pages;
    if (pages > current.max) current.max = pages;
  }

  let totalPrinted = 0;
  for (const item of tracker.values()) {
    totalPrinted += Math.max(0, item.max - item.min);
  }

  return totalPrinted;
}

async function getOperationalCountersFromOverview() {
  const overview = await getPrintersOverview();
  if (!overview.success) {
    return {
      online: 0,
      offline: 0,
      lowOrCritical: 0
    };
  }

  let online = 0;
  let offline = 0;
  let lowOrCritical = 0;

  for (const printer of overview.data) {
    if (printer.current_status === "online") online += 1;
    if (printer.current_status === "offline") offline += 1;

    const hasLowFromLevel =
      printer.lowest_supply_level !== null && Number.isFinite(printer.lowest_supply_level)
        ? printer.lowest_supply_level <= 15
        : false;
    const hasLowFromStatus = printer.supplies_summary.some((supply) =>
      ["low", "critical", "empty"].includes((supply.supply_status ?? "").toLowerCase())
    );

    if (hasLowFromLevel || hasLowFromStatus) lowOrCritical += 1;
  }

  return { online, offline, lowOrCritical };
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const [{ count: totalPrinters }, { count: activePrinters }, operationalCounters, monthPages] =
    await Promise.all([
      supabase.from("printers").select("*", { count: "exact", head: true }),
      supabase.from("printers").select("*", { count: "exact", head: true }).eq("is_active", true),
      getOperationalCountersFromOverview(),
      getPagesPrintedCurrentMonth(nowIso)
    ]);

  return {
    generated_at: nowIso,
    total_printers: totalPrinters ?? 0,
    active_printers: activePrinters ?? 0,
    online_printers: operationalCounters.online,
    offline_printers: operationalCounters.offline,
    low_or_critical_supplies: operationalCounters.lowOrCritical,
    pages_printed_current_month: monthPages
  };
}
