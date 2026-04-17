import { z } from "zod";

const ipv4Regex =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

const nullableTrimmedString = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, { message: "Campo vazio" })
  .optional()
  .nullable();

export const createPrinterSchema = z.object({
  display_name: nullableTrimmedString,
  hostname: nullableTrimmedString,
  sector: z.string().trim().min(1, "sector e obrigatorio"),
  location: nullableTrimmedString,
  asset_tag: nullableTrimmedString,
  serial_number: nullableTrimmedString,
  model: z.string().trim().min(1, "model e obrigatorio"),
  manufacturer: nullableTrimmedString,
  ip_address: z
    .string()
    .trim()
    .regex(ipv4Regex, "ip_address deve ser um IPv4 valido"),
  mac_address: nullableTrimmedString,
  is_active: z.boolean().optional()
});

export const updatePrinterSchema = createPrinterSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "Forneca ao menos um campo para atualizacao"
  }
);
