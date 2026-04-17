import { z } from 'zod';

export const MovimentacaoSchema = z.object({
  nr_movimentacao: z.number().int().positive().optional(),
  nr_inventario: z.number().int().positive(),
  cd_setor_origem: z.number().int().positive().optional().nullable(),
  cd_setor_destino: z.number().int().positive(),
  nm_usuario: z.string().optional().nullable(),
  ds_observacao: z.string().optional().nullable(),
  dt_movimentacao: z.coerce.date().default(() => new Date()),
  // Campos legados opcionais para compatibilidade
  ds_motivo: z.string().optional().nullable(),
  ds_usuario: z.string().optional().nullable(),
});

export type Movimentacao = z.infer<typeof MovimentacaoSchema>;

export type CreateMovimentacaoInput = Omit<Movimentacao, 'nr_movimentacao'>;
export type UpdateMovimentacaoInput = Partial<CreateMovimentacaoInput>;
