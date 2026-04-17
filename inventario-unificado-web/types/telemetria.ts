import { z } from 'zod';

export const TelemetriaPagecountSchema = z.object({
  cd_telemetria: z.number().int().positive(),
  nr_inventario: z.number().int().positive(),
  nr_patrimonio: z.string().min(1),
  nr_paginas_impressas: z.number().int().nonnegative().default(0),
  mes_ano: z.string().optional().nullable(),
  dt_coleta: z.coerce.date().default(() => new Date()),
});

export type TelemetriaPagecount = z.infer<typeof TelemetriaPagecountSchema>;

export type CreateTelemetriaPagecountInput = Omit<
  TelemetriaPagecount,
  'cd_telemetria' | 'mes_ano'
>;
export type UpdateTelemetriaPagecountInput = Partial<CreateTelemetriaPagecountInput>;
