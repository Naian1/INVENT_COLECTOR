import { buildPrinterDisplayName, sanitizeOptionalText } from "@/lib/printers/naming";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { CreatePrinterInput, Printer, UpdatePrinterInput } from "@/legacy/types/printer";

const PRINTER_COLUMNS =
  "id, display_name, hostname, sector, location, asset_tag, serial_number, model, manufacturer, ip_address, mac_address, is_active, created_at, updated_at, last_seen_at";

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; status?: number };

function normalizeSupabaseError(message: string) {
  if (message.includes("uq_printers_ip_address")) {
    return { message: "Ja existe uma impressora com este IP.", status: 409 };
  }
  if (message.includes("uq_printers_asset_tag_not_null")) {
    return { message: "Ja existe uma impressora com este patrimonio.", status: 409 };
  }
  if (message.includes("uq_printers_serial_not_null")) {
    return { message: "Ja existe uma impressora com este serial.", status: 409 };
  }
  return { message: "Erro ao acessar dados de impressoras.", status: 500 };
}

function withDisplayName(input: {
  display_name?: string | null;
  hostname?: string | null;
  asset_tag?: string | null;
  sector?: string | null;
  model?: string | null;
  ip_address?: string | null;
}) {
  const explicitDisplayName = sanitizeOptionalText(input.display_name);
  const computedDisplayName = buildPrinterDisplayName({
    hostname: input.hostname,
    asset_tag: input.asset_tag,
    sector: input.sector,
    model: input.model,
    ip_address: input.ip_address
  });

  return explicitDisplayName ?? computedDisplayName ?? null;
}

export async function getAllPrinters(): Promise<ServiceResult<Printer[]>> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("printers")
    .select(PRINTER_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: normalizeSupabaseError(error.message).message, status: 500 };
  }

  return { success: true, data: (data ?? []) as Printer[] };
}

async function getPrinterByUniqueField(
  field: "ip_address" | "serial_number" | "asset_tag",
  value: string,
  label: string
): Promise<ServiceResult<Printer | null>> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("printers")
    .select(PRINTER_COLUMNS)
    .eq(field, value)
    .limit(2);

  if (error) {
    return { success: false, error: normalizeSupabaseError(error.message).message, status: 500 };
  }

  const rows = (data ?? []) as Printer[];
  if (rows.length === 0) return { success: true, data: null };
  if (rows.length > 1) {
    return {
      success: false,
      status: 409,
      error: `Ha mais de uma impressora com o mesmo ${label}.`
    };
  }

  return { success: true, data: rows[0] };
}

export async function getPrinterById(id: string): Promise<ServiceResult<Printer>> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("printers")
    .select(PRINTER_COLUMNS)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { success: false, error: "Impressora nao encontrada.", status: 404 };
    }
    return { success: false, error: normalizeSupabaseError(error.message).message, status: 500 };
  }

  return { success: true, data: data as Printer };
}

export async function createPrinter(input: CreatePrinterInput): Promise<ServiceResult<Printer>> {
  const supabase = getSupabaseServerClient();

  const hostname = sanitizeOptionalText(input.hostname ?? null);
  const assetTag = sanitizeOptionalText(input.asset_tag ?? null);
  const serialNumber = sanitizeOptionalText(input.serial_number ?? null);
  const manufacturer = sanitizeOptionalText(input.manufacturer ?? null);
  const macAddress = sanitizeOptionalText(input.mac_address ?? null);
  const displayName = withDisplayName({
    display_name: input.display_name ?? null,
    hostname,
    asset_tag: assetTag,
    sector: input.sector,
    model: input.model,
    ip_address: input.ip_address
  });

  const payload = {
    ...input,
    display_name: displayName,
    hostname,
    location: sanitizeOptionalText(input.location ?? null),
    asset_tag: assetTag,
    serial_number: serialNumber,
    manufacturer,
    mac_address: macAddress,
    is_active: input.is_active ?? true
  };

  const { data, error } = await supabase
    .from("printers")
    .insert(payload)
    .select(PRINTER_COLUMNS)
    .single();

  if (error) {
    const mapped = normalizeSupabaseError(error.message);
    return { success: false, error: mapped.message, status: mapped.status };
  }

  return { success: true, data: data as Printer };
}

export async function updatePrinter(
  id: string,
  input: UpdatePrinterInput
): Promise<ServiceResult<Printer>> {
  const existing = await getPrinterById(id);
  if (!existing.success) return existing;

  const current = existing.data;

  const nextHostname = input.hostname !== undefined ? sanitizeOptionalText(input.hostname) : current.hostname;
  const nextAssetTag = input.asset_tag !== undefined ? sanitizeOptionalText(input.asset_tag) : current.asset_tag;
  const nextModel = input.model ?? current.model;
  const nextSector = input.sector ?? current.sector;
  const nextIp = input.ip_address ?? current.ip_address;

  const shouldRebuildDisplayName =
    input.display_name !== undefined ||
    input.hostname !== undefined ||
    input.asset_tag !== undefined ||
    input.sector !== undefined ||
    input.model !== undefined ||
    input.ip_address !== undefined ||
    !current.display_name;

  const payload: UpdatePrinterInput = {
    ...input,
    hostname: input.hostname !== undefined ? nextHostname : input.hostname,
    location: input.location !== undefined ? sanitizeOptionalText(input.location) : input.location,
    asset_tag: input.asset_tag !== undefined ? nextAssetTag : input.asset_tag,
    serial_number:
      input.serial_number !== undefined ? sanitizeOptionalText(input.serial_number) : input.serial_number,
    manufacturer:
      input.manufacturer !== undefined ? sanitizeOptionalText(input.manufacturer) : input.manufacturer,
    mac_address: input.mac_address !== undefined ? sanitizeOptionalText(input.mac_address) : input.mac_address
  };

  if (shouldRebuildDisplayName) {
    payload.display_name = withDisplayName({
      display_name: input.display_name ?? null,
      hostname: nextHostname,
      asset_tag: nextAssetTag,
      sector: nextSector,
      model: nextModel,
      ip_address: nextIp
    });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("printers")
    .update(payload)
    .eq("id", id)
    .select(PRINTER_COLUMNS)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { success: false, error: "Impressora nao encontrada.", status: 404 };
    }
    const mapped = normalizeSupabaseError(error.message);
    return { success: false, error: mapped.message, status: mapped.status };
  }

  return { success: true, data: data as Printer };
}

export type CollectorPrinterUpsertInput = {
  ip_address?: string;
  serial_number?: string;
  sector?: string;
  location?: string | null;
  asset_tag?: string | null;
  model?: string;
  manufacturer?: string | null;
  hostname?: string | null;
  mac_address?: string | null;
  is_active?: boolean;
};

const COLLECTOR_UNKNOWN_VALUES = new Set([
  "",
  "desconhecido",
  "unknown",
  "n/a",
  "na",
  "none",
  "null",
  "-"
]);

function normalizeCollectorText(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (COLLECTOR_UNKNOWN_VALUES.has(normalized.toLowerCase())) return undefined;
  return normalized;
}

function normalizeCollectorModel(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^[a-z]{1,3}\d{3,5}$/i.test(value)) return value.toUpperCase();
  return value;
}

function normalizeCollectorIp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/\/32$/, "");
}

function resolveCollectorDisplayName(input: {
  hostname?: string;
  asset_tag?: string;
  sector?: string;
  model?: string;
  ip_address?: string;
  fallback?: string | null;
}) {
  const displayName =
    buildPrinterDisplayName({
      hostname: input.hostname,
      asset_tag: input.asset_tag,
      sector: input.sector,
      model: input.model,
      ip_address: input.ip_address
    }) ?? input.fallback;

  return displayName ?? null;
}

export async function upsertPrinterFromCollector(
  input: CollectorPrinterUpsertInput
): Promise<ServiceResult<Printer>> {
  const normalizedIp = normalizeCollectorIp(normalizeCollectorText(input.ip_address));
  const normalizedSerial = normalizeCollectorText(input.serial_number);
  const normalizedSector = normalizeCollectorText(input.sector);
  const normalizedLocation = normalizeCollectorText(input.location ?? undefined);
  const normalizedAssetTag = normalizeCollectorText(input.asset_tag ?? undefined);
  const normalizedModel = normalizeCollectorModel(normalizeCollectorText(input.model));
  const normalizedManufacturer = normalizeCollectorText(input.manufacturer ?? undefined);
  const normalizedHostname = normalizeCollectorText(input.hostname ?? undefined);
  const normalizedMacAddress = normalizeCollectorText(input.mac_address ?? undefined);

  if (!normalizedIp && !normalizedSerial && !normalizedAssetTag) {
    return {
      success: false,
      status: 400,
      error: "Evento do coletor sem ip_address, sem serial_number e sem asset_tag."
    };
  }

  const matchedBy: Array<{ source: "ip_address" | "serial_number" | "asset_tag"; printer: Printer }> = [];

  if (normalizedIp) {
    const byIp = await getPrinterByUniqueField("ip_address", normalizedIp, "IP");
    if (!byIp.success) return byIp as ServiceResult<Printer>;
    if (byIp.data) matchedBy.push({ source: "ip_address", printer: byIp.data });
  }

  if (normalizedSerial) {
    const bySerial = await getPrinterByUniqueField("serial_number", normalizedSerial, "serial");
    if (!bySerial.success) return bySerial as ServiceResult<Printer>;
    if (bySerial.data) matchedBy.push({ source: "serial_number", printer: bySerial.data });
  }

  if (normalizedAssetTag) {
    const byAssetTag = await getPrinterByUniqueField("asset_tag", normalizedAssetTag, "patrimonio");
    if (!byAssetTag.success) return byAssetTag as ServiceResult<Printer>;
    if (byAssetTag.data) matchedBy.push({ source: "asset_tag", printer: byAssetTag.data });
  }

  const uniqueIds = new Set(matchedBy.map((item) => item.printer.id));
  if (uniqueIds.size > 1) {
    const conflictSources = matchedBy.map((item) => item.source).join(", ");
    return {
      success: false,
      status: 409,
      error: `Conflito de matching entre chaves (${conflictSources}). Nao foi feito upsert automatico.`
    };
  }

  const matchedPrinter = matchedBy[0]?.printer ?? null;
  if (matchedPrinter) {
    return updatePrinter(matchedPrinter.id, {
      ip_address: normalizedIp ?? matchedPrinter.ip_address,
      serial_number: normalizedSerial ?? matchedPrinter.serial_number,
      sector: normalizedSector ?? matchedPrinter.sector,
      location: normalizedLocation ?? matchedPrinter.location,
      asset_tag: normalizedAssetTag ?? matchedPrinter.asset_tag,
      model: normalizedModel ?? matchedPrinter.model,
      manufacturer: normalizedManufacturer ?? matchedPrinter.manufacturer,
      hostname: normalizedHostname ?? matchedPrinter.hostname,
      mac_address: normalizedMacAddress ?? matchedPrinter.mac_address,
      is_active: input.is_active ?? matchedPrinter.is_active,
      display_name: resolveCollectorDisplayName({
        hostname: normalizedHostname ?? matchedPrinter.hostname ?? undefined,
        asset_tag: normalizedAssetTag ?? matchedPrinter.asset_tag ?? undefined,
        sector: normalizedSector ?? matchedPrinter.sector,
        model: normalizedModel ?? matchedPrinter.model,
        ip_address: normalizedIp ?? matchedPrinter.ip_address,
        fallback: matchedPrinter.display_name
      })
    });
  }

  if (!normalizedIp) {
    return {
      success: false,
      status: 400,
      error:
        "Impressora nao encontrada por ip/serial/patrimonio e sem ip_address para criacao automatica."
    };
  }

  const createResult = await createPrinter({
    ip_address: normalizedIp,
    serial_number: normalizedSerial ?? null,
    sector: normalizedSector ?? "Sem setor",
    location: normalizedLocation ?? null,
    asset_tag: normalizedAssetTag ?? null,
    model: normalizedModel ?? "Desconhecido",
    manufacturer: normalizedManufacturer ?? null,
    hostname: normalizedHostname ?? null,
    mac_address: normalizedMacAddress ?? null,
    is_active: input.is_active ?? true
  });

  if (!createResult.success) {
    if (createResult.status === 409) {
      return {
        success: false,
        status: 409,
        error: `Conflito ao criar impressora: ${createResult.error}`
      };
    }
    return createResult;
  }

  return createResult;
}
