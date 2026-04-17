import { z } from "zod";

const ipv4Regex =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\/32)?$/;

const dataIsoSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Data/hora invalida"
});

const statusTelemetriaSchema = z.enum(["online", "offline", "warning", "error", "unknown"]);
const statusSuprimentoSchema = z.enum(["ok", "low", "critical", "empty", "unknown", "offline"]);

const textoOpcionalNulo = z.string().trim().min(1).optional().nullable();

const impressoraColetorSchema = z
  .object({
    ip: z.string().trim().regex(ipv4Regex, "ip deve ser IPv4 valido").optional(),
    numero_serie: z.string().trim().min(1).optional(),
    setor: z.string().trim().min(1).optional(),
    localizacao: textoOpcionalNulo,
    patrimonio: textoOpcionalNulo,
    modelo: z.string().trim().min(1).optional(),
    fabricante: textoOpcionalNulo,
    hostname: textoOpcionalNulo,
    endereco_mac: textoOpcionalNulo,
    ativo: z.boolean().optional()
  })
  .refine((value) => Boolean(value.ip || value.numero_serie || value.patrimonio), {
    message: "Informe ip, numero_serie ou patrimonio para identificar a impressora"
  });

const leituraPaginasSchema = z.object({
  ingestao_id: z.string().trim().min(1).optional(),
  contador_total_paginas: z.number().int().nonnegative(),
  valido: z.boolean().optional(),
  motivo_invalido: textoOpcionalNulo,
  reset_detectado: z.boolean().optional()
});

const suprimentoSchema = z.object({
  ingestao_id: z.string().trim().min(1).optional(),
  chave_suprimento: z.string().trim().min(1),
  nome_suprimento: z.string().trim().min(1),
  nivel_percentual: z.number().min(0).max(100).optional().nullable(),
  paginas_restantes: z.number().int().nonnegative().optional().nullable(),
  status_suprimento: statusSuprimentoSchema.optional(),
  valido: z.boolean().optional(),
  payload_bruto: z.record(z.any()).optional(),
  raw_value: z.any().optional(),
  raw_oid: textoOpcionalNulo,
  raw_name: textoOpcionalNulo
});

const eventoTelemetriaPtSchema = z.object({
  ingestao_id: z.string().trim().min(1),
  coletado_em: dataIsoSchema.optional(),
  impressora: impressoraColetorSchema,
  status: statusTelemetriaSchema.optional(),
  tempo_resposta_ms: z.number().int().nonnegative().optional(),
  payload_bruto: z.record(z.any()).optional(),
  contador_total_paginas: z.number().int().nonnegative().optional(),
  leitura_paginas: leituraPaginasSchema.optional(),
  suprimentos: z.array(suprimentoSchema).optional().default([])
});

export const loteTelemetriaColetorPtSchema = z.object({
  coletor_id: z.string().trim().min(1),
  coletado_em: dataIsoSchema.optional(),
  eventos: z.array(eventoTelemetriaPtSchema).min(1)
});

export const payloadSimplesColetorPtSchema = z
  .object({
    coletor_id: z.string().trim().min(1),
    ingestao_id: z.string().trim().min(1),
    coletado_em: dataIsoSchema.optional(),
    status: statusTelemetriaSchema.optional(),
    tempo_resposta_ms: z.number().int().nonnegative().optional(),
    payload_bruto: z.record(z.any()).optional(),
    contador_total_paginas: z.number().int().nonnegative().optional(),
    leitura_paginas: leituraPaginasSchema.optional(),
    suprimentos: z.array(suprimentoSchema).optional().default([]),
    impressora: impressoraColetorSchema.optional(),

    ip: z.string().trim().regex(ipv4Regex, "ip deve ser IPv4 valido").optional(),
    numero_serie: z.string().trim().min(1).optional(),
    setor: z.string().trim().min(1).optional(),
    localizacao: textoOpcionalNulo,
    patrimonio: textoOpcionalNulo,
    modelo: z.string().trim().min(1).optional(),
    fabricante: textoOpcionalNulo,
    hostname: textoOpcionalNulo,
    endereco_mac: textoOpcionalNulo,
    ativo: z.boolean().optional()
  })
  .refine(
    (value) => Boolean(value.impressora || value.ip || value.numero_serie || value.patrimonio),
    {
      message: "No payload simples, informe impressora ou ao menos ip/numero_serie/patrimonio."
    }
  );

export const payloadAceitoColetorPtSchema = z.union([
  loteTelemetriaColetorPtSchema,
  payloadSimplesColetorPtSchema
]);

export type LoteTelemetriaColetorPt = z.infer<typeof loteTelemetriaColetorPtSchema>;
export type PayloadSimplesColetorPt = z.infer<typeof payloadSimplesColetorPtSchema>;
export type PayloadAceitoColetorPt = z.infer<typeof payloadAceitoColetorPtSchema>;

function toLote(payload: PayloadSimplesColetorPt): LoteTelemetriaColetorPt {
  const impressora =
    payload.impressora ??
    ({
      ip: payload.ip,
      numero_serie: payload.numero_serie,
      setor: payload.setor,
      localizacao: payload.localizacao,
      patrimonio: payload.patrimonio,
      modelo: payload.modelo,
      fabricante: payload.fabricante,
      hostname: payload.hostname,
      endereco_mac: payload.endereco_mac,
      ativo: payload.ativo
    } satisfies z.infer<typeof impressoraColetorSchema>);

  return {
    coletor_id: payload.coletor_id,
    coletado_em: payload.coletado_em,
    eventos: [
      {
        ingestao_id: payload.ingestao_id,
        coletado_em: payload.coletado_em,
        impressora,
        status: payload.status,
        tempo_resposta_ms: payload.tempo_resposta_ms,
        payload_bruto: payload.payload_bruto,
        contador_total_paginas: payload.contador_total_paginas,
        leitura_paginas: payload.leitura_paginas,
        suprimentos: payload.suprimentos ?? []
      }
    ]
  };
}

export function normalizarPayloadColetorPtParaLote(
  payload: PayloadAceitoColetorPt
): LoteTelemetriaColetorPt {
  return "eventos" in payload ? payload : toLote(payload);
}
