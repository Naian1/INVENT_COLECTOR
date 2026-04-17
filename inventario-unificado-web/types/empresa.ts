import { z } from 'zod';

export const EmpresaSchema = z.object({
  cd_cgc: z.string().min(1),
  nm_empresa: z.string().min(1),
  nm_fantasia: z.string().optional().nullable(),
  ds_email: z.string().optional().nullable(),
  nr_telefone: z.string().optional().nullable(),
  ie_situacao: z.enum(['A', 'I']).default('A'),
  dt_cadastro: z.coerce.date().optional().nullable(),
});

export type Empresa = z.infer<typeof EmpresaSchema>;

export const CreateEmpresaSchema = EmpresaSchema.omit({
  dt_cadastro: true,
});

export type CreateEmpresaInput = z.infer<typeof CreateEmpresaSchema>;
export type UpdateEmpresaInput = Partial<CreateEmpresaInput>;
