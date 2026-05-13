/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\statusSuprimentosImpressorasService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  buscarImpressoraPorId,
  type ResultadoServico
} from "@/services/impressorasService";
import type {
  LeituraPaginasImpressora,
  StatusSuprimentosImpressora,
  SuprimentoImpressora,
  TelemetriaImpressora
} from "@/types/impressora";

/**
 * [DOC-FUNC] toFiniteNumber
 * O que faz: Normaliza entradas na funcao 'toFiniteNumber', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: value; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
 */
function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * [DOC-FUNC] isEmptyValue
 * O que faz: Avalia condicoes de controle na funcao 'isEmptyValue' para decidir se o fluxo pode avancar.
 * Entradas: Parametros esperados: value; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Executa um fluxo linear de validacao e processamento local, mantendo resultado previsivel para quem consome a funcao.
 * Retorno/Efeitos: Retorna verdadeiro/falso para controlar a continuidade do fluxo nas proximas etapas.
 */
function isEmptyValue(value: unknown) {
  return value === null || value === undefined || value === "";
}

/**
 * [DOC-FUNC] isAlertaAberto
 * O que faz: Avalia condicoes de controle na funcao 'isAlertaAberto' para decidir se o fluxo pode avancar.
 * Entradas: Parametros esperados: alerta, unknown>; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna verdadeiro/falso para controlar a continuidade do fluxo nas proximas etapas.
 */
function isAlertaAberto(alerta: Record<string, unknown>) {
  const status =
    typeof alerta.status_alerta === "string" ? alerta.status_alerta.toLowerCase() : "";
  if (["fechado", "resolvido"].includes(status)) return false;

  if (!isEmptyValue(alerta.fechado_em)) return false;
  if (!isEmptyValue(alerta.resolvido_em)) return false;

  return true;
}

/**
 * [DOC-FUNC] buscarStatusSuprimentosImpressora
 * O que faz: Consulta e organiza informacoes na funcao 'buscarStatusSuprimentosImpressora', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: impressoraId; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; padroniza campos para evitar divergencia de formato; itera listas/objetos para consolidar calculos e mapeamentos.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
export async function buscarStatusSuprimentosImpressora(
  impressoraId: string
): Promise<ResultadoServico<StatusSuprimentosImpressora>> {
  const impressoraResult = await buscarImpressoraPorId(impressoraId);
  if (!impressoraResult.success) {
    return impressoraResult;
  }

  const supabase = getSupabaseServerClient();

  const [
    { data: telemetriaRows, error: telemetriaError },
    { data: leituraRows, error: leituraError },
    { data: suprimentoRows, error: suprimentoError },
    { data: alertaRows, error: alertaError }
  ] = await Promise.all([
    supabase
      .from("telemetria_impressoras")
      .select("ingestao_id,coletor_id,status,tempo_resposta_ms,coletado_em,payload_bruto")
      .eq("impressora_id", impressoraId)
      .order("coletado_em", { ascending: false })
      .limit(1),
    supabase
      .from("leituras_paginas_impressoras")
      .select("ingestao_id,coletado_em,contador_total_paginas,valido,motivo_invalido,reset_detectado")
      .eq("impressora_id", impressoraId)
      .eq("valido", true)
      .order("coletado_em", { ascending: false })
      .limit(1),
    supabase
      .from("suprimentos_impressoras")
      .select("ingestao_id,coletado_em,chave_suprimento,nome_suprimento,nivel_percentual,paginas_restantes,status_suprimento")
      .eq("impressora_id", impressoraId)
      .eq("valido", true)
      .order("nome_suprimento", { ascending: true })
      .range(0, 200),
    supabase
      .from("alertas_impressoras")
      .select("*")
      .eq("impressora_id", impressoraId)
      .range(0, 200)
  ]);

  if (telemetriaError || leituraError || suprimentoError) {
    return {
      success: false,
      status: 500,
      error: "Erro ao buscar status e suprimentos da impressora."
    };
  }

  const ultimaTelemetriaRow = telemetriaRows?.[0] as
    | {
        ingestao_id: string;
        coletor_id: string;
        status: string;
        tempo_resposta_ms: number | null;
        coletado_em: string;
        payload_bruto: Record<string, unknown>;
      }
    | undefined;

  const ultimaLeituraRow = leituraRows?.[0] as
    | {
        ingestao_id: string;
        coletado_em: string;
        contador_total_paginas: number;
        valido: boolean;
        motivo_invalido: string | null;
        reset_detectado: boolean;
      }
    | undefined;

  const ultimosSuprimentos: SuprimentoImpressora[] = (suprimentoRows ?? []).map((row) => ({
    ingestao_id: row.ingestao_id,
    coletado_em: row.coletado_em,
    chave_suprimento: row.chave_suprimento,
    nome_suprimento: row.nome_suprimento,
    nivel_percentual: toFiniteNumber(row.nivel_percentual),
    paginas_restantes: toFiniteNumber(row.paginas_restantes),
    status_suprimento: row.status_suprimento
  }));

  let alertasAbertos: Record<string, unknown>[] = [];
  if (!alertaError && Array.isArray(alertaRows)) {
    alertasAbertos = alertaRows
      .filter((row) => row && typeof row === "object")
      .map((row) => row as Record<string, unknown>)
      .filter(isAlertaAberto);
  }

  const ultimaTelemetria: TelemetriaImpressora | null = ultimaTelemetriaRow
    ? {
        ingestao_id: ultimaTelemetriaRow.ingestao_id,
        coletor_id: ultimaTelemetriaRow.coletor_id,
        status: ultimaTelemetriaRow.status,
        tempo_resposta_ms: ultimaTelemetriaRow.tempo_resposta_ms,
        coletado_em: ultimaTelemetriaRow.coletado_em,
        payload_bruto: ultimaTelemetriaRow.payload_bruto ?? {}
      }
    : null;

  const ultimaLeitura: LeituraPaginasImpressora | null = ultimaLeituraRow
    ? {
        ingestao_id: ultimaLeituraRow.ingestao_id,
        coletado_em: ultimaLeituraRow.coletado_em,
        contador_total_paginas: Number(ultimaLeituraRow.contador_total_paginas),
        valido: ultimaLeituraRow.valido,
        motivo_invalido: ultimaLeituraRow.motivo_invalido,
        reset_detectado: ultimaLeituraRow.reset_detectado
      }
    : null;

  return {
    success: true,
    data: {
      impressora: impressoraResult.data,
      status_atual: ultimaTelemetria?.status ?? "unknown",
      ultima_telemetria: ultimaTelemetria,
      ultimo_contador_total_paginas: ultimaLeitura
        ? Number(ultimaLeitura.contador_total_paginas)
        : null,
      ultima_leitura_paginas: ultimaLeitura,
      ultimos_suprimentos: ultimosSuprimentos,
      alertas_abertos: alertasAbertos
    }
  };
}

