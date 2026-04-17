import { z } from 'zod';

export const TpStatusSchema = z.enum(['ATIVO', 'MANUTENCAO', 'BACKUP', 'DEVOLUCAO']);

export const InventarioSchema = z.object({
  nr_inventario: z.number().int().positive(),
  nr_patrimonio: z.string().optional().nullable(),
  cd_equipamento: z.number().int().positive(),
  cd_setor: z.number().int().positive(),
  nr_invent_sup: z.number().int().positive().optional().nullable(),
  nr_serie: z.string().optional().nullable(),
  nr_ip: z.string().optional().nullable(),
  tp_status: TpStatusSchema.optional().default('ATIVO'),
  ds_imagem_url: z.string().url().optional().nullable(),
  // Campos legados mantidos opcionais para compatibilidade de frontend antigo
  nm_hostname: z.string().optional().nullable(),
  ds_observacoes: z.string().optional().nullable(),
  dt_entrada: z.coerce.date().optional().nullable().default(() => new Date()),
  dt_saida: z.coerce.date().optional().nullable(),
  ie_situacao: z.enum(['A', 'I', 'M']).default('A'),
  dt_criacao: z.coerce.date().optional().nullable(),
  dt_atualizacao: z.coerce.date().optional().nullable(),
});

export type Inventario = z.infer<typeof InventarioSchema>;

export const CreateInventarioSchema = InventarioSchema.omit({
  nr_inventario: true,
  dt_criacao: true,
  dt_atualizacao: true,
});

export type CreateInventarioInput = z.infer<typeof CreateInventarioSchema>;
export type UpdateInventarioInput = Partial<CreateInventarioInput>;
