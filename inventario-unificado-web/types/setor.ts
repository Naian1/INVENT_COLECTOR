import { z } from 'zod';

export const SetorSchema = z.object({
  cd_setor: z.number().int().positive(),
  nm_setor: z.string().min(1),
  ds_setor: z.string().optional().nullable(),
  ie_situacao: z.enum(['A', 'I']).default('A'),
  dt_atualizacao: z.coerce.date().optional().nullable(),
});

export type Setor = z.infer<typeof SetorSchema>;

export const CreateSetorSchema = SetorSchema.omit({
  cd_setor: true,
  dt_atualizacao: true,
});

export type CreateSetorInput = z.infer<typeof CreateSetorSchema>;
export type UpdateSetorInput = Partial<CreateSetorInput>;
