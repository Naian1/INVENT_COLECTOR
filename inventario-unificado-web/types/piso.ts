import { z } from 'zod';

export const PisoSchema = z.object({
  cd_piso: z.number().int().positive(),
  nm_piso: z.string().min(1),
  ds_piso: z.string().optional().nullable(),
  ie_situacao: z.enum(['A', 'I']).default('A'),
  dt_atualizacao: z.coerce.date().optional().nullable(),
});

export type Piso = z.infer<typeof PisoSchema>;

export const CreatePisoSchema = PisoSchema.omit({
  cd_piso: true,
  dt_atualizacao: true,
});

export type CreatePisoInput = z.infer<typeof CreatePisoSchema>;
export type UpdatePisoInput = Partial<CreatePisoInput>;
