import { z } from "zod";

const ipv4Regex =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\/32)?$/;

const dateStringSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Data/hora inválida"
});

export const telemetryStatusSchema = z.enum([
  "online",
  "offline",
  "warning",
  "error",
  "unknown"
]);

export const supplyStatusSchema = z.enum([
  "ok",
  "low",
  "critical",
  "empty",
  "unknown",
  "offline"
]);

const nullableText = z.string().trim().min(1).optional().nullable();

const collectorPrinterSchema = z
  .object({
    ip_address: z
      .string()
      .trim()
      .regex(ipv4Regex, "ip_address deve ser IPv4 válido")
      .optional(),
    serial_number: z.string().trim().min(1).optional(),
    sector: z.string().trim().min(1).optional(),
    location: nullableText,
    asset_tag: nullableText,
    model: z.string().trim().min(1).optional(),
    manufacturer: nullableText,
    hostname: nullableText,
    mac_address: nullableText,
    is_active: z.boolean().optional()
  })
  .refine((value) => Boolean(value.ip_address || value.serial_number || value.asset_tag), {
    message: "Informe ip_address, serial_number ou asset_tag para identificar a impressora"
  });

const collectorPageReadSchema = z.object({
  ingest_id: z.string().trim().min(1).optional(),
  total_pages: z.number().int().nonnegative(),
  is_valid: z.boolean().optional(),
  invalid_reason: nullableText,
  reset_detected: z.boolean().optional()
});

const collectorSupplySchema = z.object({
  ingest_id: z.string().trim().min(1).optional(),
  supply_key: z.string().trim().min(1),
  supply_name: z.string().trim().min(1),
  level_percent: z.number().min(0).max(100).optional().nullable(),
  remaining_pages: z.number().int().nonnegative().optional().nullable(),
  supply_status: supplyStatusSchema.optional(),
  is_valid: z.boolean().optional(),
  raw_payload: z.record(z.any()).optional()
});

export const collectorTelemetryEventSchema = z.object({
  ingest_id: z.string().trim().min(1),
  collected_at: dateStringSchema.optional(),
  printer: collectorPrinterSchema,
  status: telemetryStatusSchema.optional(),
  response_ms: z.number().int().nonnegative().optional(),
  raw_payload: z.record(z.any()).optional(),
  page_count_total: z.number().int().nonnegative().optional(),
  page_read: collectorPageReadSchema.optional(),
  supplies: z.array(collectorSupplySchema).optional().default([])
});

export const collectorTelemetryBatchPayloadSchema = z.object({
  collector_id: z.string().trim().min(1),
  collected_at: dateStringSchema.optional(),
  events: z.array(collectorTelemetryEventSchema).min(1)
});

export const collectorTelemetrySinglePayloadSchema = z
  .object({
    collector_id: z.string().trim().min(1),
    ingest_id: z.string().trim().min(1),
    collected_at: dateStringSchema.optional(),
    status: telemetryStatusSchema.optional(),
    response_ms: z.number().int().nonnegative().optional(),
    raw_payload: z.record(z.any()).optional(),
    page_count_total: z.number().int().nonnegative().optional(),
    page_read: collectorPageReadSchema.optional(),
    supplies: z.array(collectorSupplySchema).optional().default([]),
    printer: collectorPrinterSchema.optional(),

    ip_address: z
      .string()
      .trim()
      .regex(ipv4Regex, "ip_address deve ser IPv4 válido")
      .optional(),
    serial_number: z.string().trim().min(1).optional(),
    sector: z.string().trim().min(1).optional(),
    location: nullableText,
    asset_tag: nullableText,
    model: z.string().trim().min(1).optional(),
    manufacturer: nullableText,
    hostname: nullableText,
    mac_address: nullableText,
    is_active: z.boolean().optional()
  })
  .refine(
    (value) =>
      Boolean(
        value.printer ||
          value.ip_address ||
          value.serial_number ||
          value.asset_tag
      ),
    {
      message:
        "No payload simples, informe printer ou ao menos ip_address/serial_number/asset_tag."
    }
  );

export const collectorTelemetryAcceptedPayloadSchema = z.union([
  collectorTelemetryBatchPayloadSchema,
  collectorTelemetrySinglePayloadSchema
]);

export type CollectorTelemetryBatchPayload = z.infer<
  typeof collectorTelemetryBatchPayloadSchema
>;
export type CollectorTelemetrySinglePayload = z.infer<
  typeof collectorTelemetrySinglePayloadSchema
>;
export type CollectorTelemetryAcceptedPayload = z.infer<
  typeof collectorTelemetryAcceptedPayloadSchema
>;
export type CollectorTelemetryEvent = z.infer<typeof collectorTelemetryEventSchema>;

function normalizeSinglePayloadToBatch(
  payload: CollectorTelemetrySinglePayload
): CollectorTelemetryBatchPayload {
  const printer =
    payload.printer ??
    ({
      ip_address: payload.ip_address,
      serial_number: payload.serial_number,
      sector: payload.sector,
      location: payload.location,
      asset_tag: payload.asset_tag,
      model: payload.model,
      manufacturer: payload.manufacturer,
      hostname: payload.hostname,
      mac_address: payload.mac_address,
      is_active: payload.is_active
    } satisfies z.infer<typeof collectorPrinterSchema>);

  return {
    collector_id: payload.collector_id,
    collected_at: payload.collected_at,
    events: [
      {
        ingest_id: payload.ingest_id,
        collected_at: payload.collected_at,
        printer,
        status: payload.status,
        response_ms: payload.response_ms,
        raw_payload: payload.raw_payload,
        page_count_total: payload.page_count_total,
        page_read: payload.page_read,
        supplies: payload.supplies ?? []
      }
    ]
  };
}

export function normalizeCollectorTelemetryPayload(
  payload: CollectorTelemetryAcceptedPayload
): CollectorTelemetryBatchPayload {
  if ("events" in payload) return payload;
  return normalizeSinglePayloadToBatch(payload);
}
