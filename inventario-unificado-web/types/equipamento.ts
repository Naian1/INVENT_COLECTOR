import { z } from 'zod';

export const EquipamentoSchema = z.object({
  cd_equipamento: z.number().int().positive(),
  cd_tipo_equipamento: z.number().int().positive(),
  cd_cgc: z.string().min(1),
  nm_equipamento: z.string().min(1),
  ds_equipamento: z.string().optional().nullable(),
  nm_marca: z.string().optional().nullable(),
  nm_modelo: z.string().min(1),
  tp_hierarquia: z.enum(['RAIZ', 'FILHO', 'AMBOS']).optional().nullable().default('AMBOS'),
  ie_situacao: z.enum(['A', 'I']).default('A'),
  dt_cadastro: z.coerce.date().optional().nullable(),
});

export type Equipamento = z.infer<typeof EquipamentoSchema>;

export const CreateEquipamentoSchema = EquipamentoSchema.omit({
  cd_equipamento: true,
  dt_cadastro: true,
});

export type CreateEquipamentoInput = z.infer<typeof CreateEquipamentoSchema>;
export type UpdateEquipamentoInput = Partial<CreateEquipamentoInput>;
