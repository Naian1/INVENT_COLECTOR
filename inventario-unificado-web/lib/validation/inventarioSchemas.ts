import { z } from "zod";

const ipv4Regex =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

const statusItemSchema = z.enum([
  "ativo",
  "estoque",
  "manutencao",
  "substituido",
  "devolvido",
  "descartado"
]);

const motivoMovimentacaoSchema = z.enum([
  "correcao",
  "manutencao",
  "troca",
  "movimentacao",
  "devolucao",
  "descarte",
  "consertado"
]);

const textoOpcionalNulo = z
  .string()
  .transform((value) => value.trim())
  .optional()
  .nullable();

const uuidObrigatorio = (campo: string) =>
  z.string().uuid(`${campo} deve ser UUID valido`);

const itemInventarioCamposBaseSchema = z.object({
  patrimonio: textoOpcionalNulo,
  descricao: textoOpcionalNulo,
  setor: textoOpcionalNulo,
  localizacao: textoOpcionalNulo,
  modelo: textoOpcionalNulo,
  fabricante: textoOpcionalNulo,
  numero_serie: textoOpcionalNulo,
  hostname: textoOpcionalNulo,
  ip: z.string().trim().regex(ipv4Regex, "ip deve ser IPv4 valido").optional().nullable(),
  status_item: statusItemSchema.optional(),
  dados_extras: z.record(z.string(), z.unknown()).optional(),
  ativo: z.boolean().optional()
});

export const criarItemInventarioSchema = itemInventarioCamposBaseSchema
  .extend({
    aba_inventario_id: uuidObrigatorio("aba_inventario_id"),
    tipo_item_id: uuidObrigatorio("tipo_item_id")
  })
  .refine(
    (value) =>
      Boolean(
        value.patrimonio ||
          value.descricao ||
          value.ip ||
          value.numero_serie ||
          value.hostname
      ),
    {
      message:
        "Informe ao menos um identificador relevante: patrimonio, descricao, ip, numero_serie ou hostname."
    }
  );

export const atualizarItemInventarioSchema = itemInventarioCamposBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Forneca ao menos um campo para atualizacao."
  });

export const moverItemInventarioSchema = z.object({
  para_aba_id: uuidObrigatorio("para_aba_id"),
  motivo: motivoMovimentacaoSchema.default("movimentacao"),
  observacao: textoOpcionalNulo,
  status_item: statusItemSchema.optional()
});

export const vincularImpressoraAoItemSchema = z.object({
  impressora_id: uuidObrigatorio("impressora_id"),
  origem_vinculo: z
    .enum(["manual", "importacao", "coletor", "sistema"])
    .default("manual"),
  observacao: textoOpcionalNulo
});

const boolFromQuery = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const numeroPositivoComDefault = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return defaultValue;
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed)) return defaultValue;
      return parsed;
    })
    .pipe(z.number().int().min(1));

export const listarItensInventarioQuerySchema = z.object({
  aba_inventario_id: z.string().uuid().optional(),
  tipo_item_id: z.string().uuid().optional(),
  status_item: statusItemSchema.optional(),
  ativo: boolFromQuery.optional(),
  busca: z.string().trim().min(1).optional(),
  pagina: numeroPositivoComDefault(1),
  limite: numeroPositivoComDefault(50).transform((value) => Math.min(value, 200))
});
