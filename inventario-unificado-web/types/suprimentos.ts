import { z } from 'zod';

export const SuprimentosSchema = z.object({
  cd_suprimento: z.number().int().positive(),
  nr_inventario: z.number().int().positive(),
  nr_patrimonio: z.string().min(1),
  cd_tipo_suprimento: z.string().min(1),
  nr_quantidade: z.number().default(0),
  ds_status_suprimento: z.string().default('Normal'),
  ds_status_impressora: z.string().default('Offline'),
  dt_coleta: z.coerce.date().default(() => new Date()),
  dt_criacao: z.coerce.date(),
  dt_atualizacao: z.coerce.date(),
});

export type Suprimentos = z.infer<typeof SuprimentosSchema>;

export type CreateSuprimentosInput = Omit<
  Suprimentos,
  'cd_suprimento' | 'dt_criacao' | 'dt_atualizacao'
>;
export type UpdateSuprimentosInput = Partial<CreateSuprimentosInput>;
