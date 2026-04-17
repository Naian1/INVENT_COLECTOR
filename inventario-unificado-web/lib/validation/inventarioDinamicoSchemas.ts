import { z } from "zod";

const ipv4Regex =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const dataIsoRegex = /^\d{4}-\d{2}-\d{2}$/;

export const tipoCampoCategoriaSchema = z.enum([
  "texto",
  "numero",
  "booleano",
  "data",
  "ip",
  "patrimonio",
  "lista"
]);

export const tipoSemanticoCampoSchema = z.enum([
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
]);

const textoOpcional = z.string().trim().optional().nullable();

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

export const listarCategoriasQuerySchema = z.object({
  aba_inventario_id: z.string().uuid().optional(),
  ativo: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
});

export const idPathSchema = z.object({
  id: z.string().uuid()
});

export const criarCategoriaSchema = z.object({
  aba_inventario_id: z.string().uuid(),
  nome: z.string().trim().min(1),
  slug: z.string().trim().min(1).max(120).optional(),
  descricao: textoOpcional,
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional()
});

export const atualizarCategoriaSchema = z
  .object({
    nome: z.string().trim().min(1).optional(),
    slug: z.string().trim().min(1).max(120).optional(),
    descricao: textoOpcional,
    ordem: z.number().int().optional(),
    ativo: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Forneca ao menos um campo para atualizacao."
  });

export const criarCampoCategoriaSchema = z.object({
  nome_campo_exibicao: z.string().trim().min(1),
  chave_campo: z.string().trim().min(1).max(120).optional(),
  tipo_campo: tipoCampoCategoriaSchema,
  tipo_semantico: tipoSemanticoCampoSchema.optional(),
  obrigatorio: z.boolean().optional(),
  unico: z.boolean().optional(),
  ordem: z.number().int().optional(),
  opcoes_json: z.array(z.string().trim().min(1)).optional().nullable(),
  metadados: z.record(z.string(), z.unknown()).optional(),
  ativo: z.boolean().optional()
});

export const atualizarCampoCategoriaSchema = z
  .object({
    nome_campo_exibicao: z.string().trim().min(1).optional(),
    chave_campo: z.string().trim().min(1).max(120).optional(),
    tipo_campo: tipoCampoCategoriaSchema.optional(),
    tipo_semantico: tipoSemanticoCampoSchema.optional(),
    obrigatorio: z.boolean().optional(),
    unico: z.boolean().optional(),
    ordem: z.number().int().optional(),
    opcoes_json: z.array(z.string().trim().min(1)).optional().nullable(),
    metadados: z.record(z.string(), z.unknown()).optional(),
    ativo: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Forneca ao menos um campo para atualizacao."
  });

export const listarLinhasCategoriaQuerySchema = z.object({
  pagina: numeroPositivoComDefault(1),
  limite: numeroPositivoComDefault(50).transform((value) => Math.min(value, 200)),
  busca: z.string().trim().min(1).optional(),
  incluir_valores: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  ativo: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
});

export const criarLinhaCategoriaSchema = z.object({
  codigo_linha: textoOpcional,
  ordem: z.number().int().optional(),
  setor: textoOpcional,
  localizacao: textoOpcional,
  hostname_base: textoOpcional,
  observacao: textoOpcional,
  origem_tipo: z.enum(["manual", "importacao", "api", "sistema"]).optional(),
  origem_sheet: textoOpcional,
  origem_indice_linha: textoOpcional,
  dados_extras: z.record(z.string(), z.unknown()).optional(),
  ativo: z.boolean().optional(),
  valores: z
    .array(
      z.object({
        campo_id: z.string().uuid(),
        valor_texto: textoOpcional,
        valor_numero: z.number().optional().nullable(),
        valor_booleano: z.boolean().optional().nullable(),
        valor_data: z.string().trim().regex(dataIsoRegex).optional().nullable(),
        valor_ip: z.string().trim().regex(ipv4Regex).optional().nullable(),
        valor_json: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).optional().nullable()
      })
    )
    .optional()
});

export const atualizarLinhaSchema = z
  .object({
    codigo_linha: textoOpcional,
    ordem: z.number().int().optional(),
    setor: textoOpcional,
    localizacao: textoOpcional,
    hostname_base: textoOpcional,
    observacao: textoOpcional,
    ativo: z.boolean().optional(),
    dados_extras: z.record(z.string(), z.unknown()).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Forneca ao menos um campo para atualizacao."
  });

export const atualizarLinhaValoresSchema = z.object({
  valores: z
    .array(
      z
        .object({
          campo_id: z.string().uuid(),
          limpar: z.boolean().optional(),
          valor_texto: textoOpcional,
          valor_numero: z.number().optional().nullable(),
          valor_booleano: z.boolean().optional().nullable(),
          valor_data: z.string().trim().regex(dataIsoRegex).optional().nullable(),
          valor_ip: z.string().trim().regex(ipv4Regex).optional().nullable(),
          valor_json: z
            .union([z.record(z.string(), z.unknown()), z.array(z.unknown())])
            .optional()
            .nullable()
        })
        .refine(
          (value) =>
            value.limpar === true ||
            value.valor_texto !== undefined ||
            value.valor_numero !== undefined ||
            value.valor_booleano !== undefined ||
            value.valor_data !== undefined ||
            value.valor_ip !== undefined ||
            value.valor_json !== undefined,
          {
            message: "Informe limpar=true ou ao menos um valor para o campo."
          }
        )
    )
    .min(1)
});

export const validarDuplicidadesInventarioSchema = z.object({
  categoria_id: z.string().uuid(),
  linha_id: z.string().uuid().optional(),
  valores: z
    .array(
      z.object({
        campo_id: z.string().uuid(),
        limpar: z.boolean().optional(),
        valor_texto: textoOpcional,
        valor_numero: z.number().optional().nullable(),
        valor_booleano: z.boolean().optional().nullable(),
        valor_data: z.string().trim().regex(dataIsoRegex).optional().nullable(),
        valor_ip: z.string().trim().regex(ipv4Regex).optional().nullable(),
        valor_json: z
          .union([z.record(z.string(), z.unknown()), z.array(z.unknown())])
          .optional()
          .nullable()
      })
    )
    .min(1)
});

export const moverLinhaCategoriaSchema = z.object({
  categoria_destino_id: z.string().uuid(),
  motivo: z
    .enum(["correcao", "manutencao", "troca", "movimentacao", "devolucao", "descarte", "consertado"])
    .default("movimentacao"),
  observacao: textoOpcional,
  chamado_sistema: z.enum(["glpi", "cervello"]).optional().nullable(),
  chamado_id: textoOpcional,
  chamado_url: z.string().trim().url().optional().nullable(),
  manter_ativo: z.boolean().optional()
});

export const moverCamposLinhaSchema = z.object({
  categoria_destino_id: z.string().uuid(),
  campo_ids: z.array(z.string().uuid()).min(1),
  motivo: z
    .enum(["correcao", "manutencao", "troca", "movimentacao", "devolucao", "descarte", "consertado"])
    .default("movimentacao"),
  observacao: textoOpcional,
  chamado_sistema: z.enum(["glpi", "cervello"]).optional().nullable(),
  chamado_id: textoOpcional,
  chamado_url: z.string().trim().url().optional().nullable(),
  manter_ativo: z.boolean().optional(),
  remover_origem: z.boolean().optional()
});
