import { z } from "zod";

const estrategiaMatchingSchema = z
  .array(z.enum(["patrimonio", "ip", "numero_serie"]))
  .min(1)
  .default(["patrimonio", "ip", "numero_serie"]);

const rowsSchema = z.array(z.record(z.string(), z.unknown())).min(1);

const campoDefinicaoSchema = z.object({
  nome_campo_exibicao: z.string().trim().min(1),
  chave_campo: z.string().trim().min(1).max(120).optional(),
  tipo_campo: z.enum(["texto", "numero", "booleano", "data", "ip", "patrimonio", "lista"]),
  tipo_semantico: z
    .enum([
      "nenhum",
      "patrimonio",
      "ip",
      "hostname",
      "setor",
      "localizacao",
      "modelo",
      "fabricante",
      "numero_serie",
      "impressora_modelo",
      "impressora_patrimonio",
      "impressora_ip"
    ])
    .default("nenhum"),
  obrigatorio: z.boolean().default(false),
  unico: z.boolean().default(false),
  ordem: z.number().int().default(100),
  opcoes_json: z.array(z.string().trim().min(1)).optional().nullable()
});

export const importacaoInventarioPreviewSchema = z.object({
  modo_importacao: z.enum(["itens", "dinamico"]).default("itens"),
  nome_arquivo: z.string().trim().min(1),
  nome_aba: z.string().trim().optional().nullable(),
  headers: z.array(z.string().trim()).optional(),
  rows: rowsSchema,
  mapeamento_colunas: z.record(z.string(), z.string().trim()).default({}),
  aba_inventario_id: z.string().uuid().optional().nullable(),
  tipo_item_id: z.string().uuid().optional().nullable(),
  estrategia_matching: estrategiaMatchingSchema,
  categoria_id: z.string().uuid().optional().nullable(),
  categoria_nova: z
    .object({
      nome: z.string().trim().min(1),
      descricao: z.string().trim().optional().nullable(),
      ordem: z.number().int().optional()
    })
    .optional()
    .nullable(),
  campos_definicao: z.array(campoDefinicaoSchema).optional()
});

export const importacaoInventarioExecutarSchema = z
  .object({
    modo_importacao: z.enum(["itens", "dinamico"]).default("itens"),
    importacao_id: z.string().uuid().optional(),
    nome_arquivo: z.string().trim().min(1).optional(),
    nome_aba: z.string().trim().optional().nullable(),
    headers: z.array(z.string().trim()).optional(),
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    mapeamento_colunas: z.record(z.string(), z.string().trim()).optional(),
    aba_inventario_id: z.string().uuid().optional().nullable(),
    tipo_item_id: z.string().uuid().optional().nullable(),
    estrategia_matching: estrategiaMatchingSchema.optional(),
    categoria_id: z.string().uuid().optional().nullable(),
    categoria_nova: z
      .object({
        nome: z.string().trim().min(1),
        descricao: z.string().trim().optional().nullable(),
        ordem: z.number().int().optional()
      })
      .optional()
      .nullable(),
    campos_definicao: z.array(campoDefinicaoSchema).optional()
  })
  .refine((value) => Boolean(value.importacao_id || (value.nome_arquivo && value.rows?.length)), {
    message: "Informe importacao_id existente ou payload completo para executar.",
    path: ["importacao_id"]
  });
