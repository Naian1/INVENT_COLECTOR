/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\types\tipoEquipamento.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { z } from 'zod';

export const TipoEquipamentoSchema = z.object({
  cd_tipo_equipamento: z.number().int().positive(),
  nm_tipo_equipamento: z.string().min(1),
  ds_tipo_equipamento: z.string().optional().nullable(),
  ie_situacao: z.enum(['A', 'I']).default('A'),
  dt_cadastro: z.coerce.date().optional().nullable(),
});

export type TipoEquipamento = z.infer<typeof TipoEquipamentoSchema>;

export const CreateTipoEquipamentoSchema = TipoEquipamentoSchema.omit({
  cd_tipo_equipamento: true,
  dt_cadastro: true,
});

export type CreateTipoEquipamentoInput = z.infer<typeof CreateTipoEquipamentoSchema>;
export type UpdateTipoEquipamentoInput = Partial<CreateTipoEquipamentoInput>;

